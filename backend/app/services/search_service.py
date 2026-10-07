import re
import logging
import asyncio
import xml.etree.ElementTree as ET
from typing import List, Optional
import httpx
from app.schemas.search import PaperSearchResult, SearchResponse

logger = logging.getLogger(__name__)

# XML namespace mapping for arXiv Atom feed
ARXIV_NAMESPACES = {
    "atom": "http://www.w3.org/2005/Atom",
    "arxiv": "http://arxiv.org/schemas/atom"
}


def clean_text(text: Optional[str]) -> str:
    """Removes excessive newlines and whitespace from raw API text."""
    if not text:
        return ""
    cleaned = re.sub(r"\s+", " ", text).strip()
    return cleaned


def reconstruct_openalex_abstract(inverted_index: Optional[dict]) -> str:
    """Reconstructs the full abstract text from OpenAlex's abstract_inverted_index."""
    if not inverted_index or not isinstance(inverted_index, dict):
        return ""
    try:
        word_positions = []
        for word, positions in inverted_index.items():
            for pos in positions:
                word_positions.append((pos, word))
        word_positions.sort(key=lambda x: x[0])
        return clean_text(" ".join(w for _, w in word_positions))
    except Exception:
        return ""


class SearchService:
    """Service to query 100% free public academic search APIs (OpenAlex and arXiv)."""

    def __init__(self):
        self.timeout = httpx.Timeout(15.0, connect=10.0)

    async def search_arxiv(self, query: str, limit: int = 10) -> List[PaperSearchResult]:
        """Queries the arXiv Atom API (100% free, zero authentication)."""
        results: List[PaperSearchResult] = []
        encoded_query = f"all:{query.strip()}"
        url = "https://export.arxiv.org/api/query"
        params = {
            "search_query": encoded_query,
            "start": 0,
            "max_results": limit,
            "sortBy": "relevance",
            "sortOrder": "descending"
        }

        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            try:
                response = await client.get(url, params=params)
                if response.status_code != 200:
                    logger.warning(f"arXiv API returned status {response.status_code}")
                    return []

                root = ET.fromstring(response.text)
                entries = root.findall("atom:entry", ARXIV_NAMESPACES)

                for entry in entries:
                    title_elem = entry.find("atom:title", ARXIV_NAMESPACES)
                    title = clean_text(title_elem.text if title_elem is not None else "Untitled")
                    if not title:
                        continue

                    # Authors
                    authors: List[str] = []
                    for author_elem in entry.findall("atom:author", ARXIV_NAMESPACES):
                        name_elem = author_elem.find("atom:name", ARXIV_NAMESPACES)
                        if name_elem is not None and name_elem.text:
                            authors.append(name_elem.text.strip())

                    # Published year
                    published_elem = entry.find("atom:published", ARXIV_NAMESPACES)
                    pub_year: Optional[int] = None
                    if published_elem is not None and published_elem.text:
                        try:
                            pub_year = int(published_elem.text[:4])
                        except ValueError:
                            pub_year = None

                    # Abstract
                    summary_elem = entry.find("atom:summary", ARXIV_NAMESPACES)
                    abstract = clean_text(summary_elem.text if summary_elem is not None else "")

                    # ID and Links
                    id_elem = entry.find("atom:id", ARXIV_NAMESPACES)
                    raw_id = id_elem.text.strip() if id_elem is not None and id_elem.text else ""
                    
                    arxiv_id = ""
                    if "/abs/" in raw_id:
                        arxiv_id = raw_id.split("/abs/")[-1]
                    elif raw_id:
                        arxiv_id = raw_id.split("/")[-1]

                    # Find PDF or web URL
                    paper_url = raw_id
                    for link in entry.findall("atom:link", ARXIV_NAMESPACES):
                        if link.attrib.get("title") == "pdf" or link.attrib.get("type") == "application/pdf":
                            paper_url = link.attrib.get("href", paper_url)
                            break

                    doi_elem = entry.find("arxiv:doi", ARXIV_NAMESPACES)
                    doi = doi_elem.text.strip() if doi_elem is not None and doi_elem.text else None

                    results.append(
                        PaperSearchResult(
                            title=title,
                            authors=authors,
                            publication_year=pub_year,
                            abstract=abstract if abstract else None,
                            url=paper_url if paper_url else None,
                            doi=doi,
                            arxiv_id=arxiv_id if arxiv_id else None,
                            source="arxiv"
                        )
                    )
            except Exception as e:
                logger.error(f"Error querying arXiv API: {e}", exc_info=True)

        return results

    async def search_openalex(self, query: str, limit: int = 10) -> List[PaperSearchResult]:
        """Queries OpenAlex API (100% free, 250M+ papers across all disciplines)."""
        results: List[PaperSearchResult] = []
        url = "https://api.openalex.org/works"
        params = {
            "search": query.strip(),
            "per_page": limit,
        }
        headers = {
            "User-Agent": "AI-Research-Assistant/1.0 (mailto:researcher@local.assistant)"
        }

        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            try:
                response = await client.get(url, params=params, headers=headers)
                if response.status_code != 200:
                    logger.warning(f"OpenAlex API returned status {response.status_code}")
                    return []

                data = response.json()
                works = data.get("results", [])

                for item in works:
                    title = clean_text(item.get("title", ""))
                    if not title:
                        continue

                    # Authors
                    authors: List[str] = []
                    for authorship in (item.get("authorships") or []):
                        author_info = authorship.get("author") or {}
                        name = author_info.get("display_name")
                        if name:
                            authors.append(name.strip())

                    # Year
                    year = item.get("publication_year")

                    # Abstract (reconstructed from inverted index)
                    abstract = reconstruct_openalex_abstract(item.get("abstract_inverted_index"))

                    # DOI and PDF/Landing URL
                    doi = item.get("doi")
                    open_access = item.get("open_access") or {}
                    primary_loc = item.get("primary_location") or {}
                    paper_url = open_access.get("oa_url") or primary_loc.get("landing_page_url") or doi

                    # Check for arXiv identifier in ids mapping
                    ids = item.get("ids") or {}
                    arxiv_id = None
                    if "arxiv" in ids:
                        raw_arxiv = ids["arxiv"]
                        arxiv_id = raw_arxiv.split("/")[-1] if "/" in raw_arxiv else raw_arxiv

                    results.append(
                        PaperSearchResult(
                            title=title,
                            authors=authors,
                            publication_year=year,
                            abstract=abstract if abstract else None,
                            url=paper_url if paper_url else None,
                            doi=doi,
                            arxiv_id=arxiv_id,
                            source="openalex"
                        )
                    )
            except Exception as e:
                logger.error(f"Error querying OpenAlex API: {e}", exc_info=True)

        return results

    async def search(self, query: str, source: str = "openalex", limit: int = 10) -> SearchResponse:
        """Searches academic papers across free public APIs (OpenAlex and arXiv) with deduplication."""
        query = query.strip()
        if not query:
            return SearchResponse(query="", count=0, source_used=source, results=[])

        limit = max(1, min(limit, 30))
        results: List[PaperSearchResult] = []
        warning_msg: Optional[str] = None

        if source == "arxiv":
            results = await self.search_arxiv(query, limit)
        elif source == "openalex":
            results = await self.search_openalex(query, limit)
            if not results:
                # Fallback to arXiv
                arxiv_results = await self.search_arxiv(query, limit)
                if arxiv_results:
                    results = arxiv_results
                    warning_msg = "OpenAlex had no matches; showing arXiv preprints."
        else:  # "all" (query both OpenAlex & arXiv concurrently)
            oa_task = self.search_openalex(query, limit)
            arxiv_task = self.search_arxiv(query, limit)
            oa_res, arxiv_res = await asyncio.gather(oa_task, arxiv_task)
            
            # Deduplicate by normalized title
            seen_titles = set()
            for paper in oa_res + arxiv_res:
                norm_title = paper.title.lower().strip()
                if norm_title not in seen_titles:
                    seen_titles.add(norm_title)
                    results.append(paper)
            results = results[:limit]

        return SearchResponse(
            query=query,
            count=len(results),
            source_used=source,
            results=results,
            warning=warning_msg
        )


search_service = SearchService()
