from __future__ import annotations

import io

import pytest

from app.services.letterhead import render_on_letterhead, validate_letterhead


def _a4_pdf() -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.drawString(72, 800, "ACME INC")
    c.showPage()
    c.save()
    return buf.getvalue()


def _letter_pdf() -> bytes:
    from reportlab.lib.pagesizes import LETTER
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=LETTER)
    c.drawString(72, 72, "x")
    c.showPage()
    c.save()
    return buf.getvalue()


def _a4_docx() -> bytes:
    from docx import Document
    from docx.shared import Mm

    doc = Document()
    section = doc.sections[0]
    section.page_width = Mm(210)
    section.page_height = Mm(297)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def test_validate_accepts_a4_pdf():
    meta = validate_letterhead("acme.pdf", _a4_pdf())
    assert meta.kind == "pdf"


def test_validate_accepts_a4_docx():
    meta = validate_letterhead("acme.docx", _a4_docx())
    assert meta.kind == "docx"


def test_validate_rejects_non_a4_pdf():
    with pytest.raises(ValueError, match="A4"):
        validate_letterhead("letter.pdf", _letter_pdf())


def test_validate_rejects_wrong_type():
    with pytest.raises(ValueError, match="PDF or Word"):
        validate_letterhead("note.txt", b"just some text, not a document at all")


def test_render_pdf_letterhead_returns_pdf():
    letterhead = _a4_pdf()
    data, _mime, ext = render_on_letterhead("pdf", letterhead, "NDA", "Body clause. " * 200)
    assert ext == "pdf" and data[:5] == b"%PDF-"


def test_render_docx_letterhead_returns_docx():
    letterhead = _a4_docx()
    data, _mime, ext = render_on_letterhead("docx", letterhead, "Offer", "Dear founder,\n\nWelcome.")
    assert ext == "docx" and data[:4] == b"PK\x03\x04"
