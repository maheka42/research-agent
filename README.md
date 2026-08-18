# Multi-Agent Research Assistant

Ask a research question and get back a sourced report. Then keep talking to it. Four AI agents split the work: one plans, one searches the web, one reads documents you upload, and one writes the report. Once a report exists you can ask follow-up questions or request edits.

Built with LangGraph, FastAPI, and Next.js.

## Features

- **A real research pipeline.** A new question starts four agents that plan, search, analyse documents, and write a structured report. Progress is streamed to the browser step by step.
- **Intent routing.** Every message is classified first. Replying "ok" or "which sources did you use?" gets a conversational answer instead of re-running the whole pipeline. Ask for "make it shorter" and it revises the existing report in place.
- **Document analysis.** Upload PDFs, text, Markdown, or CSV and the document analyst folds them into the research.
- **Saved chats.** History lives in a sidebar with pin, rename, archive, and delete, stored in the browser so a reload never loses your work.
- **PDF export.** Any report can be downloaded.

## How the pipeline works

The four agents share one state object and pass control through a graph. The orchestrator is the hub. Every specialist returns to it, and it decides what happens next.

```
query
  |
  v
orchestrator  <-------------------+
  |                               |
  +--> web researcher ------------+
  |                               |
  +--> document analyst ----------+
  |
  +--> synthesizer --> report
```

1. The orchestrator reads the query, writes a plan, and picks which specialist goes first.
2. That specialist works and adds what it found to the shared state.
3. Control returns to the orchestrator. It reviews the findings, then routes to another specialist or decides there is enough to write up.
4. The synthesizer turns the findings into a report with an executive summary, key findings, conflicts between sources, knowledge gaps, and recommendations.

The orchestrator runs at most three times per query, so the agents cannot loop forever. If no documents are uploaded, it never routes to the document analyst.

## The conversational layer

Not every message is a research request, so the backend classifies each turn before doing any work. The classifier sees the chat history and whether a report already exists.

| Action | When | What happens |
|--------|------|--------------|
| `research` | A new topic, or an explicit request for a report | Runs the full four-agent pipeline |
| `answer` | A follow-up, a clarification, or an acknowledgement like "ok" | One conversational reply. No pipeline, no new report |
| `revise` | A request to change the existing report | Rewrites the report with the edit applied |

This is what stops the classic failure where every reply, even "ok", starts a brand-new report.

## Setup

You need Python 3.10 or newer, Node.js 20.9 or newer, and an [OpenAI API key](https://platform.openai.com/api-keys).

```bash
git clone https://github.com/Akshats-git/Research-Agent.git
cd Research-Agent

python3 -m venv .venv
source .venv/bin/activate
pip install -e .

cp .env.example .env   # then add your OpenAI API key

cd frontend && npm install
```

## Running

Start the backend and the frontend in separate terminals.

```bash
# terminal 1, from the project root
source .venv/bin/activate
uvicorn research_assistant.api:app --reload --port 8000
```

```bash
# terminal 2, from frontend/
npm run dev
```

Open http://localhost:3000.

## CLI

The research pipeline also runs on its own, without the frontend or the conversational layer.

```bash
research-assistant "What are the latest advances in quantum computing?"
research-assistant "Summarize the key themes" --files paper.pdf notes.txt
research-assistant    # interactive prompt
```

## Configuration

`OPENAI_API_KEY` is required. Everything else has a working default.

| Variable | Where | Default | Purpose |
|----------|-------|---------|---------|
| `OPENAI_API_KEY` | `.env` | none | Required for every LLM call |
| `ALLOWED_ORIGINS` | `.env` | `http://localhost:3000` | Comma-separated origins the API accepts |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | `http://localhost:8000` | Backend the browser calls |

The model and the orchestrator's iteration cap live in `research_assistant/config.py`:

```python
MODEL_NAME = "gpt-4o"
MAX_ITERATIONS = 3
```

## Project layout

```
research_assistant/
├── api.py              FastAPI backend; streams every turn over SSE
├── cli.py              Command-line entry point
├── config.py           Model settings and the LLM factory
├── console.py          Terminal rendering for the CLI
├── conversation.py     Intent router plus the answer and revise handlers
├── graph.py            Wires the agents into the LangGraph workflow
├── state.py            Shared graph state
├── agents/             One module per agent
└── tools/              Web search and document loading

frontend/src/
├── app/                Next.js routes and global styles
├── components/         Chat view, sidebar, pipeline, report card
└── lib/                Chat store, SSE client, pipeline state logic
```

## How the backend talks to the browser

The backend exposes one endpoint, `POST /api/chat`, and streams progress back as [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events). Each turn emits an `intent` event with the router's decision. Then it emits either a run of `agent_update` events for research, a `message` event for an answer, or a `report` event for a revision. It finishes with `complete`. The frontend reads the stream and updates the active chat in place.

## Built with

- [LangGraph](https://github.com/langchain-ai/langgraph) for the agent graph and shared state
- [LangChain](https://github.com/langchain-ai/langchain) and OpenAI GPT-4o for the LLM calls and tool binding
- [FastAPI](https://fastapi.tiangolo.com/) for the streaming API
- [Next.js](https://nextjs.org/) and [Tailwind CSS](https://tailwindcss.com/) for the frontend
- [ddgs](https://pypi.org/project/ddgs/) for web search, which needs no API key
- [pypdf](https://github.com/py-pdf/pypdf) for PDF text extraction
