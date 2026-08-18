"""Assembles the four agents into a LangGraph workflow.

The orchestrator is the hub: it runs first, and every specialist returns to it
so it can decide what happens next. That loop keeps going until the orchestrator
routes to the synthesizer, which writes the report and ends the run.

    orchestrator ──▶ web_researcher ──┐
        ▲    │                        │
        │    ├──▶ document_analyst ──┤
        │    │                        │
        └────┴──◀─────────────────────┘
             │
             └──▶ synthesizer ──▶ END
"""

from langgraph.graph import StateGraph, END

from research_assistant.state import ResearchState
from research_assistant.agents.orchestrator import orchestrator_node
from research_assistant.agents.web_researcher import web_researcher_node
from research_assistant.agents.document_analyst import document_analyst_node
from research_assistant.agents.synthesizer import synthesizer_node

SPECIALISTS = ("web_researcher", "document_analyst", "synthesizer")


def route_after_orchestrator(state: ResearchState) -> str:
    """Send control to whichever agent the orchestrator chose.

    Falls back to the synthesizer for any unrecognised value so a malformed
    routing decision ends the run cleanly instead of raising.
    """
    agent = state.get("current_agent", "synthesizer")
    return agent if agent in SPECIALISTS else "synthesizer"


def build_graph():
    """Compile the research workflow. Compile once and reuse; it is stateless."""
    graph = StateGraph(ResearchState)

    graph.add_node("orchestrator", orchestrator_node)
    graph.add_node("web_researcher", web_researcher_node)
    graph.add_node("document_analyst", document_analyst_node)
    graph.add_node("synthesizer", synthesizer_node)

    graph.set_entry_point("orchestrator")

    graph.add_conditional_edges(
        "orchestrator",
        route_after_orchestrator,
        {name: name for name in SPECIALISTS},
    )

    # Specialists always hand back to the orchestrator; only it can end the run.
    graph.add_edge("web_researcher", "orchestrator")
    graph.add_edge("document_analyst", "orchestrator")
    graph.add_edge("synthesizer", END)

    return graph.compile()
