"""Synthesizer agent: turns collected findings into the final report."""

from langchain_core.messages import SystemMessage, HumanMessage

from research_assistant.config import get_llm, message_text
from research_assistant.state import ResearchState


SYNTHESIZER_PROMPT = """You are the final research report writer.

Create a complete, professional research report using ONLY the research
findings provided to you.

IMPORTANT:
- Return ONLY the final report.
- Never output your reasoning or thinking process.
- Never output <think>...</think>.
- Never describe how you created the report.
- Do not repeat the prompt.
- Do not invent sources or facts.
- Use source URLs from the findings whenever available.
- Keep the report concise enough to finish completely.

## Required Format

### Executive Summary
Write exactly 2 concise paragraphs explaining the most important conclusions.

### Key Findings
Provide 5-7 numbered findings.

For every finding include:
- The factual finding
- Source attribution
- Confidence level: High, Medium, or Low

### Conflicting Information
Briefly describe important disagreements between sources.
If there are none, write:
"No significant conflicts identified."

### Knowledge Gaps
Provide 3-4 important areas where the available research is incomplete.

### Recommendations
Provide 3-4 practical next steps based on the evidence.

## Final requirements

The report must be COMPLETE.

Do not stop halfway through a section.

Do not include analysis, planning, self-correction, or internal reasoning.
"""


NO_FINDINGS = (
    "No findings were gathered. Provide a brief report acknowledging this."
)


def _format_findings(
    web_findings: list[str],
    doc_findings: list[str],
) -> str:
    """Format accumulated findings for the synthesizer."""

    sections: list[str] = []

    if web_findings:
        sections.append("## Web Research Findings")

        for i, finding in enumerate(web_findings, 1):
            sections.append(
                f"### Web Finding {i}\n{finding}"
            )

    if doc_findings:
        sections.append("## Document Analysis Findings")

        for i, finding in enumerate(doc_findings, 1):
            sections.append(
                f"### Document Finding {i}\n{finding}"
            )

    if not sections:
        return NO_FINDINGS

    return "\n\n".join(sections)


def _clean_report(text: str) -> str:
    """Remove reasoning blocks accidentally returned by the model."""

    text = text.strip()

    # Remove complete <think>...</think> blocks.
    while "<think>" in text and "</think>" in text:
        start = text.find("<think>")
        end = text.find("</think>", start)

        if end == -1:
            break

        text = (
            text[:start]
            + text[end + len("</think>"):]
        )

    # If the model returned an unmatched <think>, discard it and
    # everything after it.
    if "<think>" in text:
        text = text[:text.find("<think>")]

    text = text.replace("</think>", "")

    # Remove common model meta-output if it appears before the report.
    unwanted_prefixes = [
        "Here is the final report:",
        "Here is the report:",
        "Final report:",
        "Output Generation:",
    ]

    for prefix in unwanted_prefixes:
        if text.startswith(prefix):
            text = text[len(prefix):].strip()

    return text.strip()


def synthesizer_node(state: ResearchState) -> dict:
    """Combine accumulated findings into the final research report."""

    llm = get_llm()

    findings_text = _format_findings(
        state.get("web_findings", []),
        state.get("doc_findings", []),
    )

    response = llm.invoke(
        [
            SystemMessage(content=SYNTHESIZER_PROMPT),
            HumanMessage(
                content=(
                    f"Research query:\n{state['query']}\n\n"
                    f"Research plan:\n"
                    f"{state.get('plan') or 'N/A'}\n\n"
                    f"{findings_text}\n\n"
                    "Now write the complete final research report."
                )
            ),
        ]
    )

    report = _clean_report(message_text(response))

    return {
        "final_report": report,
        "current_agent": "done",
        "messages": [
            {
                "role": "synthesizer",
                "content": "Final report generated",
            }
        ],
    }