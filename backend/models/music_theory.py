import random
from typing import List, Tuple

NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

SCALES = {
    'major': [0, 2, 4, 5, 7, 9, 11],
    'minor': [0, 2, 3, 5, 7, 8, 10],  # natural minor
}

# Moods that put the generated material in a minor key; everything else is major.
MINOR_MOODS = {'Dark', 'Chill', 'Minimal'}

# A small pool of common diatonic progressions, expressed as scale degrees (0-indexed).
PROGRESSIONS = [
    [0, 3, 4, 0],  # I-IV-V-I
    [0, 4, 5, 3],  # I-V-vi-IV
    [5, 3, 0, 4],  # vi-IV-I-V
    [1, 4, 0, 0],  # ii-V-I-I
    [0, 5, 3, 4],  # I-vi-IV-V
]


def _stable_index(seed: str, mod: int) -> int:
    """Deterministic, non-cryptographic index from a string. Same inputs always
    produce the same output (so repeated requests with identical params are
    reproducible), while different genre/mood combinations spread across the
    available options instead of all collapsing to one default."""
    return sum(ord(c) for c in seed) % mod if mod else 0


def key_for(genre: str, mood: str) -> Tuple[int, List[int], bool]:
    """Pick a deterministic root pitch class and scale for a genre/mood pair."""
    genre = genre or 'Electronic'
    mood = mood or 'Energetic'
    root_pc = _stable_index(genre, 12)
    is_major = mood not in MINOR_MOODS
    scale = SCALES['major'] if is_major else SCALES['minor']
    return root_pc, scale, is_major


def scale_degree_semitone(root_pc: int, scale: List[int], degree: int) -> int:
    idx = degree % len(scale)
    octave_shift = 12 * (degree // len(scale))
    return root_pc + scale[idx] + octave_shift


def triad_quality(root_pc: int, scale: List[int], degree: int) -> str:
    root = scale_degree_semitone(root_pc, scale, degree)
    third = scale_degree_semitone(root_pc, scale, degree + 2)
    fifth = scale_degree_semitone(root_pc, scale, degree + 4)
    i1 = (third - root) % 12
    i2 = (fifth - third) % 12
    if i1 == 4 and i2 == 3:
        return 'major'
    if i1 == 3 and i2 == 4:
        return 'minor'
    if i1 == 3 and i2 == 3:
        return 'dim'
    return 'major'


def chord_symbol(root_pc: int, scale: List[int], degree: int, complexity: int) -> str:
    root_note = NOTE_NAMES[scale_degree_semitone(root_pc, scale, degree) % 12]
    quality = triad_quality(root_pc, scale, degree)
    suffix = {'major': '', 'minor': 'm', 'dim': 'dim'}[quality]
    extension = '7' if complexity > 66 else ''
    return f"{root_note}{suffix}{extension}"


def build_progression(genre: str, mood: str, complexity: int) -> List[int]:
    idx = _stable_index((genre or '') + (mood or ''), len(PROGRESSIONS))
    return PROGRESSIONS[idx]


def build_chords(genre: str, mood: str, complexity: int) -> List[str]:
    complexity = max(0, min(100, complexity or 50))
    root_pc, scale, _ = key_for(genre, mood)
    progression = build_progression(genre, mood, complexity)
    return [chord_symbol(root_pc, scale, deg, complexity) for deg in progression]


def build_melody(genre: str, mood: str, complexity: int, density: int, base_octave: int = 60) -> List[int]:
    complexity = max(0, min(100, complexity or 50))
    density = max(0, min(100, density or 50))
    root_pc, scale, _ = key_for(genre, mood)

    rng = random.Random((genre or '') + (mood or '') + str(complexity) + str(density) + 'melody')
    length = 4 + round(density / 100 * 8)  # 4..12 notes
    max_step = 1 if complexity < 33 else (2 if complexity < 66 else 4)

    notes = []
    degree = 0
    span = len(scale) * 2  # keep the walk within a two-octave range
    for _ in range(length):
        degree += rng.randint(-max_step, max_step)
        degree = max(0, min(degree, span - 1))
        notes.append(base_octave + scale_degree_semitone(root_pc, scale, degree))
    return notes


def build_bassline(genre: str, mood: str, complexity: int, density: int, base_octave: int = 36) -> List[int]:
    complexity = max(0, min(100, complexity or 50))
    density = max(0, min(100, density or 50))
    root_pc, scale, _ = key_for(genre, mood)
    progression = build_progression(genre, mood, complexity)

    rng = random.Random((genre or '') + (mood or '') + str(complexity) + str(density) + 'bass')
    length = 4 + round(density / 100 * 4)  # 4..8 notes

    notes = []
    for i in range(length):
        degree = progression[i % len(progression)]
        note = base_octave + scale_degree_semitone(root_pc, scale, degree)
        if complexity > 66 and i % 2 == 1:
            # walking-bass style chromatic/scalar approach tone into the next chord
            note += rng.choice([-2, -1, 1, 2])
        notes.append(note)
    return notes


def build_arrangement(complexity: int) -> List[str]:
    complexity = max(0, min(100, complexity or 50))
    if complexity < 33:
        return ["intro", "verse", "chorus", "outro"]
    if complexity < 66:
        return ["intro", "verse", "chorus", "verse", "chorus", "outro"]
    return ["intro", "verse", "chorus", "verse", "chorus", "bridge", "chorus", "outro"]
