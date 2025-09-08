#  Deep Research Project

Build a small web application that lets a user ask a question and get a deep research agent answer. You will implement the frontend and use the provided backend.

You are given a research system that combines user-defined strategies, intelligent web search, content analysis,
and automated report generation using large language models.

## Project Structure

```
/
├── backend/          # FastAPI backend service
│   ├── README.md     # Backend setup and configuration
│   ├── main.py       # FastAPI application
│   ├── scan_research.py  # Core research logic
│   ├── frame/        # Advanced reliability framework
│   └── ...
├── frontend/         # Next.js frontend application to implement
└── README.md         # This file
```

## Getting Started

### 1. Backend Setup

Navigate to the backend directory and follow the setup instructions:

```bash
cd backend
```

See [backend/README.md](backend/README.md) for detailed setup instructions, including:

- Python environment setup
- API key configuration
- Server startup commands

## Frontend Task

Build a simple chat-style UI that:

- Lets a user type a research question and submit it
- Shows live progress and events streamed from the backend as they happen
- Displays the final generated report when complete
- Provides copy/export of the final report

Keep it clean, responsive, and accessible.

Use **shadcn/ui** for simplicity (prefer its components over bespoke styling).

### API you will call

- POST `/api/research`
  - Request JSON:
    - `prompt` (string, required when starting from research)
    - `start_from` ("research" | "reporting", default "research")
    - `session_key` (string, optional)
  - Response: newline-delimited JSON (NDJSON) streamed with media type `application/x-ndjson`.
  - Each line has the shape: `{ "event": <object>, "session_key": <string> }`.

Common `event.type` values you will see:

- `started`: backend woke up
- `generic`: status/progress message (look at `description`)
- `error`: something failed — stop reading and surface the error
- `completed`: research and reporting finished — show final report
- `cancelled`: research cancelled

Notes:

- Events are line-delimited JSON strings; do not wait for the whole body.
- Treat unknown `event.type` values as informational log entries and render them.
- The backend may stream both research and reporting phases; stop on `completed`, `error`, or stream end.

### Frontend requirements

| Area       | Requirement                                                   |
| ---------- | ------------------------------------------------------------- |
| Framework  | React + TypeScript (Next.js)                                  |
| UI kit     | **shadcn/ui**                                                 |
| Live trace | Stream NDJSON via the browser Fetch API (ReadableStream)      |
| UX         | Mobile-friendly, accessible; show clear loading & step status |

Minimum UI elements:

- Chat input with submit and a visible first user message
- Live event feed with timestamps and readable statuses
- Progress indicator while streaming; ability to cancel the in-flight request
- Final report view (rich text/Markdown) with copy/export to Markdown

Resilience:

- Show the active `session_key` somewhere
- If the connection drops mid-stream, allow retry/restart from the beginning

Non-goals (optional if you have time):

- Persisting sessions across reloads
- Custom strategies via `/api/research2`

## Deliverables

```text
.
├── README.md               ← this spec + any notes you add
├── docs/DECISIONS.md       ← key trade-offs, what you’d build next
├── docs/ARCHITECTURE.md    ← high-level diagram (or Mermaid in Markdown)
├── frontend/               ← Next.js / React app to implement
└── backend/                ← Existing backend implementation (no changes needed)
```

## Documentation

- [Backend Documentation](backend/README.md) - API setup, configuration, and endpoints
- [Frontend Documentation](frontend/README.md) - UI setup, configuration, and deployment

## How we evaluate

- Correct streaming implementation (parsing NDJSON incrementally)
- Clear, responsive, accessible UI with obvious progress and completion
- Type safety and code quality (folder structure, components, hooks)
- Simple, thoughtful UX (empty states, loading, errors)
