import logging
import os
from typing import Any, Dict, Optional

try:
    from supabase import create_client, Client
except Exception:
    create_client = None
    Client = None

logger = logging.getLogger("beataddicts.db")

_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not url or not key or create_client is None:
        return None
    _client = create_client(url, key)
    return _client


def _insert(table: str, record: Dict[str, Any]) -> None:
    client = _get_client()
    if client is None:
        return
    try:
        client.table(table).insert(record).execute()
    except Exception:
        # Persistence is best-effort: a DB/schema hiccup shouldn't turn an
        # already-computed result into a 500 for the caller.
        logger.exception("Failed to insert into %s", table)


def log_generation(req, kind: str, payload: Dict[str, Any]):
    _insert(
        "ai_generations",
        {
            "user_id": req.user_id,
            "kind": kind,
            "genre": req.genre,
            "payload": payload,
            "opt_in": req.opt_in,
        },
    )


def store_feedback(user_id: str, accepted: bool, pattern: Dict[str, Any], genre: str):
    _insert(
        "ai_feedback",
        {
            "user_id": user_id,
            "accepted": accepted,
            "pattern": pattern,
            "genre": genre,
        },
    )


def store_midi(user_id: str, midi_url: str):
    _insert("midi_files", {"user_id": user_id, "midi_url": midi_url})


def enqueue_training_batch(user_id: str, batch_id: str):
    _insert("training_batches", {"user_id": user_id, "batch_id": batch_id})


def count_recent_generations(user_id: str, since_iso: str) -> Optional[int]:
    """Count ai_generations rows for user_id at/after since_iso.

    Returns None if Supabase isn't configured or the query fails, so callers
    can fail open instead of blocking generation on an infra hiccup.
    """
    client = _get_client()
    if client is None:
        return None
    try:
        result = (
            client.table("ai_generations")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .gte("created_at", since_iso)
            .execute()
        )
        return result.count
    except Exception:
        logger.exception("Failed to count recent generations for user_id=%s", user_id)
        return None


def count_all_generations(user_id: str) -> Optional[int]:
    """Total ai_generations rows for user_id, all time. Used for an honest
    Dashboard stat instead of a hardcoded number. Returns None if Supabase
    isn't configured or the query fails, so the caller can show a real
    "unavailable" state instead of a fabricated number.
    """
    client = _get_client()
    if client is None:
        return None
    try:
        result = (
            client.table("ai_generations")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .execute()
        )
        return result.count
    except Exception:
        logger.exception("Failed to count total generations for user_id=%s", user_id)
        return None


def save_pattern(user_id: str, pattern_id: str, name: str, genre: Optional[str], mood: Optional[str], style: Optional[str], pattern: Dict[str, Any], saved_at: Optional[str]) -> bool:
    """Upsert one saved pattern to Supabase. Returns whether it actually
    persisted (False if Supabase isn't configured or the write failed) so
    the frontend can tell the difference between "saved for real" and
    "only saved locally" instead of assuming success."""
    client = _get_client()
    if client is None:
        return False
    try:
        record = {
            "id": pattern_id,
            "user_id": user_id,
            "name": name,
            "genre": genre,
            "mood": mood,
            "style": style,
            "pattern": pattern,
        }
        if saved_at:
            record["saved_at"] = saved_at
        client.table("saved_patterns").upsert(record).execute()
        return True
    except Exception:
        logger.exception("Failed to save pattern id=%s for user_id=%s", pattern_id, user_id)
        return False


def list_saved_patterns(user_id: str, limit: int = 50) -> Optional[list]:
    """List saved patterns for user_id, most recent first. Returns None
    (not an empty list) if Supabase isn't configured or the query failed,
    so the caller can fall back to its local copy instead of wrongly
    treating "couldn't check" as "there are none"."""
    client = _get_client()
    if client is None:
        return None
    try:
        result = (
            client.table("saved_patterns")
            .select("id,name,genre,mood,style,pattern,saved_at")
            .eq("user_id", user_id)
            .order("saved_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data
    except Exception:
        logger.exception("Failed to list saved patterns for user_id=%s", user_id)
        return None


def delete_saved_pattern(user_id: str, pattern_id: str) -> bool:
    client = _get_client()
    if client is None:
        return False
    try:
        client.table("saved_patterns").delete().eq("id", pattern_id).eq("user_id", user_id).execute()
        return True
    except Exception:
        logger.exception("Failed to delete pattern id=%s for user_id=%s", pattern_id, user_id)
        return False
