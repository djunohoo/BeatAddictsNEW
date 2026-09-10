import logging
from typing import Optional

from fastapi import Header, HTTPException

from .db import _get_client

logger = logging.getLogger("beataddicts.auth")


def get_current_user_id(authorization: Optional[str] = Header(default=None)) -> str:
    """Verifies the Supabase-issued JWT on the Authorization header and
    returns the real, authenticated user id. Replaces the old model where
    every endpoint trusted a client-supplied `user_id` string with no
    verification at all (B2) -- callers can no longer write data under an
    arbitrary identity.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    client = _get_client()
    if client is None:
        raise HTTPException(status_code=503, detail="Auth not configured on this server")

    try:
        response = client.auth.get_user(token)
    except Exception:
        logger.info("Token verification failed", exc_info=True)
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    user = getattr(response, "user", None)
    if user is None or not getattr(user, "id", None):
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return user.id
