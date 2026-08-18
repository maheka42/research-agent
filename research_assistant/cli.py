"""Command-line entry point for running the research graph without the web UI."""

import argparse
import sys

from rich.status import Status

from research_assistant.config import MissingAPIKeyError
from research_assistant.console import (
    console,
    print_agent_status,
    print_error,
    print_header,
    print_report,
)
from research_assistant.graph import build_graph
from research_assistant.state import initial_state

PLAN_PREVIEW_CHARS = 150


def _narrate_step(node_name: str, node_state: dict) -> None:
    """Print a one-line status for whichever node just finished."""
    if node_name == "orchestrator":
        print_agent_status(
            "orchestrator", f"Routing to [bold]{node_state.get('current_agent', '')}[/bold]"
        )
        plan = node_state.get("plan", "")
        if plan:
            preview = plan if len(plan) <= PLAN_PREVIEW_CHARS else plan[:PLAN_PREVIEW_CHARS] + "..."
            console.print(f"    [dim]{preview}[/dim]")
    elif node_name == "web_researcher":
        count = len(node_state.get("web_findings", []))
        print_agent_status("web_researcher", f"Found {count} finding(s)")
    elif node_name == "document_analyst":
        count = len(node_state.get("doc_findings", []))
        print_agent_status("document_analyst", f"Analyzed, {count} finding(s)")
    elif node_name == "synthesizer":
        print_agent_status("synthesizer", "Generating final report...")


def run_research(graph, query: str, documents: list[str] | None = None) -> None:
    """Stream one research run to the terminal and print the report it produces."""
    console.print(f"  [bold]Query:[/bold] {query}")
    if documents:
        console.print(f"  [bold]Documents:[/bold] {', '.join(documents)}")
    console.print()

    report = ""
    step_count = 0

    try:
        with Status("[bold blue]Researching...[/bold blue]", console=console, spinner="dots") as status:
            for step in graph.stream(initial_state(query, documents)):
                step_count += 1
                for node_name, node_state in step.items():
                    status.update(f"[bold blue]Step {step_count}: {node_name} working...[/bold blue]")
                    _narrate_step(node_name, node_state)
                    report = node_state.get("final_report") or report
    except KeyboardInterrupt:
        console.print("\n\n  [yellow]Research interrupted.[/yellow]\n")
        raise
    except MissingAPIKeyError as e:
        print_error(str(e))
        sys.exit(1)
    except Exception as e:
        print_error(f"{type(e).__name__}: {e}")
        return

    if report:
        print_report(report)
    else:
        print_error("No report was generated. The research may have ended prematurely.")


def _interactive(graph) -> None:
    """Prompt for queries until the user exits."""
    console.print("  Enter your research query (or [bold]Ctrl+C[/bold] to exit):\n")
    while True:
        query = console.input("  [bold bright_blue]>[/bold bright_blue] ").strip()
        if not query:
            continue
        run_research(graph, query)
        console.print("\n  Enter another query (or [bold]Ctrl+C[/bold] to exit):\n")


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="research-assistant",
        description="Multi-Agent Research Assistant",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='Examples:\n'
               '  research-assistant "What are the latest advances in quantum computing?"\n'
               '  research-assistant "Summarize key themes" --files paper.pdf notes.txt\n'
               '  research-assistant                        # interactive prompt',
    )
    parser.add_argument("query", nargs="?", help="Research query")
    parser.add_argument(
        "--files", nargs="+", default=[], metavar="PATH", help="Documents to analyse"
    )
    args = parser.parse_args()

    print_header()
    graph = build_graph()

    try:
        if args.query:
            run_research(graph, args.query, args.files)
        else:
            _interactive(graph)
    except (KeyboardInterrupt, EOFError):
        console.print("\n\n  [dim]Goodbye![/dim]\n")


if __name__ == "__main__":
    main()
