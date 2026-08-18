"""The state object every node in the research graph reads and writes."""

from operator import add
from typing import Annotated, TypedDict


class AgentMessage(TypedDict):
    """One line in the run log, recording which agent did what."""

    role: str
    content: str


class ResearchState(TypedDict):
    """Shared state passed between every node in the research graph.

    Fields annotated with ``add`` are accumulated across nodes. LangGraph
    appends each node's contribution instead of overwriting it, so findings and
    messages build up over the course of a run. The plain fields are simply
    replaced by whichever node writes them last.
    """

    query: str                                       # The user's research question.
    plan: str                                        # Orchestrator's current research plan.
    reasoning: str                                   # Why the orchestrator picked the next agent.
    web_findings: Annotated[list[str], add]          # Summaries produced by the web researcher.
    doc_findings: Annotated[list[str], add]          # Summaries produced by the document analyst.
    documents: list[str]                             # Paths of user-uploaded files to analyse.
    final_report: str                                # The synthesizer's finished report.
    current_agent: str                               # Node the orchestrator routes to next.
    messages: Annotated[list[AgentMessage], add]     # Running log of per-agent activity.
    iteration: int                                   # Orchestrator loop counter, capped by MAX_ITERATIONS.


def initial_state(query: str, documents: list[str] | None = None) -> ResearchState:
    """Build the starting state for a run. Every field is set so the accumulator
    annotations have a list to append to."""
    return ResearchState(
        query=query,
        plan="",
        reasoning="",
        web_findings=[],
        doc_findings=[],
        documents=documents or [],
        final_report="",
        current_agent="",
        messages=[],
        iteration=0,
    )
