from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
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
You answer ONLY questions about: contracts, clauses, term sheets, SAFEs, NDAs, MSAs,
licenses, leases, employment offers, fundraising, equity / vesting / cap tables, IP
(patents, trademarks, copyright), data privacy / compliance (GDPR, CCPA, HIPAA),
hiring / firing / severance, vendor and customer relationships, and other startup
legal and business operations.

OUT OF SCOPE — refuse politely if asked: writing code or scripts (Python, JavaScript,
etc.), math / arithmetic problems, recipes, jokes, poems, weather, translation,
general trivia, sports, entertainment. For any out-of-scope request, reply with
exactly:

"I can only help with legal, contract, and startup-operations questions. Ask me
about a clause, a deal term, an HR policy, an IP question, a compliance topic, or
how to read a SAFE / MSA / NDA — and I'll dig in."

Do NOT provide any code, math result, recipe, or non-legal output even if the
founder insists. Refusal is the correct answer for those.

For IN-scope questions:
- Answer directly and practically.
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


class OffTopicQuestion(Exception):
    """Raised by CopilotAdvisor when the user's question isn't contract / legal /
    startup related (e.g. 'print an array from 1 to 10'). Caller maps this to a
    422 AppError with code=off_topic_question.
    """

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


_ON_TOPIC_KEYWORDS = (
    "contract", "agreement", "clause", "term", "sheet", "safe", "nda",
    "msa", "sow", "lease", "license", "employ", "hire", "fire", "ip",
    "intellectual", "patent", "trademark", "copyright", "confidential",
    "indemnif", "liabilit", "warrant", "covenant", "represent", "breach",
    "terminat", "jurisdiction", "govern", "arbitrat", "litigat", "lawsuit",
    "founder", "investor", "fundrais", "equity", "vesting", "cliff",
    "valuation", "preferred", "common", "stock", "share", "option",
    "convertible", "note", "preemptive", "drag-along", "tag-along",
    "compliance", "regul", "gdpr", "ccpa", "hipaa", "tax", "audit",
    "startup", "company", "corporation", "llc", "incorpor", "delaware",
    "merger", "acquisition", "due diligence", "term sheet", "rofr",
    "non-compete", "non-solicit", "severance", "offer letter",
    "vendor", "supplier", "client", "customer", "subscription", "saas",
    "data", "privacy", "security", "policy", "dispute", "advice",
    "legal", "lawyer", "attorney", "counsel",
)

_OFF_TOPIC_BLOCK_PATTERNS = (
    "print", "loop", "array", "for loop", "while loop", "function",
    "code", "script", "compile", "python", "javascript", "java ",
    "typescript", "html", "css", "sql query", "regex", "algorithm",
    "recipe", "cook", "weather", "joke", "poem", "story", "translate",
    "math problem", "calculate", "calculator",
)


_REFUSAL_SIGNATURE = (
    "i can only help with legal, contract, and startup-operations questions"
)


def _is_refusal_reply(reply: str) -> bool:
    return _REFUSAL_SIGNATURE in reply.lower()


def _is_off_topic(message: str) -> tuple[bool, str]:
    """Cheap heuristic gate. Returns (is_off_topic, reason).

    Uses word-boundary matching so short stems like 'ip' don't
    substring-match inside unrelated words ('script', 'recipe', 'ship').
    """
    import re as _re

    lower = message.lower().strip()
    if not lower:
        return True, "Empty message."

    def hits(patterns: tuple[str, ...]) -> int:
        n = 0
        for p in patterns:
            # Multi-word phrases match as substrings; single tokens require
            # a word boundary so 'ip' doesn't match 'script'.
            if " " in p or "-" in p:
                if p in lower:
                    n += 1
            elif _re.search(rf"\b{_re.escape(p)}\w*", lower):
                n += 1
        return n

    on_hits = hits(_ON_TOPIC_KEYWORDS)
    off_hits = hits(_OFF_TOPIC_BLOCK_PATTERNS)
    if off_hits >= 1 and on_hits == 0:
        return (
            True,
            "Clarifyd Co-Pilot only answers questions about contracts, legal terms, "
            "fundraising, hiring, IP, and startup operations.",
        )
    return False, ""


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
        # Off-topic gate runs first so we never burn an LLM call on
        # "print an array from 1 to 10" style requests. Skip for non-chat
        # modes — template / custom flows are already scoped by definition.
        if mode == "chat":
            off, reason = _is_off_topic(message)
            if off:
                raise OffTopicQuestion(reason)

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
            "max_tokens": 700,
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
            reply = str(content).strip()
        except (KeyError, ValueError, TypeError) as exc:
            logger.error("CopilotAdvisor parse error: %s", exc)
            return "I got an unexpected response from the model. Try again. " + DISCLAIMER

        # Server-side detection of the canonical refusal sentinel. If the
        # model decided the request was out of scope, surface it as a
        # structured 422 so the frontend can pop the themed modal instead
        # of rendering refusal text as a normal assistant reply.
        if mode == "chat" and _is_refusal_reply(reply):
            raise OffTopicQuestion(
                "Clarifyd Co-Pilot only answers contract, legal, and startup-operations questions."
            )
        return reply

    def off_topic_reason(self, message: str, mode: str) -> str | None:
        """Return the off-topic reason for a chat message, else None.

        Lets the streaming route reject out-of-scope questions BEFORE the
        response stream opens (can't cleanly send a 422 mid-stream).
        """
        if mode != "chat":
            return None
        off, reason = _is_off_topic(message)
        return reason if off else None

    def _build_messages(
        self, *, template: str, history: list[dict[str, str]], message: str, mode: str
    ) -> list[dict[str, str]]:
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
        for turn in history[-12:]:
            role = turn.get("role")
            content = turn.get("content", "")
            if role in {"user", "assistant"} and content:
                messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": message})
        return messages

    async def chat_stream(
        self,
        *,
        template: str,
        history: list[dict[str, str]],
        message: str,
        mode: str = "template",
    ) -> AsyncIterator[str]:
        """Stream the reply token-by-token. Off-topic gating is the caller's
        job (run off_topic_reason before opening the stream)."""
        if not self._api_key:
            yield (
                "The reasoning model is not configured yet — set REASONING_API_KEY in the "
                "backend .env to enable Clarifyd Assistant. " + DISCLAIMER
            )
            return

        body: dict[str, Any] = {
            "model": self._model,
            "messages": self._build_messages(
                template=template, history=history, message=message, mode=mode
            ),
            "temperature": 0.3,
            "max_tokens": 700,
            "stream": True,
        }
        url = f"{self._base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        try:
            async with self._client.stream(
                "POST", url, json=body, headers=headers, timeout=self._timeout
            ) as resp:
                if resp.status_code >= 400:
                    yield "The reasoning model returned an error. Try again shortly. " + DISCLAIMER
                    return
                async for line in resp.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[len("data:"):].strip()
                    if data == "[DONE]":
                        break
                    try:
                        obj = json.loads(data)
                    except ValueError:
                        continue
                    if isinstance(obj, dict) and obj.get("error"):
                        logger.error("CopilotAdvisor stream provider error: %s", obj["error"])
                        yield "The reasoning model returned an error. Try again shortly. " + DISCLAIMER
                        return
                    try:
                        delta = obj["choices"][0]["delta"].get("content")
                    except (KeyError, TypeError, IndexError):
                        continue
                    if delta:
                        yield delta
        except httpx.HTTPError as exc:
            logger.error("CopilotAdvisor stream error %s: %r", type(exc).__name__, exc)
            yield "I couldn't reach the reasoning model just now. Try again in a moment. " + DISCLAIMER
