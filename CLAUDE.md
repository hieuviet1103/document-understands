# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (run from project root)
```bash
npm install
npm run dev          # Dev server at http://localhost:5173
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript type check
```

### Backend (run from `backend/`)
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Celery worker (separate terminal, requires Redis running)
celery -A app.services.processing.celery_app worker --loglevel=info
# Windows only: add --pool=solo
```

### Docker (development)
```bash
docker compose up --build          # Starts Redis + Backend + Celery + Frontend
docker compose logs -f celery_worker
docker compose run --rm create_admin   # One-time admin user setup
```

### Docker (production)
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## Architecture

### Request Flow
1. Frontend → `src/services/api.ts` (Axios with Supabase JWT injected) → FastAPI (`backend/app/main.py`)
2. Upload: `POST /api/v1/documents/upload` → Supabase Storage via `services/storage.py`
3. Processing: `POST /api/v1/jobs` → Celery task queued via Redis → `process_document_task` in `services/processing.py`
4. AI: Task calls `services/gemini.py` → Google Gemini API → result stored in Supabase
5. Webhooks: On job completion, `services/processing.py` POSTs signed HMAC-SHA256 payloads to registered URLs
6. External API: `POST /external/v1/process` (X-Api-Key header) → same pipeline, no JWT

### Backend Structure (`backend/app/`)
- `main.py` — FastAPI app, CORS middleware, all router registration
- `core/config.py` — Pydantic `BaseSettings`, all env vars loaded here
- `core/auth.py` — JWT validation + Supabase service role operations
- `api/` — Thin route handlers: `documents`, `templates`, `jobs`, `api_keys`, `webhooks`, `external`
- `services/processing.py` — Celery app definition + `process_document_task` (job lifecycle, retry logic, webhook dispatch)
- `services/gemini.py` — Gemini prompt engineering; uses Files API for files >20 MB
- `services/storage.py` — Supabase Storage upload/download/signed URLs
- `services/output_formatter.py` — Converts Gemini output to `text` / `json` / `excel`
- `models/schemas.py` — All Pydantic models (`JobStatus`, `OutputFormat`, `DocumentStatus`, etc.)

### Frontend Structure (`src/`)
- `main.tsx` → `App.tsx` — React 18 root, QueryClient, BrowserRouter, AuthProvider wrapping 7 protected routes + `/login`
- `contexts/AuthContext.tsx` — Supabase auth state; all pages depend on this
- `services/api.ts` — Axios instance; JWT auto-injected from Supabase session; exports `documentsApi`, `templatesApi`, `jobsApi`, `apiKeysApi`, `webhooksApi`
- `services/supabase.ts` — Supabase JS client (used by AuthContext and api.ts)
- `pages/` — 8 pages; `LoginPage` and `DashboardPage` are the most complete
- `i18n/` — i18next with English (`en.json`) and Vietnamese (`vi.json`); extend both when adding UI strings

### Auth Model
- **Frontend users**: Supabase Auth → JWT → `Authorization: Bearer <token>` header
- **External/API users**: Hashed API keys stored in Supabase → `X-Api-Key` header
- **Multi-tenant**: All data scoped to `organization_id`; RLS enforced in Supabase; admin bypasses via service role key

### Output Formats
Templates define one of three `output_format` values:
- `text` — free-text prompt template
- `json` — structured extraction with field schema
- `excel` — tabular columns; output formatted by `output_formatter.py` into `.xlsx`

## Key Configuration

### Required Environment Variables
**Backend** (`.env` or `.env.docker`):
```
SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
REDIS_URL=redis://localhost:6379/0
CORS_ORIGINS=http://localhost:5173
```

**Frontend** (Vite prefix):
```
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
VITE_API_BASE_URL=http://localhost:8000
```

### Celery
- Broker + result backend: Redis (`settings.REDIS_URL`)
- Task: `process_document_task` in `services/processing.py` — retries 3× with exponential backoff on 429 rate limits
- Time limits: 1800s soft / 1500s hard

### Gemini
- Default model: `gemini-2.5-flash` (set via `GEMINI_MODEL`)
- Files ≤20 MB: inline base64; files >20 MB: Gemini Files API
- Max output tokens: `GEMINI_MAX_OUTPUT_TOKENS` (default 16384)
