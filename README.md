
# Multi-Agent Research Assistant

A full-stack AI research assistant that turns research questions into structured, sourced reports using a coordinated multi-agent workflow.

## Live Demo

 **[Try the Research Assistant](https://research-agent-psi-sepia.vercel.app/)**

The application is fully deployed and working in production.

## Features

-  Multi-agent AI research workflow
-  Intelligent research planning and orchestration
-  Web research and source gathering
-  PDF, TXT, Markdown, and CSV document analysis
-  Intelligent follow-up conversations
-  Existing report revision
-  Real-time agent progress streaming
-  Persistent chat history
-  Pin, rename, archive, and delete conversations
-  Structured research reports
-  PDF report export
-  Dark-themed responsive interface

## How It Works

The application uses four specialized AI agents coordinated through LangGraph.

```text
                        ┌──────────────────┐
                        │   Orchestrator   │
                        │  Plan & Route    │
                        └────────┬─────────┘
                                 │
                 ┌───────────────┼───────────────┐
                 │               │               │
                 ▼               ▼               │
        ┌────────────────┐ ┌────────────────┐   │
        │ Web Researcher │ │Document Analyst│   │
        │                │ │                │   │
        │ Search & Gather│ │ Analyze Uploads│   │
        └────────┬───────┘ └───────┬────────┘   │
                 │                 │            │
                 └────────┬────────┘            │
                          ▼                     │
                  ┌───────────────┐             │
                  │  Orchestrator │◄────────────┘
                  │ Review & Route│
                  └───────┬───────┘
                          │
                          ▼
                  ┌───────────────┐
                  │  Synthesizer  │
                  │ Final Report  │
                  └───────────────┘
````

### Research Flow

1. The **Orchestrator** analyzes the user's question and creates a research plan.
2. The **Web Researcher** searches the web and gathers relevant information.
3. The **Document Analyst** analyzes uploaded documents when provided.
4. Findings are returned to the **Orchestrator** for evaluation.
5. The **Synthesizer** combines the findings into a structured research report.
6. The report can be discussed, revised, or exported as a PDF.

## Intelligent Conversation

The application does not restart the entire research pipeline for every message.

Each message is classified into one of three actions:

| Action     | Purpose                                             |
| ---------- | --------------------------------------------------- |
| `research` | Starts a new research workflow                      |
| `answer`   | Handles follow-up questions and normal conversation |
| `revise`   | Modifies an existing research report                |

For example:

```text
Research the history of Java
        ↓
Research pipeline
        ↓
Structured report

"Which sources did you use?"
        ↓
Follow-up answer

"Make the report shorter"
        ↓
Report revision
```

## Document Analysis

Users can upload documents and incorporate their contents into research.

Supported formats:

* PDF
* TXT
* Markdown
* CSV

The document analyst extracts relevant information and adds it to the shared research state.

## Real-Time Streaming

Research progress is streamed from the backend to the frontend using **Server-Sent Events (SSE)**.

The interface displays agent activity while the research is being performed instead of waiting for the entire workflow to finish.

## Report Generation

The synthesizer produces structured reports containing sections such as:

* Executive Summary
* Key Findings
* Source Attribution
* Conflicting Information
* Knowledge Gaps
* Recommendations

Reports can also be exported using the browser's **Save as PDF** functionality.

## Tech Stack

### Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS

### Backend

* Python
* FastAPI
* Uvicorn

### AI & Agent Framework

* LangGraph
* LangChain
* Groq

### Tools

* DDGS — Web Search
* pypdf — PDF Text Extraction
* Server-Sent Events — Real-Time Streaming

## Architecture

```text
User
 │
 ▼
Next.js Frontend
 │
 │ Server-Sent Events
 ▼
FastAPI Backend
 │
 ▼
LangGraph Workflow
 │
 ├── Orchestrator
 │
 ├── Web Researcher
 │
 ├── Document Analyst
 │
 └── Synthesizer
 │
 ▼
Structured Research Report
```

## Deployment

The application is deployed as a production full-stack application.

| Component | Platform |
| --------- | -------- |
| Frontend  | Vercel   |
| Backend   | Render   |
| LLM       | Groq     |

### Production URLs

**Frontend**

[https://research-agent-psi-sepia.vercel.app/](https://research-agent-psi-sepia.vercel.app/)

**Backend**

[https://research-agent-44bx.onrender.com/](https://research-agent-44bx.onrender.com/)

The production frontend and backend are connected and working end-to-end.

## Project Structure


Research-Agent/
│
├── research_assistant/
│   ├── agents/
│   │   ├── orchestrator.py
│   │   ├── web_researcher.py
│   │   ├── document_analyst.py
│   │   └── synthesizer.py
│   │
│   ├── tools/
│   │   ├── documents.py
│   │   └── search.py
│   │
│   ├── api.py
│   ├── cli.py
│   ├── config.py
│   ├── conversation.py
│   ├── graph.py
│   └── state.py
│
├── frontend/
│   └── src/
│       ├── app/
│       ├── components/
│       └── lib/
│
├── pyproject.toml
├── .env.example
├── .gitignore
└── README.md
```

## Production Status

- Multi-agent research pipeline working
- Web research working
- Document analysis working
- Conversational follow-ups working
- Report revision working
- Real-time progress streaming working
- Production API working
- Frontend deployed on Vercel
- Backend deployed on Render
- PDF export working

## Project

A full-stack multi-agent AI research application built to demonstrate practical agent orchestration, tool use, document analysis, streaming APIs, conversational routing, and production deployment.

That's it.
