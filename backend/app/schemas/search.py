from typing import List, Optional
from pydantic import BaseModel, Field


class PaperSearchResult(BaseModel):
    """Normalized search result item returned from free public academic APIs."""
    title: str = Field(..., description="Paper title")
    authors: List[str] = Field(default_factory=list, description="List of author names")
    publication_year: Optional[int] = Field(None, description="Year of publication")
    abstract: Optional[str] = Field(None, description="Paper abstract text")
    url: Optional[str] = Field(None, description="Link to the paper or preprint")
    doi: Optional[str] = Field(None, description="Digital Object Identifier if available")
    arxiv_id: Optional[str] = Field(None, description="arXiv ID if available")
    source: str = Field(..., description="Source API ('openalex', 'arxiv', or 'upload')")


class SearchResponse(BaseModel):
    """Response envelope for paper searches."""
    query: str
    count: int
    source_used: str
    results: List[PaperSearchResult]
    warning: Optional[str] = None
