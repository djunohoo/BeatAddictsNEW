import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Any, Dict, Optional

from models.inference import (
    generate_drums,
    generate_bassline,
    generate_melody,
    generate_chords,
    generate_arrangement,
)
from services.auth import get_current_user_id
from services.legal import enforce_phase0
from services.db import (
    log_generation,
    store_feedback,
    store_midi,
    enqueue_training_batch,
    count_all_generations,
    save_pattern,
    list_saved_patterns,
    delete_saved_pattern,
)
from services.pulse import get_pulse_reply, PulseUnavailable

app = FastAPI(title="Beat Addicts AI Engine", version="0.1.0")

# CORS_ALLOWED_ORIGINS: comma-separated list, e.g. "https://beataddicts.app,http://localhost:5000".
# Defaults to "*" for local/LAN dev. allow_credentials is left off since this
# API has no cookie/session-based auth (auth is a bearer JWT on the
# Authorization header, not a cookie) -- allow_origins="*" + allow_credentials=True
# is invalid per the CORS spec.
_allowed_origins = os.getenv("CORS_ALLOWED_ORIGINS") or "*"
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _allowed_origins.split(",")],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerationRequest(BaseModel):
    genre: Optional[str] = None
    mood: Optional[str] = None
    complexity: Optional[int] = None
    density: Optional[int] = None
    opt_in: bool = False
    license_ok: bool = False
    generation_limit_ok: bool = False
    preferences: Dict[str, Any] = Field(default_factory=dict)
    # Real identity comes from the verified Authorization bearer token (see
    # services/auth.py), never from the request body -- this field only
    # exists so log_generation/enforce_phase0 have somewhere to read it from
    # after each endpoint sets it to the verified id.
    user_id: str = Field(default="", exclude=True)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/stats/generations")
def generation_stats(user_id: str = Depends(get_current_user_id)):
    """Real generation count for the Dashboard, replacing a previously
    hardcoded number. `count: null` means Supabase isn't configured or the
    query failed -- the frontend should show an honest "unavailable" state
    rather than a fabricated number in that case."""
    return {"count": count_all_generations(user_id)}


@app.post("/generate/drums")
def drums(req: GenerationRequest, request: Request, user_id: str = Depends(get_current_user_id)):
    req.user_id = user_id
    enforce_phase0(req, request.client.host if request.client else None)
    result = generate_drums(req)
    log_generation(req, "drums", result)
    return result


@app.post("/generate/bassline")
def bassline(req: GenerationRequest, request: Request, user_id: str = Depends(get_current_user_id)):
    req.user_id = user_id
    enforce_phase0(req, request.client.host if request.client else None)
    result = generate_bassline(req)
    log_generation(req, "bassline", result)
    return result


@app.post("/generate/melody")
def melody(req: GenerationRequest, request: Request, user_id: str = Depends(get_current_user_id)):
    req.user_id = user_id
    enforce_phase0(req, request.client.host if request.client else None)
    result = generate_melody(req)
    log_generation(req, "melody", result)
    return result


@app.post("/generate/chords")
def chords(req: GenerationRequest, request: Request, user_id: str = Depends(get_current_user_id)):
    req.user_id = user_id
    enforce_phase0(req, request.client.host if request.client else None)
    result = generate_chords(req)
    log_generation(req, "chords", result)
    return result


@app.post("/generate/arrangement")
def arrangement(req: GenerationRequest, request: Request, user_id: str = Depends(get_current_user_id)):
    req.user_id = user_id
    enforce_phase0(req, request.client.host if request.client else None)
    result = generate_arrangement(req)
    log_generation(req, "arrangement", result)
    return result


class PulseRequest(BaseModel):
    message: str
    conversationHistory: Optional[list] = None


@app.post("/pulse/chat")
async def pulse_chat(req: PulseRequest):
    try:
        reply = await get_pulse_reply(req.message, req.conversationHistory)
    except PulseUnavailable as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    return {"reply": reply}


class FeedbackRequest(BaseModel):
    accepted: bool
    genre: Optional[str] = None
    pattern: Dict[str, Any] = Field(default_factory=dict)


@app.post("/feedback")
def feedback(req: FeedbackRequest, user_id: str = Depends(get_current_user_id)):
    store_feedback(user_id, req.accepted, req.pattern, req.genre or "unknown")
    return {"status": "ok"}


class MidiRequest(BaseModel):
    midi_url: str


@app.post("/midi")
def midi(req: MidiRequest, user_id: str = Depends(get_current_user_id)):
    store_midi(user_id, req.midi_url)
    return {"status": "ok"}


class TrainingBatchRequest(BaseModel):
    batch_id: str


@app.post("/training/batch")
def training_batch(req: TrainingBatchRequest, user_id: str = Depends(get_current_user_id)):
    enqueue_training_batch(user_id, req.batch_id)
    return {"status": "ok"}


class SavedPatternRequest(BaseModel):
    id: str
    name: str
    genre: Optional[str] = None
    mood: Optional[str] = None
    style: Optional[str] = None
    pattern: Dict[str, Any]
    saved_at: Optional[str] = None


@app.post("/patterns")
def save_pattern_endpoint(req: SavedPatternRequest, user_id: str = Depends(get_current_user_id)):
    """Real server-side persistence for the saved-pattern library (S5 from
    the strategic review) -- previously localStorage-only. `saved: false`
    means it only saved locally (Supabase not configured or the write
    failed); the frontend keeps its localStorage copy either way, this is
    a best-effort durability layer, not the only copy."""
    saved = save_pattern(user_id, req.id, req.name, req.genre, req.mood, req.style, req.pattern, req.saved_at)
    return {"saved": saved}


@app.get("/patterns")
def list_patterns_endpoint(user_id: str = Depends(get_current_user_id)):
    """`patterns: null` means Supabase isn't configured or the query
    failed -- the frontend should fall back to its local copy, not treat
    that as "you have zero saved patterns"."""
    return {"patterns": list_saved_patterns(user_id)}


@app.delete("/patterns/{pattern_id}")
def delete_pattern_endpoint(pattern_id: str, user_id: str = Depends(get_current_user_id)):
    deleted = delete_saved_pattern(user_id, pattern_id)
    return {"deleted": deleted}
