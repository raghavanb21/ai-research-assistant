import os
import re
import uuid
from typing import Any, Dict, List, Optional
import pymupdf
from app.config import settings


class PDFExtractionService:
    """
    Local, deterministic PDF text and metadata extraction service using PyMuPDF.
    Operates 100% offline with zero external network communication and zero data leakage.
    """

    AFFILIATION_KEYWORDS = {
        "university", "department", "institute", "laboratory", "lab", "school",
        "college", "faculty", "center", "centre", "corporation", "inc", "ltd",
        "google", "meta", "meta ai", "microsoft", "amazon", "apple", "ibm",
        "openai", "deepmind", "berkeley", "stanford", "mit", "cmu", "harvard",
        "oxford", "cambridge", "research", "technology", "technologies",
        "sciences", "engineering", "robotics", "division", "campus", "group",
        "hospital", "association", "society", "consortium"
    }

    HEADER_METADATA_PATTERNS = [
        r'arxiv:\s*\d{4}\.\d{4,5}(?:v\d+)?',
        r'\[[a-zA-Z\-]+(?:\.[a-zA-Z\-]+)?\]',  # [cs.CL], [stat.ML]
        r'\b(?:preprint|under review|proceedings of|conference|journal of|ieee|acm|springer|elsevier|nature|science|neurips|icml|iclr|aaai|acl|emnlp|cvpr|iccv|eccv)\b',
        r'\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}\b',
        r'https?://[^\s]+',
        r'\bdoi:\s*10\.\d{4,9}/[^\s]+',
        r'\b(?:vol\.|volume|no\.|number|pp\.|pages|issn|isbn)\b',
        r'©|\bcopyright\b|\ball rights reserved\b'
    ]

    @classmethod
    def is_header_or_metadata(cls, text: str) -> bool:
        """Determines if a text string is a journal header, arXiv watermark, date, or metadata banner."""
        if not text or not text.strip():
            return True
        t_clean = text.lower().strip()
        for pat in cls.HEADER_METADATA_PATTERNS:
            if re.search(pat, t_clean, re.IGNORECASE):
                return True
        return False

    @classmethod
    def extract_pdf_data(cls, file_bytes: bytes, original_filename: str) -> Dict[str, Any]:
        """
        Parses raw PDF bytes and extracts:
        - title (via font-size spans on page 1, filtering out watermarks/headers)
        - authors (via layout block text between title & abstract, filtered for affiliations)
        - publication_year (via metadata date and regex on page text)
        - abstract (via section boundaries following 'Abstract')
        - full_text (page-by-page concatenated text)
        - page_count, doi, arxiv_id, warning
        """
        if not file_bytes:
            raise ValueError("Uploaded file is empty.")

        try:
            doc = pymupdf.open(stream=file_bytes, filetype="pdf")
        except Exception as e:
            raise ValueError(f"Failed to parse PDF document: {str(e)}")

        page_count = len(doc)
        if page_count == 0:
            raise ValueError("PDF document contains 0 pages.")

        # Extract full body text page-by-page
        page_texts: List[str] = []
        for i, page in enumerate(doc):
            text = page.get_text("text").strip()
            if text:
                page_texts.append(f"--- Page {i+1} ---\n{text}")

        full_text = "\n\n".join(page_texts).strip()
        doc_metadata = doc.metadata or {}

        # Check for scanned / image-only PDF
        warning: Optional[str] = None
        if len(full_text) < 100:
            warning = "This document appears to be a scanned bitmap or has no selectable text layer. Extracted content may be limited."

        # Extract Title, Authors, Year, Abstract using page 1 layout and heuristics
        page0 = doc[0]
        title = cls._extract_title(page0, doc_metadata, original_filename)
        authors = cls._extract_authors(page0, title, doc_metadata)
        abstract = cls._extract_abstract(page0, full_text)
        year = cls._extract_year(full_text, doc_metadata)
        doi = cls._extract_doi(full_text)
        arxiv_id = cls._extract_arxiv_id(full_text)

        return {
            "title": title,
            "authors": authors,
            "publication_year": year,
            "abstract": abstract,
            "full_text": full_text,
            "page_count": page_count,
            "doi": doi,
            "arxiv_id": arxiv_id,
            "warning": warning
        }

    @classmethod
    def _extract_title(cls, page0: Any, metadata: Dict[str, Any], filename: str) -> str:
        """
        Heuristic: The title of an academic paper is rendered with the largest font size
        in the upper portion of Page 1, distinct from header watermarks.
        """
        try:
            blocks = page0.get_text("dict").get("blocks", [])
            spans = []
            for b in blocks:
                if b.get("type") == 0:  # text block
                    for line in b.get("lines", []):
                        for span in line.get("spans", []):
                            txt = span.get("text", "").strip()
                            size = span.get("size", 0.0)
                            bbox = span.get("bbox", (0, 0, 0, 0))
                            # Filter out empty spans or pure header metadata
                            if txt and len(re.sub(r'[^a-zA-Z0-9]', '', txt)) > 0:
                                if not cls.is_header_or_metadata(txt):
                                    spans.append({
                                        "text": txt,
                                        "size": size,
                                        "y0": bbox[1],
                                        "y1": bbox[3],
                                        "x0": bbox[0]
                                    })

            if spans:
                # Find maximum font size among non-header spans in the upper 65% of page
                valid_spans = [s for s in spans if s["y0"] < (page0.rect.height * 0.65)]
                if valid_spans:
                    max_size = max(s["size"] for s in valid_spans)
                    # Keep spans sharing the largest font size (within 1.5pt to handle small font variations)
                    title_spans = [
                        s["text"] for s in valid_spans
                        if abs(s["size"] - max_size) <= 1.5
                    ]
                    candidate_title = " ".join(title_spans).strip()
                    candidate_title = re.sub(r'\s+', ' ', candidate_title)
                    # Validate candidate title isn't a single keyword or header
                    if len(candidate_title) >= 5 and not cls.is_header_or_metadata(candidate_title):
                        # Clean trailing colons, dashes
                        candidate_title = candidate_title.rstrip(" -:")
                        return candidate_title
        except Exception:
            pass

        # Fallback 1: Document metadata title (if clean and not a filename/arXiv stamp)
        meta_title = metadata.get("title", "").strip()
        if (
            meta_title 
            and len(meta_title) >= 5 
            and not meta_title.lower().endswith(".pdf")
            and not cls.is_header_or_metadata(meta_title)
        ):
            return re.sub(r'\s+', ' ', meta_title)

        # Fallback 2: Cleaned original filename
        cleaned = re.sub(r'\.pdf$', '', filename, flags=re.IGNORECASE)
        cleaned = re.sub(r'[-_]+', ' ', cleaned).strip()
        return cleaned.title() if cleaned else "Untitled Uploaded Paper"

    @classmethod
    def _extract_authors(cls, page0: Any, title: str, metadata: Dict[str, Any]) -> List[str]:
        """
        Extracts author names from Page 1 text located between the title and the Abstract heading.
        Filters out institutional affiliations, university departments, emails, and header stamps.
        """
        authors: List[str] = []
        try:
            page_text = page0.get_text("text")
            lines = [l.strip() for l in page_text.split("\n") if l.strip()]

            # Normalized title alphanumeric token for exact line matching
            title_tokens = set(re.findall(r'\w+', title.lower())) if title else set()

            # Find lines after title and before Abstract
            author_lines: List[str] = []
            past_title = False

            for line in lines:
                if cls.is_header_or_metadata(line):
                    continue

                line_tokens = set(re.findall(r'\w+', line.lower()))
                # If this line is part of the title, mark past_title but don't add to authors
                if title_tokens and len(line_tokens) > 0 and line_tokens.issubset(title_tokens):
                    past_title = True
                    continue

                if not past_title:
                    # If we haven't seen the title yet, check if line is title
                    if title and (line.lower() in title.lower() or title.lower() in line.lower()):
                        past_title = True
                        continue
                    # Skip top headers until title is passed
                    continue

                # Stop when Abstract heading is reached
                if re.search(r'(?i)\babstract\b', line):
                    break

                author_lines.append(line)

            for line in author_lines:
                line_lower = line.lower()
                # Skip lines with emails, URLs, or institutional affiliations
                if "@" in line or "http" in line_lower or "doi.org" in line_lower or "arxiv" in line_lower:
                    continue
                if any(kw in line_lower for kw in cls.AFFILIATION_KEYWORDS):
                    continue
                if len(line) > 130:
                    continue

                # Clean superscript numbers, stars, daggers (e.g. "Ashish Vaswani1*, Noam Shazeer2")
                cleaned_line = re.sub(r'[\d\*†‡§¶✉]+', '', line).strip()
                parts = re.split(r'[,;]|\band\b', cleaned_line)
                for p in parts:
                    name = p.strip()
                    # An author name typically has 2-4 words and no affiliation keywords
                    if 2 <= len(name) <= 50 and not any(kw in name.lower() for kw in cls.AFFILIATION_KEYWORDS):
                        if len(re.sub(r'[^a-zA-Z]', '', name)) >= 3:
                            authors.append(name)

            if authors:
                seen = set()
                deduped = []
                for a in authors:
                    if a.lower() not in seen:
                        seen.add(a.lower())
                        deduped.append(a)
                return deduped[:15]
        except Exception:
            pass

        # Fallback to metadata author if present
        meta_author = metadata.get("author", "").strip()
        if meta_author and not cls.is_header_or_metadata(meta_author):
            parts = re.split(r'[,;]|\band\b', meta_author)
            cleaned_parts = [p.strip() for p in parts if len(p.strip()) > 1 and not any(kw in p.lower() for kw in cls.AFFILIATION_KEYWORDS)]
            if cleaned_parts:
                return cleaned_parts[:12]

        return []

    @classmethod
    def _extract_abstract(cls, page0: Any, full_text: str) -> Optional[str]:
        """
        Extracts the abstract text by locating the 'Abstract' heading and capturing
        content until the 'Introduction', 'Keywords', or next section.
        """
        # Look in page 1 text first
        page_text = page0.get_text("text")
        match = re.search(
            r'(?i)\babstract\b[\s:\.\-—]*\n*(.*?)(?=\n*\b(?:1[\.\s]+introduction|i[\.\s]+introduction|introduction|keywords|index terms)\b|\Z)',
            page_text,
            re.DOTALL
        )

        if match:
            candidate = match.group(1).strip()
            candidate = re.sub(r'\s+', ' ', candidate)
            if len(candidate) > 40:
                return candidate

        # Search across full text start
        match_full = re.search(
            r'(?i)\babstract\b[\s:\.\-—]*\n*(.*?)(?=\n*\b(?:1[\.\s]+introduction|i[\.\s]+introduction|introduction|keywords|index terms)\b|\Z)',
            full_text[:5000],
            re.DOTALL
        )
        if match_full:
            candidate = match_full.group(1).strip()
            candidate = re.sub(r'\s+', ' ', candidate)
            if len(candidate) > 40:
                return candidate

        return None

    @classmethod
    def _extract_year(cls, full_text: str, metadata: Dict[str, Any]) -> Optional[int]:
        """
        Extracts publication year from document metadata creationDate or regex in full text header.
        """
        # 1. Metadata creation date (format: D:YYYYMMDD...)
        creation_date = metadata.get("creationDate", "")
        if creation_date.startswith("D:"):
            try:
                year_candidate = int(creation_date[2:6])
                if 1950 <= year_candidate <= 2026:
                    return year_candidate
            except ValueError:
                pass

        # 2. Regex search in the first 2500 characters of text
        header_text = full_text[:2500]
        years = re.findall(r'\b(19\d{2}|20[0-2]\d)\b', header_text)
        if years:
            for y_str in years:
                y = int(y_str)
                if 1980 <= y <= 2026:
                    return y

        return None

    @classmethod
    def _extract_arxiv_id(cls, text: str) -> Optional[str]:
        """Extracts arXiv identifier (e.g. 2302.13971 or 2302.13971v1)."""
        match = re.search(r'arXiv:\s*(\d{4}\.\d{4,5}(?:v\d+)?)', text, re.IGNORECASE)
        return match.group(1) if match else None

    @classmethod
    def _extract_doi(cls, text: str) -> Optional[str]:
        """Extracts DOI identifier (e.g. 10.1145/1234567.1234568)."""
        match = re.search(r'\b(10\.\d{4,9}/[-._;()/:A-Za-z0-9]+)\b', text)
        return match.group(1) if match else None

    @classmethod
    def save_pdf_file(cls, file_bytes: bytes, filename: str) -> str:
        """
        Persists the uploaded PDF file to local disk storage directory (settings.PDF_STORAGE_DIR).
        Returns the relative file path.
        """
        os.makedirs(settings.PDF_STORAGE_DIR, exist_ok=True)
        safe_name = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', filename)
        if not safe_name.lower().endswith(".pdf"):
            safe_name += ".pdf"

        file_id = uuid.uuid4().hex[:8]
        stored_filename = f"{file_id}_{safe_name}"
        stored_path = os.path.join(settings.PDF_STORAGE_DIR, stored_filename)

        with open(stored_path, "wb") as f:
            f.write(file_bytes)

        return stored_path
