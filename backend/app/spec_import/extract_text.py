import os
import io
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
        text = "\n".join(p.text for p in document.paragraphs)
    elif ext == ".pdf":
        reader = PdfReader(io.BytesIO(data))
        text = "\n".join(page.extract_text() for page in reader.pages)
    else:
        raise UnsupportedFileType(f"Unsupported File Type: {ext}")
    if not text.strip():
        raise EmptyDocument("Document is Empty")
    return text
