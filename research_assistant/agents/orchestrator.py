"""Orchestrator agent: plans the research and routes to the right specialist."""

import json
from typing import Literal

from pydantic import BaseModel, Field
from langchain_core.messages import SystemMessage, HumanMessage

from research_assistant.config import get_llm, MAX_ITERATIONS
from research_assistant.state import ResearchState


Specialist = Literal["web_researcher", "document_analyst", "synthesizer"]

SPECIALIST_VALUES = {
    "web_researcher",
    "document_analyst",
    "synthesizer",
}


class ResearchPlan(BaseModel):
    """Structured representation of the orchestrator's routing decision."""

    plan: str = Field(
        description="A concise research plan outlining what to investigate"
    )
    next_agent: Specialist = Field(
        description="The agent that should run next"
    )
    reasoning: str = Field(
        description="Why this agent should run next"
    )


ORCHESTRATOR_PROMPT = """You are a research orchestrator.

Your job is to create a research plan and choose the next specialist.

Available specialists:

- web_researcher: Searches the web.
- document_analyst: Reads user-provided documents.
- synthesizer: Combines gathered findings into the final report.

Rules:

1. On the first call, create a concise research plan.
2. If web research is needed, route to web_researcher.
3. If documents are provided and need analysis, route to document_analyst.
4. Do not route to document_analyst when there are no documents.
5. Return ONLY ONE JSON object.
6. Do not use tools.
7. Do not include <think> blocks.
8. Do not include markdown.

The JSON must contain exactly:

{
  "plan": "concise research plan",
  "next_agent": "web_researcher",
  "reasoning": "why this agent should run next"
}

next_agent must be exactly one of:

web_researcher
document_analyst
synthesizer
"""


def _build_context(state: ResearchState, iteration: int) -> str:
    """Assemble the context needed for the initial orchestration decision."""

    parts = [
        f"Research query: {state['query']}",
        f"Current iteration: {iteration + 1}/{MAX_ITERATIONS}",
    ]

    if state.get("plan"):
        parts.append(f"Current plan: {state['plan']}")

    if state.get("web_findings"):
        parts.append(
            f"Web findings already collected: "
            f"{len(state['web_findings'])}"
        )

    if state.get("doc_findings"):
        parts.append(
            f"Document findings already collected: "
            f"{len(state['doc_findings'])}"
        )

    if state.get("documents"):
        parts.append(
            f"User provided documents: {state['documents']}"
        )
    else:
        parts.append("No documents provided by user.")

    return "\n\n".join(parts)


def _extract_json(content: str) -> dict:
    """Extract the first valid JSON object from a model response."""

    content = content.strip()

    # First try the entire response.
    try:
        result = json.loads(content)

        if isinstance(result, dict):
            return result

    except json.JSONDecodeError:
        pass

    # Reasoning models may put <think>...</think> before JSON.
    decoder = json.JSONDecoder()

    for start in range(len(content)):
        if content[start] != "{":
            continue

        try:
            result, _ = decoder.raw_decode(content[start:])

            if isinstance(result, dict):
                return result

        except json.JSONDecodeError:
            continue

    raise ValueError(
        f"Orchestrator returned invalid JSON: {content}"
    )


def _first_route(state: ResearchState) -> dict:
    """Use the LLM only for the initial planning decision."""

    llm = get_llm()

    response = llm.invoke(
        [
            SystemMessage(content=ORCHESTRATOR_PROMPT),
            HumanMessage(
                content=_build_context(
                    state,
                    state.get("iteration", 0),
                )
            ),
        ]
    )

    content = response.content

    if not isinstance(content, str):
        content = "".join(
            block if isinstance(block, str) else block.get("text", "")
            for block in content
        )

    result = _extract_json(content)

    plan = str(result.get("plan", "")).strip()
    next_agent = result.get("next_agent", "web_researcher")
    reasoning = str(result.get("reasoning", "")).strip()

    if next_agent not in SPECIALIST_VALUES:
        next_agent = "web_researcher"

    if next_agent == "document_analyst" and not state.get("documents"):
        next_agent = "web_researcher"

    return {
        "plan": plan,
        "current_agent": next_agent,
        "reasoning": reasoning,
        "iteration": state.get("iteration", 0) + 1,
        "messages": [
            {
                "role": "orchestrator",
                "content": f"Plan: {plan} | Next: {next_agent}",
            }
        ],
    }


def orchestrator_node(state: ResearchState) -> dict:
    """Route the research workflow.

    The LLM is used for the initial planning decision.

    After a specialist has produced findings, routing is deterministic.
    This prevents reasoning-model output from corrupting the routing protocol.
    """

    iteration = state.get("iteration", 0)

    # Hard stop.
    if iteration >= MAX_ITERATIONS:
        return {
            "current_agent": "synthesizer",
            "iteration": iteration,
        }

    # ---------------------------------------------------------
    # Deterministic routing after web research.
    # ---------------------------------------------------------
    #
    # Once web findings exist, the next useful step is synthesis.
    # There is no reason to ask the LLM to make another JSON routing
    # decision, which also prevents Groq reasoning text from breaking
    # the routing protocol.
    #
    if state.get("web_findings"):
        if state.get("documents") and not state.get("doc_findings"):
            return {
                "current_agent": "document_analyst",
                "iteration": iteration,
                "plan": state.get("plan", ""),
                "reasoning": "Web research is complete; analyze the provided documents.",
                "messages": [
                    {
                        "role": "orchestrator",
                        "content": (
                            "Web research complete. "
                            "Routing to document_analyst."
                        ),
                    }
                ],
            }

        return {
            "current_agent": "synthesizer",
            "iteration": iteration,
            "plan": state.get("plan", ""),
            "reasoning": "Sufficient research findings have been gathered; synthesize the final report.",
            "messages": [
                {
                    "role": "orchestrator",
                    "content": (
                        "Research findings gathered. "
                        "Routing to synthesizer."
                    ),
                }
            ],
        }

    # ---------------------------------------------------------
    # Deterministic routing after document analysis.
    # ---------------------------------------------------------

    if state.get("doc_findings"):
        return {
            "current_agent": "synthesizer",
            "iteration": iteration,
            "plan": state.get("plan", ""),
            "reasoning": "Document analysis is complete; synthesize the final report.",
            "messages": [
                {
                    "role": "orchestrator",
                    "content": (
                        "Document analysis complete. "
                        "Routing to synthesizer."
                    ),
                }
            ],
        }

    # ---------------------------------------------------------
    # First orchestration decision.
    # ---------------------------------------------------------

    return _first_route(state)