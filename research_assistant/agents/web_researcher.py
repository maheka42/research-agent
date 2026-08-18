"""Web researcher agent: searches the web and summarizes the results."""

from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage

from research_assistant.config import get_llm, message_text
from research_assistant.state import ResearchState
from research_assistant.tools.search import web_search


MAX_SEARCHES = 3


WEB_RESEARCHER_PROMPT = """You are a web research specialist.

Your job is to analyze the web search results that have already been collected
and produce a concise, factual research summary.

Do NOT call any tools.
Do NOT perform additional searches.
Do NOT include your reasoning or thinking process.

Your summary must include:
- Key facts discovered
- Source attribution with URLs
- Conflicting information, if any
- Confidence level for important findings

Be factual, focused, and evidence-based.
"""


def web_researcher_node(state: ResearchState) -> dict:
    """Run targeted web searches and summarize their results."""

    llm = get_llm()

    # First LLM: decide what should be searched.
    searcher = llm.bind_tools([web_search])

    messages = [
        SystemMessage(
            content=(
                "You are a web research query planner. "
                "Generate targeted web search queries for the research plan. "
                "Use the web_search tool when appropriate. "
                "Do not provide a final report yet."
            )
        ),
        HumanMessage(
            content=(
                f"Research query: {state['query']}\n\n"
                f"Research plan: "
                f"{state.get('plan') or 'Research the query broadly.'}\n\n"
                "Generate targeted searches and use the web_search tool."
            )
        ),
    ]

    search_results = []

    # Allow up to MAX_SEARCHES search rounds.
    for _ in range(MAX_SEARCHES):
        response = searcher.invoke(messages)
        messages.append(response)

        if not response.tool_calls:
            break

        for call in response.tool_calls:
            try:
                result = web_search.invoke(call["args"])
            except Exception as exc:
                result = f"Search failed: {exc}"

            search_results.append(result)

            messages.append(
                ToolMessage(
                    content=result,
                    tool_call_id=call["id"],
                )
            )

    # If no search was performed, preserve a useful finding instead of
    # producing an empty result.
    if not search_results:
        search_results.append(
            "No web search results were successfully collected."
        )

    # IMPORTANT:
    # The summarizer has NO tools attached.
    # Therefore Groq cannot accidentally attempt another web_search call.
    summariser = llm

    summary_messages = [
        SystemMessage(content=WEB_RESEARCHER_PROMPT),
        HumanMessage(
            content=(
                f"Research query: {state['query']}\n\n"
                f"Research plan: "
                f"{state.get('plan') or 'N/A'}\n\n"
                "The following web search results were collected:\n\n"
                + "\n\n---\n\n".join(search_results)
                + "\n\nNow summarize these findings."
            )
        ),
    ]

    summary = summariser.invoke(summary_messages)

    return {
        "web_findings": [message_text(summary)],
        "current_agent": "orchestrator",
        "messages": [
            {
                "role": "web_researcher",
                "content": (
                    f"Gathered {len(search_results)} web search result(s)"
                ),
            }
        ],
    }