#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  kill "${BACKEND_PID:-}" 2>/dev/null || true
  kill "${FRONTEND_PID:-}" 2>/dev/null || true
  wait "${BACKEND_PID:-}" 2>/dev/null || true
  wait "${FRONTEND_PID:-}" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

(
  cd backend
  exec python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
) &
BACKEND_PID=$!

for _ in {1..30}; do
  if curl --fail --silent http://127.0.0.1:8000/health >/dev/null; then
    break
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    wait "$BACKEND_PID"
    exit $?
  fi
  sleep 0.2
done

if ! curl --fail --silent http://127.0.0.1:8000/health >/dev/null; then
  echo "FastAPI did not become healthy in time" >&2
  exit 1
fi

(
  exec ./node_modules/.bin/vite
) &
FRONTEND_PID=$!

set +e
wait -n "$BACKEND_PID" "$FRONTEND_PID"
STATUS=$?
set -e

exit "$STATUS"