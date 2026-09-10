import os
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Optional

from fastapi import HTTPException

from .db import count_recent_generations

DAILY_GENERATION_LIMIT = int(os.getenv("GENERATION_DAILY_LIMIT") or "20")

# Per-IP sliding-window limit. user_id is now a real, verified identity (see
# services/auth.py) rather than a client-supplied string, so the daily cap
# below can no longer be reset by just making up a new id -- but someone
# could still create many free accounts to the same end. IP address is
# spoofable/rotatable too, but this raises the cost of that abuse further.
# This is in-memory and per-process: fine for a single backend instance,
# would need a shared store (e.g. Supabase) to hold across multiple instances.
IP_RATE_LIMIT_PER_MINUTE = int(os.getenv("IP_RATE_LIMIT_PER_MINUTE") or "10")
_ip_request_log: dict = defaultdict(deque)
_ip_lock = Lock()


def _enforce_ip_rate_limit(client_ip: Optional[str]) -> None:
    if not client_ip:
        return
    now = time.monotonic()
    window_start = now - 60
    with _ip_lock:
        recent = _ip_request_log[client_ip]
        while recent and recent[0] < window_start:
            recent.popleft()
        if len(recent) >= IP_RATE_LIMIT_PER_MINUTE:
            raise HTTPException(
                status_code=429,
                detail="Too many requests from this address, try again in a moment.",
            )
        recent.append(now)


def enforce_phase0(req, client_ip: Optional[str] = None) -> None:
    """Server-side enforcement for generation requests.

    There is no subscription/licensing data model yet, so this does not (and
    cannot honestly) enforce licensing — it only enforces a real, server-
    tracked daily generation cap per user_id, plus a per-IP rate limit as a
    backstop against the user_id cap being trivially bypassed (see above).
    The client-supplied `license_ok`/`generation_limit_ok` fields on the
    request are informational only; they are never trusted for enforcement
    since a caller can set them to whatever it wants.
    """
    _enforce_ip_rate_limit(client_ip)

    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    count = count_recent_generations(req.user_id, since)
    if count is None:
        # Supabase isn't configured, or the count query failed: we can't
        # enforce a real limit, so fail open rather than block generation.
        return
    if count >= DAILY_GENERATION_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Daily generation limit of {DAILY_GENERATION_LIMIT} reached.",
        )
