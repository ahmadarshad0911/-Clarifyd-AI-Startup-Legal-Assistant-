from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


_COMMON_RULES = """Rules for every reply:
- Plain English, founder-first, concise. Plain text only — no markdown headers.
- Suggest market-standard defaults where relevant (e.g. "seed SAFEs commonly use a 20% discount").
- If asked for jurisdiction-specific legal opinions, refuse and recommend licensed counsel.
- Never claim to be a lawyer. Never call a document "legally binding" or "ready to sign"
  without recommending attorney review.
- End any reply involving a real legal decision with a one-line reminder that this is
  decision-support, not legal advice."""

TEMPLATE_PROMPT = (
    """You are "Clarifyd Assistant", a Legal Co-Pilot inside Clarifyd helping a startup founder
build a legal document from a known template.

- Guide the founder through the deal terms needed to complete the selected template.
- Ask ONE focused question at a time about the next missing term.
- When the founder gives a value, acknowledge it briefly and move to the next term.
- Explain legal concepts in 2-4 sentences max.

"""
    + _COMMON_RULES
)

CUSTOM_PROMPT = (
    """You are "Clarifyd Assistant", a Legal Co-Pilot inside Clarifyd helping a startup founder
design a CUSTOM legal document that does not exist as a pre-built template.

- First, confirm the document's purpose, the parties, and the jurisdiction context.
- Then walk the founder through the key clauses such a document should contain, ONE at a time,
  asking for the specific terms you need.
- Explain why each clause matters in 2-4 sentences.
- Track what has been collected so a complete draft can be generated later.

"""
    + _COMMON_RULES
)

CHAT_PROMPT = (
    """You are "Clarifyd Assistant", a Legal Co-Pilot and startup advisor inside Clarifyd.
You answer general legal, contract, fundraising, hiring, IP, and compliance questions for
startup founders — acting as a knowledgeable guide, not a document builder.

- Answer the founder's question directly and practically.
- Use concrete examples and market norms where helpful.
- Keep replies focused; ask a clarifying question only when the answer truly depends on it.
- Point to the relevant Clarifyd tool when useful (Contract analysis, Smart Builder templates).

"""
    + _COMMON_RULES
)

_PROMPTS = {
    "template": TEMPLATE_PROMPT,
    "custom": CUSTOM_PROMPT,
    "chat": CHAT_PROMPT,
}

DISCLAIMER = (
    "Clarifyd Assistant is an AI tool, not a law firm. Consult a qualified attorney before "
    "executing any document."
)


class CopilotAdvisor:
    def __init__(
        self,
        *,
        client: httpx.AsyncClient,
        api_key: str | None,
        model: str,
        base_url: str,
        timeout: float = 90.0,
    ) -> None:
        self._client = client
        self._api_key = api_key or ""
        self._model = model
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

    @property
    def model(self) -> str:
        return self._model

    async def chat(
        self,
        *,
        template: str,
        history: list[dict[str, str]],
        message: str,
        mode: str = "template",
    ) -> str:
        if not self._api_key:
            return (
                "The reasoning model is not configured yet — set REASONING_API_KEY in the "
                "backend .env to enable Clarifyd Assistant. " + DISCLAIMER
            )

        system_prompt = _PROMPTS.get(mode, TEMPLATE_PROMPT)
        if mode == "chat":
            context = "The founder is asking general startup guidance questions."
        elif mode == "custom":
            context = f"The founder is designing a custom document: '{template}'."
        else:
            context = f"The founder is building a '{template}' document. Help them complete it."

        messages: list[dict[str, str]] = [
            {"role": "system", "content": system_prompt},
            {"role": "system", "content": context},
        ]
        # Only keep role/content pairs we trust.
        for turn in history[-12:]:
            role = turn.get("role")
            content = turn.get("content", "")
            if role in {"user", "assistant"} and content:
                messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": message})

        body: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 1024,
        }
        url = f"{self._base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        try:
            response = await self._client.post(
                url, json=body, headers=headers, timeout=self._timeout
            )
        except httpx.HTTPError as exc:
            logger.error("CopilotAdvisor HTTP error %s: %r", type(exc).__name__, exc)
            return (
                "I couldn't reach the reasoning model just now. Try again in a moment. "
                + DISCLAIMER
            )
        if response.status_code >= 400:
            logger.error(
                "CopilotAdvisor HTTP %s: %s", response.status_code, response.text[:300]
            )
            return (
                "The reasoning model returned an error. Try again shortly. " + DISCLAIMER
            )
        try:
            payload = response.json()
            content = payload["choices"][0]["message"]["content"]
            return str(content).strip()
        except (KeyError, ValueError, TypeError) as exc:
            logger.error("CopilotAdvisor parse error: %s", exc)
            return "I got an unexpected response from the model. Try again. " + DISCLAIMER
