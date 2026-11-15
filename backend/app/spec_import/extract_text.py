import io
import os

from docx import Document
from pypdf import PdfReader


class UnsupportedFileType(ValueError):
    pass


class EmptyDocument(ValueError):
    pass


def extract_text(filename: str, data: bytes) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext in (".md", ".txt"):
        text = data.decode("utf-8", errors="replace")
    elif ext == ".docx":
        document = Document(io.BytesIO(data))
        parts = [p.text for p in document.paragraphs]
        for table in document.tables:
            for row in table.rows:
                parts.append(" | ".join(cell.text for cell in row.cells))
        text = "\n".join(parts)
    elif ext == ".pdf":
        reader = PdfReader(io.BytesIO(data))
        raw = "\n".join(page.extract_text(extraction_mode="layout") or "" for page in reader.pages)
        text = "\n".join(" ".join(line.split()) for line in raw.splitlines() if line.strip())
    else:
        raise UnsupportedFileType(f"Unsupported File Type: {ext}")
    if not text.strip():
        raise EmptyDocument("Document is Empty")
    return text
