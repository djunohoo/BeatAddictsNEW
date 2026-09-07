import os
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from .db import count_recent_generations

DAILY_GENERATION_LIMIT = int(os.getenv("GENERATION_DAILY_LIMIT", "20"))


def enforce_phase0(req) -> None:
    """Server-side enforcement for generation requests.

    There is no subscription/licensing data model yet, so this does not (and
    cannot honestly) enforce licensing — it only enforces a real, server-
    tracked daily generation cap per user_id. The client-supplied
    `license_ok`/`generation_limit_ok` fields on the request are informational
    only; they are never trusted for enforcement since a caller can set them
    to whatever it wants.
    """
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
