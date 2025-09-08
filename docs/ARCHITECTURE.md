# Architecture Overview

## System Design

```
┌──────────────────────────────┐            ┌──────────────────────────────┐
│  Next.js App (Frontend)      │  request   │  FastAPI Backend (API)       │
│  - shadcn/ui components      │──────────▶ │  /api/research               │
│  - browser Fetch API         │            │  streams NDJSON events       │
└───────────────┬──────────────┘  NDJSON    └──────────────┬───────────────┘
                │             ◀────────────stream          │
                │                                          │
                │                                  ┌───────▼────────┐
                │                                  │ Processing     │
                │                                  │ Pipeline       │
                │                                  └───────┬────────┘
                │                                          │
        ┌───────▼────────────┐                    ┌────────▼───────────┐
        │ Web Search (Tavily)│                    │ LLM (OpenAI/NVIDIA │
        └────────────────────┘                    │ or local vLLM)     │
                                                  └─────────┬──────────┘
                                                            │
                                                   ┌────────▼──────────┐
                                                   │ Report Generation │
                                                   └───────────────────┘
```

## Components

### Frontend (Next.js)
- **Timeline/Event Feed**: Renders NDJSON stream events in real-time
- **Chat Interface**: User interaction layer
- **Shadcn UI**: Component library

### Backend (FastAPI)
- **Stream Endpoint**: `/api/research` returns NDJSON (one JSON object per line)
- **Processing Pipeline**: Orchestrates search and report generation
- **CORS Middleware**: Enables frontend-backend communication

### Processing Steps
1. **Web Search**: Tavily API retrieves relevant sources
2. **LLM Processing**: Selected model generates analyses and summaries
3. **Report Generation**: Final structured report is produced

## Data Flow

1. User submits query via frontend
2. Frontend POSTs to `/api/research` and reads the response as a ReadableStream of NDJSON
3. Backend processes the query through the pipeline (search, LLM, report)
4. Each step writes events as line-delimited JSON
5. Frontend renders events live; on `completed`, shows the final report

## Development Setup

- Backend runs on `http://localhost:8000` (see backend/README.md)
- Frontend runs on `http://localhost:3000`
- Configure API keys per backend setup; ensure CORS `FRONTEND_URL` matches the frontend origin
