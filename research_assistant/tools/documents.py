"""Document loading tool: reads a PDF or text file into chunked plain text."""

import os

from langchain_core.tools import tool
from langchain_text_splitters import RecursiveCharacterTextSplitter

TEXT_EXTENSIONS = (".txt", ".md", ".csv")
CHUNK_SIZE = 2000
CHUNK_OVERLAP = 200


def _extract_text(file_path: str, ext: str) -> str:
    """Read raw text from a supported file. Raises ValueError for unsupported types."""
    if ext == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(file_path)
        return "\n".join(page.extract_text() or "" for page in reader.pages)

    if ext in TEXT_EXTENSIONS:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()

    raise ValueError(f"Unsupported file type: {ext}. Supported: .pdf, {', '.join(TEXT_EXTENSIONS)}")


@tool
def load_document(file_path: str) -> str:
    """Load a PDF or text file and return its contents split into overlapping chunks."""
    if not os.path.exists(file_path):
        return f"File not found: {file_path}"

    ext = os.path.splitext(file_path)[1].lower()

    try:
        text = _extract_text(file_path, ext)
    except ValueError as e:
        return str(e)
    except Exception as e:
        # Reported as text so the agent can move on to the next document.
        return f"Error loading {file_path}: {e}"

    if not text.strip():
        return f"File is empty or no text could be extracted: {file_path}"

    # Chunking keeps large documents from overflowing the model's context window.
    chunks = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
    ).split_text(text)

    name = os.path.basename(file_path)
    parts = [f"Loaded {len(chunks)} chunk(s) from: {name}\n"]
    parts += [f"--- Chunk {i}/{len(chunks)} ---\n{chunk}" for i, chunk in enumerate(chunks, 1)]
    return "\n\n".join(parts)
