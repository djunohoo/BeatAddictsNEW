# Running on Replit

The project keeps its imported Vite/React frontend and FastAPI backend structure.

## Start

Use the **Start application** workflow. It runs:

- Vite on `0.0.0.0:5000` for the Replit web preview
- FastAPI on `127.0.0.1:8000`
- A Vite `/api` proxy so browser requests reach FastAPI through the same origin

The workflow command is:

```bash
bash scripts/start-replit.sh
```

## Required secrets

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

Keep these values in Replit Secrets; do not commit them to the repository.