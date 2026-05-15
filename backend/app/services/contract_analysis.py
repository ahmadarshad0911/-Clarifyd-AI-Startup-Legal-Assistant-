import re

from app.contracts.analysis import (
    ClauseRiskFinding,
    ClauseType,
    CustomReasoningModelProtocol,
    ContractAnalysisResult,
    ExtractedClause,
)
from app.services.custom_reasoning_model import CustomReasoningModel


class ContractAnalysisService:
    MIN_CLAUSE_WORDS = 5
    CONTEXT_SENTENCES = 1  # one clean sentence per clause (no fragments)

    def __init__(self, reasoning_model: CustomReasoningModelProtocol | None = None) -> None:
        self._reasoning_model = reasoning_model or CustomReasoningModel()

    def extract_clauses(self, contract_text: str) -> list[ExtractedClause]:
        normalized_text = " ".join(contract_text.split())
        if not normalized_text:
            raise ValueError("Contract text is empty")

        sentences = [
            s.strip()
            for s in re.split(r"(?<=[.!?])\s+|[\r\n]+", contract_text)
            if s.strip()
        ]

        # Pre-pass: a short "heading" line that carries a category keyword
        # (e.g. "LIMITATION OF LIABILITY", "1. Indemnification") gets fused
        # with the following sentence so the body inherits the heading's
        # category even when the body lacks the keyword.
        fused: list[str] = []
        carry: str | None = None
        for sentence in sentences:
            short = len(sentence.split()) < self.MIN_CLAUSE_WORDS
            ctype_only, _ = self._reasoning_model.classify_clause(sentence)
            if short and ctype_only is not ClauseType.uncategorized:
                # heading with category keyword — carry forward
                carry = (carry + " " + sentence) if carry else sentence
                continue
            if carry:
                fused.append(carry + " " + sentence)
                carry = None
            else:
                fused.append(sentence)
        if carry:
            fused.append(carry)

        # Step 1: classify each fused sentence.
        classified: list[tuple[ClauseType, float, str]] = []
        for sentence in fused:
            ctype, conf = self._reasoning_model.classify_clause(sentence)
            classified.append((ctype, conf, sentence))

        # Step 2: merge a categorized sentence with any contiguous follow-on
        # sentences of the same category OR uncategorized continuation sentences,
        # so a clause like "Termination: ... Customer has no right to cure." stays whole.
        # Stop merging when a different category appears.
        merged: list[tuple[ClauseType, float, str]] = []
        i = 0
        while i < len(classified):
            ctype, conf, text = classified[i]
            if ctype is ClauseType.uncategorized:
                i += 1
                continue
            buf = [text]
            best_conf = conf
            j = i + 1
            while j < len(classified):
                next_type, next_conf, next_text = classified[j]
                if next_type is ctype:
                    buf.append(next_text)
                    best_conf = max(best_conf, next_conf)
                    j += 1
                    continue
                if next_type is ClauseType.uncategorized:
                    # Skip list-marker fragments ("2.", "i.", "(a)"); absorb
                    # only real continuation prose with enough content.
                    stripped = re.sub(r"[^A-Za-z]+", " ", next_text).strip()
                    if len(stripped.split()) >= 3:
                        buf.append(next_text)
                        j += 1
                        continue
                    j += 1
                    continue
                break
            merged.append((ctype, best_conf, " ".join(buf)))
            i = j

        # Step 3: emit clauses, dropping anything under the word floor.
        clauses: list[ExtractedClause] = []
        cursor = 0
        index = 0
        for ctype, conf, chunk in merged:
            if len(chunk.split()) < self.MIN_CLAUSE_WORDS:
                continue
            start_offset = contract_text.find(chunk, cursor)
            if start_offset < 0:
                start_offset = cursor
            end_offset = start_offset + len(chunk)
            cursor = end_offset
            index += 1
            clauses.append(
                ExtractedClause(
                    clause_id=f"clause-{index}",
                    clause_type=ctype,
                    text=chunk,
                    start_offset=start_offset,
                    end_offset=end_offset,
                    confidence=conf,
                )
            )
        return clauses

    def score_risks(self, clauses: list[ExtractedClause]) -> list[ClauseRiskFinding]:
        return [self._reasoning_model.assess_clause(clause) for clause in clauses]

    def analyze_text(self, contract_text: str) -> ContractAnalysisResult:
        clauses = self.extract_clauses(contract_text)
        findings = self.score_risks(clauses)
        summary = self._reasoning_model.summarize(findings)

        return ContractAnalysisResult(
            clauses=clauses,
            findings=findings,
            summary=summary,
        )

