from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class PaperBase(BaseModel):
    """Base schema for research paper attributes."""
    title: str = Field(..., min_length=1, max_length=512, description="Paper title")
    authors: List[str] = Field(default_factory=list, description="List of author names")
    publication_year: Optional[int] = Field(None, description="Year of publication")
    abstract: Optional[str] = Field(None, description="Paper abstract text")
    url: Optional[str] = Field(None, description="Direct URL to paper or preprint")
    doi: Optional[str] = Field(None, description="Digital Object Identifier")
    arxiv_id: Optional[str] = Field(None, description="arXiv ID")
    source: str = Field("search", description="Source of paper ('openalex', 'arxiv', or 'upload')")


class PaperCreate(PaperBase):
    """Schema for saving a paper into the persistent library."""
    pdf_file_path: Optional[str] = Field(None, description="Local filepath if PDF was uploaded")
    full_text: Optional[str] = Field(None, description="Extracted full paper text if available")


class PaperUpdate(BaseModel):
    """Schema for updating paper metadata."""
    title: Optional[str] = None
    authors: Optional[List[str]] = None
    publication_year: Optional[int] = None
    abstract: Optional[str] = None
    url: Optional[str] = None
    doi: Optional[str] = None
    arxiv_id: Optional[str] = None
    pdf_file_path: Optional[str] = None
    full_text: Optional[str] = None


class PaperResponse(PaperBase):
    """Schema for returning a paper retrieved from the database."""
    id: int = Field(..., description="Unique persistent identifier")
    pdf_file_path: Optional[str] = None
    pdf_url: Optional[str] = Field(None, description="Safe endpoint URL to view or stream the PDF")
    has_pdf: bool = Field(False, description="True if local PDF file is associated")
    has_summary: bool = Field(False, description="True if LLM summary has been generated")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PaperListResponse(BaseModel):
    """Envelope for list of papers with metadata count."""
    total: int
    papers: List[PaperResponse]
