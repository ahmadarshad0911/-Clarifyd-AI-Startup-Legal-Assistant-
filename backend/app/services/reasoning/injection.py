from __future__ import annotations

import re

_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.IGNORECASE)
    for p in (
        r"ignore (?:all )?(?:previous|prior|above) instructions",
        r"disregard (?:the )?(?:system|prior) prompt",
        r"\bsystem\s*:\s*",
        r"\bassistant\s*:\s*",
        r"act as (?:a )?(?:different|new) (?:assistant|model)",
        r"reveal (?:the )?(?:system )?prompt",
        r"</?clause>",
    )
)


def detect_injection(clause_text: str) -> bool:
    """Cheap heuristic: True if the clause contains common prompt-injection markers."""
    if not clause_text:
        return False
    for pattern in _PATTERNS:
        if pattern.search(clause_text):
            return True
    return False
