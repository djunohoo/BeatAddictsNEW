import logging
import os
from typing import List, Optional

import httpx

logger = logging.getLogger("beataddicts.pulse")

SYSTEM_PROMPT = """You are Pulse, an energetic and knowledgeable music production assistant for Beat Addicts DAW. You help users with:
- Music theory and composition
- Sound design and mixing techniques
- Beat making and rhythm programming
- Genre-specific production tips
- Creative workflow suggestions
- Technical troubleshooting

Keep responses concise (2-3 sentences), friendly, and actionable. Use music production terminology but explain complex concepts simply. Be encouraging and inspire creativity."""


class PulseUnavailable(Exception):
    """Raised when the upstream AI chat provider can't be reached or isn't configured."""


DEFAULT_MODEL = os.getenv("ONSPACE_AI_MODEL", "qwen3:14b")


async def get_pulse_reply(message: str, conversation_history: Optional[List[dict]]) -> str:
    base_url = os.getenv("ONSPACE_AI_BASE_URL")
    api_key = os.getenv("ONSPACE_AI_API_KEY")

    if not base_url:
        raise PulseUnavailable("AI service not configured")

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend((conversation_history or [])[-6:])
    messages.append({"role": "user", "content": message})

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers=headers,
                json={
                    "model": DEFAULT_MODEL,
                    "messages": messages,
                    "temperature": 0.8,
                    "max_tokens": 200,
                },
            )
        response.raise_for_status()
    except httpx.HTTPError:
        logger.exception("Pulse chat upstream request failed")
        raise PulseUnavailable("Failed to reach AI service")

    data = response.json()
    choices = data.get("choices") or []
    if not choices or "message" not in choices[0] or "content" not in choices[0]["message"]:
        logger.error("Pulse chat upstream returned an unexpected response shape: %r", data)
        raise PulseUnavailable("AI service returned no content")

    return choices[0]["message"]["content"]
