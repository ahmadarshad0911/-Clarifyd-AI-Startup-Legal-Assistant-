from io import BytesIO
import zipfile

import pytest

from app.services.contract_text_extractor import ContractTextExtractor


def test_extract_text_from_txt_file() -> None:
    extractor = ContractTextExtractor()
    text = extractor.extract_text("sample.txt", b"Confidentiality clause applies.\nPayment is net 30.")
    assert "Confidentiality" in text


def test_extract_text_from_docx_file() -> None:
    extractor = ContractTextExtractor()
    xml = (
        "<w:document xmlns:w='http://schemas.openxmlformats.org/wordprocessingml/2006/main'>"
        "<w:body><w:p><w:r><w:t>Termination notice is 30 days.</w:t></w:r></w:p></w:body></w:document>"
    )
    content = BytesIO()
    with zipfile.ZipFile(content, mode="w") as archive:
        archive.writestr("word/document.xml", xml)

    text = extractor.extract_text("sample.docx", content.getvalue())
    assert "Termination notice is 30 days." in text


def test_extract_text_rejects_unsupported_extension() -> None:
    extractor = ContractTextExtractor()
    with pytest.raises(ValueError, match="Unsupported extraction type"):
        extractor.extract_text("sample.csv", b"some,data")
