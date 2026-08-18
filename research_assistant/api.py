"""FastAPI backend.

Exposes the research graph and the conversational layer over a single
Server-Sent Events endpoint (``/api/chat``). Each turn is first classified as a
new report, a follow-up answer, or an edit to the existing report. Only the
research path runs the full multi-agent pipeline.

SSE event types emitted to the browser:
    intent        {action}                     router's decision for this turn
    start         {query}                      a research run is beginning
    agent_update  {step, agent, ...}           one graph node finished
    message       {content}                    conversational answer (no report)
    report        {report}                     a revised report
    complete      {step}                       the turn is done
    error         {message}                    something failed
"""

import os
import json
import asyncio
import logging
import tempfile
from contextlib import suppress
from typing import AsyncIterator

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from research_assistant.config import MissingAPIKeyError
from research_assistant.graph import build_graph
from research_assistant.state import initial_state
from research_assistant.conversation import (
    Message,
    classify_intent,
    answer_question,
    revise_report,
)

logger = logging.getLogger(__name__)

# Comma-separated list, so a deployed frontend can be allowed without a code change.
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

app = FastAPI(title="Multi-Agent Research Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Compiled once at startup and reused across requests.
graph = build_graph()


def _event(event_type: str, data: dict) -> str:
    """Format a single Server-Sent Event frame."""
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


def _agent_update(step: int, node_name: str, node_state: dict) -> dict:
    """Pick out the fields the UI cares about for a finished graph node."""
    data = {"step": step, "agent": node_name}

    if node_name == "orchestrator":
        data["plan"] = node_state.get("plan", "")
        data["next_agent"] = node_state.get("current_agent", "")
        data["reasoning"] = node_state.get("reasoning", "")
    elif node_name == "web_researcher":
        data["findings"] = node_state.get("web_findings", [])
        data["findings_count"] = len(data["findings"])
    elif node_name == "document_analyst":
        data["findings"] = node_state.get("doc_findings", [])
        data["findings_count"] = len(data["findings"])
    elif node_name == "synthesizer":
        data["report"] = node_state.get("final_report", "")

    return data


def _describe(exc: Exception) -> str:
    """Turn an exception into something worth showing a user."""
    if isinstance(exc, MissingAPIKeyError):
        return str(exc)
    logger.exception("Request failed")
    return f"{type(exc).__name__}: {exc}"


async def _stream_research(query: str, documents: list[str]) -> AsyncIterator[str]:
    """Run the graph and stream one ``agent_update`` per node as it completes."""
    yield _event("start", {"query": query})

    step_count = 0
    try:
        # astream, not stream: the nodes make blocking network calls, and a sync
        # loop here would stall the event loop for the whole run.
        async for step in graph.astream(initial_state(query, documents)):
            step_count += 1
            for node_name, node_state in step.items():
                yield _event("agent_update", _agent_update(step_count, node_name, node_state))
        yield _event("complete", {"step": step_count})
    except Exception as e:
        yield _event("error", {"message": _describe(e)})


async def _stream_chat(
    message: str,
    history: list[Message],
    current_report: str,
    documents: list[str],
) -> AsyncIterator[str]:
    """Route a chat turn: fresh research, a conversational answer, or a report edit."""
    has_report = bool(current_report)

    try:
        action = await asyncio.to_thread(classify_intent, message, history, has_report)
    except Exception as e:
        yield _event("error", {"message": _describe(e)})
        return

    yield _event("intent", {"action": action})

    if action == "research":
        async for frame in _stream_research(message, documents):
            yield frame
        return

    try:
        if action == "revise":
            report = await asyncio.to_thread(revise_report, message, history, current_report)
            yield _event("report", {"report": report})
        else:
            reply = await asyncio.to_thread(answer_question, message, history, current_report)
            yield _event("message", {"content": reply})
        yield _event("complete", {})
    except Exception as e:
        yield _event("error", {"message": _describe(e)})


async def _save_uploads(files: list[UploadFile] | None) -> list[str]:
    """Persist uploaded files to temp paths the document loader can read.

    The original filename is kept as the suffix so the loader still sees the
    extension it dispatches on.
    """
    paths: list[str] = []
    for upload in files or []:
        if not upload.filename:
            continue
        contents = await upload.read()
        if not contents:
            continue
        with tempfile.NamedTemporaryFile(
            delete=False, suffix=f"_{os.path.basename(upload.filename)}"
        ) as tmp:
            tmp.write(contents)
            paths.append(tmp.name)
    return paths


def _discard(paths: list[str]) -> None:
    for path in paths:
        with suppress(OSError):
            os.unlink(path)


async def _stream_turn(
    message: str,
    history: list[Message],
    current_report: str,
    documents: list[str],
) -> AsyncIterator[str]:
    """Wrap the turn so uploads are removed once the response is finished,
    including when the client disconnects mid-stream."""
    try:
        async for frame in _stream_chat(message, history, current_report, documents):
            yield frame
    finally:
        _discard(documents)


def _parse_history(raw: str) -> list[Message]:
    try:
        parsed = json.loads(raw) if raw else []
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


@app.post("/api/chat")
async def chat(
    message: str = Form(...),
    history: str = Form("[]"),
    current_report: str = Form(""),
    files: list[UploadFile] | None = File(None),
):
    documents = await _save_uploads(files)

    return StreamingResponse(
        _stream_turn(message, _parse_history(history), current_report, documents),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/health")
async def health():
    return {"status": "ok"}
