# Beat Addicts AI Backend

## Run locally

1. Install deps

```bash
pip install -r requirements.txt
```

2. Set env (see `.env.example`)

```
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...

# Required for real /pulse/chat replies
ONSPACE_AI_BASE_URL=...
ONSPACE_AI_API_KEY=...

# Optional (see .env.example for defaults)
CORS_ALLOWED_ORIGINS=...
GENERATION_DAILY_LIMIT=...
```

Without `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` set, the API still runs — it just
skips persistence and the daily generation limit is unenforced (fails open).
Without `ONSPACE_AI_BASE_URL`/`ONSPACE_AI_API_KEY`, `/pulse/chat` returns a
`502` instead of a real reply.

3. Start API

```bash
uvicorn app.main:app --reload --port 8000
```
