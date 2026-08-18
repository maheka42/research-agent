"""Terminal rendering helpers for the CLI.

These wrap `rich` so a command-line run gets the same colour-coded, per-agent
narration the web UI shows, plus a Markdown-rendered final report.
"""

from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.text import Text

console = Console()

# Each agent has a colour and a display label so its output is easy to scan.
AGENT_STYLES = {
    "orchestrator": ("bold cyan", "Orchestrator"),
    "web_researcher": ("bold green", "Web Researcher"),
    "document_analyst": ("bold yellow", "Document Analyst"),
    "synthesizer": ("bold magenta", "Synthesizer"),
}


def print_header() -> None:
    console.print()
    console.print(
        Panel(
            Text("Multi-Agent Research Assistant", style="bold white", justify="center"),
            subtitle="Powered by LangGraph + LangChain",
            border_style="bright_blue",
            padding=(1, 2),
        )
    )
    console.print()


def print_agent_status(agent_name: str, message: str) -> None:
    style, label = AGENT_STYLES.get(agent_name, ("bold white", agent_name))
    console.print(f"  [{style}][{label}][/{style}] {message}")


def print_report(report: str) -> None:
    console.print()
    console.print(
        Panel(
            Markdown(report),
            title="[bold white]Research Report[/bold white]",
            border_style="bright_green",
            padding=(1, 2),
        )
    )
    console.print()


def print_error(message: str) -> None:
    console.print(f"\n  [bold red]Error:[/bold red] {message}\n")
