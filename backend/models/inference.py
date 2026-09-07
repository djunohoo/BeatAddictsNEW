import logging
import random
import json
import os
from typing import Dict, Any

logger = logging.getLogger("beataddicts.inference")

# Load patterns from JSON file
PATTERNS_FILE = os.path.join(os.path.dirname(__file__), 'patterns.json')
try:
    with open(PATTERNS_FILE, 'r') as f:
        DRUM_PATTERNS = json.load(f)
except (OSError, json.JSONDecodeError):
    logger.exception("Failed to load drum patterns from %s; falling back to random generation for all requests", PATTERNS_FILE)
    DRUM_PATTERNS = {}


def _empty_pattern(length: int = 16) -> Dict[str, list]:
    return {
        "kick": [False] * length,
        "snare": [False] * length,
        "hihat": [False] * length,
        "openhat": [False] * length,
        "clap": [False] * length,
        "crash": [False] * length,
        "perc1": [False] * length,
    }


def _get_pattern(genre: str, mood: str) -> Dict[str, list]:
    """Get a pattern from the library, or return None if not found."""
    genre = genre or 'Electronic'
    mood = mood or 'Energetic'

    if genre in DRUM_PATTERNS and mood in DRUM_PATTERNS[genre]:
        patterns = DRUM_PATTERNS[genre][mood]
        if patterns:
            return random.choice(patterns)
    return None


def _convert_rich_pattern(pattern: Dict[str, list]) -> Dict[str, list]:
    """Convert rich pattern format to simple boolean format for compatibility."""
    simple_pattern = {}

    for track_name, steps in pattern.items():
        if track_name == 'meta':
            continue  # Skip meta data

        simple_pattern[track_name] = []
        for step in steps:
            if isinstance(step, dict):
                # Rich format: {"hit": true, "velocity": 1.0, "offset": 0.00}
                simple_pattern[track_name].append(step.get('hit', False))
            else:
                # Legacy format: just boolean
                simple_pattern[track_name].append(bool(step))

    return simple_pattern


def generate_drums(req) -> Dict[str, Any]:
    length = 16
    pattern = _get_pattern(req.genre, req.mood)

    if pattern is None:
        # Fallback: generate random with density
        density = max(0, min(100, req.density or 60)) / 100.0
        pattern = _empty_pattern(length)
        for track in pattern:
            pattern[track] = [random.random() < density for _ in range(length)]
    else:
        # Convert rich pattern to simple format
        pattern = _convert_rich_pattern(pattern)

    return {
        "bpm": 124,
        "pattern": {"length": length, "tracks": pattern},
        "meta": {"model": "drums_v2", "genre": req.genre, "mood": req.mood},
    }


def generate_bassline(req) -> Dict[str, Any]:
    # Simple bassline patterns based on genre
    basslines = {
        'Electronic': [36, 38, 40, 36],
        'Hip Hop': [36, 36, 40, 38],
        'House': [36, 36, 36, 36],
        'Trap': [36, 40, 36, 40],
        'Lo-Fi': [36, 38, 36, 38],
        'Ambient': [36, 36, 36, 36]
    }
    notes = basslines.get(req.genre, [36, 38, 40, 36])
    return {"notes": notes, "meta": {"model": "bass_v1", "genre": req.genre}}


def generate_melody(req) -> Dict[str, Any]:
    # Simple melodic patterns
    melodies = {
        'Electronic': [60, 62, 64, 65, 67, 65, 64, 62],
        'Hip Hop': [60, 60, 64, 67],
        'House': [62, 65, 67, 69],
        'Trap': [60, 63, 67, 70],
        'Lo-Fi': [60, 62, 60, 62],
        'Ambient': [60, 62, 67, 69]
    }
    notes = melodies.get(req.genre, [60, 62, 64, 65])
    return {"notes": notes, "meta": {"model": "melody_v1", "genre": req.genre}}


def generate_chords(req) -> Dict[str, Any]:
    # Genre-specific chord progressions
    progressions = {
        'Electronic': ["C", "F", "G", "C"],
        'Hip Hop': ["C", "C", "G", "C"],
        'House': ["A", "A", "E", "A"],
        'Trap': ["C", "G", "D", "A"],
        'Lo-Fi': ["C", "F", "C", "G"],
        'Ambient': ["Am", "F", "C", "G"]
    }
    chords = progressions.get(req.genre, ["C", "F", "G", "C"])
    return {"chords": chords, "meta": {"model": "chords_v1", "genre": req.genre}}


def generate_arrangement(req) -> Dict[str, Any]:
    sections = ["intro", "verse", "chorus", "verse",
                "chorus", "bridge", "chorus", "outro"]
    return {"sections": sections, "meta": {"model": "arrangement_v1", "genre": req.genre}}
