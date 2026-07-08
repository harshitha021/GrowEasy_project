# GrowEasy AI-Powered CSV Importer

An AI-powered CSV importer that extracts CRM lead information from **any valid CSV format** — Facebook Lead exports, Google Ads exports, real-estate CRM dumps, sales trackers, hand-made spreadsheets — and converts them into GrowEasy CRM records using Azure OpenAI.

## How it works

```
Upload CSV → Preview rows → Confirm → AI extraction (batched) → Imported + Skipped results
```

1. **Upload** — drag & drop or pick any `.csv` (up to 10 MB / 5,000 rows).
2. **Preview** — the raw rows are parsed and shown in a scrollable, sticky-header table. No AI runs yet.
3. **Confirm** — the backend creates a background **import job** (returns a `jobId` instantly), chunks rows into batches of 20, and processes them concurrently with automatic retry (exponential backoff). The UI subscribes to the job's SSE stream for live progress — and because the job runs independently of the connection, **reloading the page resumes the import** instead of losing it.
4. **Results** — imported records and skipped rows (with reasons) are displayed with totals; the clean CRM CSV can be downloaded.

### Key design decisions

- **AI maps, code validates.** The LLM does the fuzzy field mapping; the server re-enforces every hard rule (allowed `crm_status`/`data_source` enums, `new Date()`-parseable dates, the "no email + no phone → skip" rule, single-line values). The model can never inject an invalid value into the CRM.
- **Structured output.** The model is called with a strict JSON response schema (OpenAI structured outputs) — no free-text parsing.
- **Batching + concurrency + retry.** Batches of 20 rows, 3 batches in flight, 3 attempts per batch with exponential backoff. A failed batch skips only its own rows, with the reason recorded.
- **Resumable jobs.** `POST /api/import` returns a `jobId`; progress/results are consumed via `GET /api/import/:id/stream` (SSE). The frontend keeps the `jobId` in `sessionStorage` and re-subscribes after a reload. With `REDIS_URL` set, jobs also survive **server restarts**: job state (including per-batch completion) is persisted in Redis, and a startup sweep + reconnect-triggered recovery re-runs only the unfinished batches.
- **No mandatory infrastructure.** Without `REDIS_URL` the same job system runs on an in-memory store (reload-proof, not restart-proof) — zero setup for local dev.
- **Recent imports** are kept in the browser's localStorage (device-scoped, no login) and can be reopened instantly.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| Backend | Node.js 22, Express 4, TypeScript |
| AI | Azure OpenAI (`o4-mini`) via the official `openai` SDK |
| Tests | Vitest |

## Project structure

```
backend/
  src/
    index.ts              # server entry
    app.ts                # express app (CORS, routes, error handler)
    config.ts             # env-driven settings
    routes/               # /api/parse, /api/import
    controllers/          # request handling + SSE streaming
    services/
      csvParser.ts        # tolerant CSV parsing (BOM, ragged rows, dup headers)
      aiExtractor.ts      # batching, LLM calls, retry, concurrency
      validator.ts        # server-side rule enforcement
    prompts/extraction.ts # the AI extraction prompt
    types/crm.ts          # CRM field + enum definitions
frontend/
  src/
    app/page.tsx          # 4-step wizard
    components/           # dropzone, tables, progress, results, stats
    hooks/useImport.ts    # wizard state machine
    lib/api.ts            # API client + SSE stream reader
samples/                  # messy sample CSVs to try
```

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/parse` | multipart field `file` → `{ headers, rows, totalRows }` (no AI) |
| `POST` | `/api/import` | JSON `{ rows }` → `202 { jobId }` — starts a background job |
| `GET` | `/api/import/:id/stream` | SSE: `progress`, `done` (full summary), `fatal`, `not_found` |
| `GET` | `/api/import/:id` | JSON job snapshot (poll fallback) |
| `GET` | `/health` | health + AI configuration status |

## Local setup

### Prerequisites

- Node.js 20+
- Azure OpenAI credentials (endpoint + API key + a deployed model, e.g. `o4-mini`)

### Backend

```bash
cd backend
npm install
cp .env.example .env       # then fill in your Azure OpenAI credentials
npm run dev                # http://localhost:4000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local # NEXT_PUBLIC_API_URL defaults to http://localhost:4000
npm run dev                # http://localhost:3000
```

Open http://localhost:3000 and try the files in `samples/`.

### Tests

```bash
cd backend && npm test     # 17 unit tests (parser + validator rules)
```

### Optional: Redis (restart-proof imports)

Create a free Redis database (e.g. [Upstash](https://upstash.com)) and set in `backend/.env`:

```
REDIS_URL=rediss://default:...@...upstash.io:6379
```

Without it, jobs use an in-memory store: page reloads still resume, but a server restart loses in-flight jobs.

### Docker

```bash
AZURE_OPENAI_API_KEY=... AZURE_OPENAI_ENDPOINT=https://... docker compose up --build
# frontend on :3000, backend on :4000
```

## CRM extraction rules implemented

- 15 CRM fields extracted when available (`created_at`, `name`, `email`, `country_code`, `mobile_without_country_code`, `company`, `city`, `state`, `country`, `lead_owner`, `crm_status`, `crm_note`, `data_source`, `possession_time`, `description`).
- `crm_status` restricted to `GOOD_LEAD_FOLLOW_UP | DID_NOT_CONNECT | BAD_LEAD | SALE_DONE`; free-text statuses are mapped by meaning, unmappable ones preserved in `crm_note`.
- `data_source` restricted to the 5 allowed values, blank when not confidently matched.
- `created_at` guaranteed `new Date()`-parseable (verified server-side).
- Multiple emails/phones: first one used, the rest appended to `crm_note`.
- Rows with neither email nor mobile are skipped, with the reason shown in the UI.
- All values kept single-line so every record stays one CSV row.

## Deployment

- **Frontend** → Vercel: import the repo, set root directory to `frontend/`, add `NEXT_PUBLIC_API_URL` pointing at the deployed backend.
- **Backend** → Render/Railway: root directory `backend/`, build `npm install && npm run build`, start `npm start`, env vars `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_DEPLOYMENT`, and `CORS_ORIGINS=https://<your-vercel-domain>`.

## Bonus features implemented

- Drag & drop upload · live progress during AI processing (SSE) · retry with backoff for failed AI batches · **resumable import jobs** (survive page reloads; with Redis, also server restarts — only unfinished batches re-run) · dark mode · unit tests · Docker + docker-compose · skipped-row reasons · download of the converted CRM CSV · recent-imports history with re-openable results (localStorage, no login) · fully animated UI (Motion spring physics, respects reduced motion)
