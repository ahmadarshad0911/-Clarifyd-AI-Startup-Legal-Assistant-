import re
import zipfile
from html import unescape
from io import BytesIO
from pathlib import Path

from pypdf import PdfReader


class ContractTextExtractor:
    def extract_text(self, file_name: str, file_bytes: bytes) -> str:
        extension = Path(file_name).suffix.lower()

        if extension == ".pdf":
            return self._extract_pdf_text(file_bytes)
        if extension == ".docx":
            return self._extract_docx_text(file_bytes)
        if extension == ".txt":
            text = file_bytes.decode("utf-8", errors="ignore").strip()
            if not text:
                raise ValueError("Uploaded text file is empty")
            return text

        raise ValueError(f"Unsupported extraction type: {extension or 'none'}")

    def _extract_pdf_text(self, file_bytes: bytes) -> str:
        reader = PdfReader(BytesIO(file_bytes))
        text = "\n".join((page.extract_text() or "") for page in reader.pages).strip()
        if not text:
            raise ValueError("Unable to extract text from PDF")
        return text

    def _extract_docx_text(self, file_bytes: bytes) -> str:
        with zipfile.ZipFile(BytesIO(file_bytes)) as docx:
            xml = docx.read("word/document.xml").decode("utf-8", errors="ignore")
        fragments = [unescape(chunk) for chunk in re.findall(r"<w:t[^>]*>(.*?)</w:t>", xml)]
        text = " ".join(fragment for fragment in fragments if fragment).strip()
        if not text:
            raise ValueError("Unable to extract text from DOCX")
        return text
