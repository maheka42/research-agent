"""Document analyst agent: reads uploaded files and extracts relevant content."""

from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage

from research_assistant.config import get_llm, message_text
from research_assistant.state import ResearchState
from research_assistant.tools.documents import load_document

# Loading each document takes one turn; the rest let the model reason over them.
EXTRA_TURNS = 2

DOCUMENT_ANALYST_PROMPT = """You are a document analysis specialist. Your job is to read provided documents and extract information relevant to the research query.

## Instructions
1. Load each provided document using the load_document tool.
2. Analyze the content in the context of the research query and plan.
3. Extract key information including:
   - Main themes and arguments
   - Relevant data, statistics, or quotes
   - How the document relates to the research query
   - Any limitations or biases in the document
4. Compile your analysis into a clear summary.

Be precise and cite specific parts of the documents when possible."""

SUMMARY_REQUEST = (
    "Now compile your document analysis into a clear summary of findings "
    "relevant to the research query."
)


def document_analyst_node(state: ResearchState) -> dict:
    documents = state.get("documents", [])

    # The orchestrator guards against this, but stay defensive: no files, no work.
    if not documents:
        return {
            "doc_findings": ["No documents were provided for analysis."],
            "current_agent": "orchestrator",
            "messages": [{"role": "document_analyst", "content": "No documents to analyze"}],
        }

    llm = get_llm()
    reader = llm.bind_tools([load_document])
    summariser = llm

    messages = [
        SystemMessage(content=DOCUMENT_ANALYST_PROMPT),
        HumanMessage(content=(
            f"Research query: {state['query']}\n\n"
            f"Research plan: {state.get('plan') or 'Analyze the documents for relevant information.'}\n\n"
            f"Documents to analyze: {documents}\n\n"
            "Load and analyze each document."
        )),
    ]

    for _ in range(len(documents) + EXTRA_TURNS):
        response = reader.invoke(messages)
        messages.append(response)

        if not response.tool_calls:
            break

        for call in response.tool_calls:
            result = load_document.invoke(call["args"])
            messages.append(ToolMessage(content=result, tool_call_id=call["id"]))

    # See web_researcher: the write-up must not come back as another tool call.
    summary = summariser.invoke(messages + [HumanMessage(content=SUMMARY_REQUEST)])

    return {
        "doc_findings": [message_text(summary)],
        "current_agent": "orchestrator",
        "messages": [{"role": "document_analyst", "content": f"Analyzed {len(documents)} document(s)"}],
    }
