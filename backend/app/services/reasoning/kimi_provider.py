from __future__ import annotations

from app.services.reasoning.openai_provider import OpenAIProvider


class KimiProvider(OpenAIProvider):
    """Kimi exposes an OpenAI-compatible API; only the base URL differs."""

    name = "kimi"
