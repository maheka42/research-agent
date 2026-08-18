"""Web search tool backed by DuckDuckGo, which needs no API key."""

from langchain_core.tools import tool
from ddgs import DDGS

MAX_RESULTS = 5


@tool
def web_search(query: str) -> str:
    """Search the web using DuckDuckGo and return the top results with titles, snippets, and URLs."""
    try:
        results = list(DDGS().text(query, max_results=MAX_RESULTS))
    except Exception as e:
        # Surface failures to the LLM as text so it can adapt rather than crash the run.
        return f"Search failed: {e}"

    if not results:
        return f"No results found for: {query}"

    formatted = [
        f"{i}. **{r.get('title', 'Untitled')}**\n"
        f"   URL: {r.get('href', 'unknown')}\n"
        f"   {r.get('body', '')}"
        for i, r in enumerate(results, 1)
    ]
    return "\n\n".join(formatted)
