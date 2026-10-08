from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class SummaryResponse(BaseModel):
    """Schema for returning a generated paper summary."""
    id: int
    paper_id: int
    summary_text: str = Field(..., description="Full structured markdown summary text")
    key_points: List[str] = Field(default_factory=list, description="List of key takeaway bullet points")
    model_used: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class SummarizeRequest(BaseModel):
    """Request schema for generating a paper summary."""
    force_regenerate: bool = Field(False, description="If true, bypasses cache and regenerates summary")


class QARequest(BaseModel):
    """Request schema for asking a question about a paper."""
    question: str = Field(..., min_length=2, max_length=2000, description="Natural language question about the paper")


class QAMessageResponse(BaseModel):
    """Schema for a single user or assistant message in Q&A history."""
    id: int
    paper_id: int
    role: str = Field(..., description="'user' or 'assistant'")
    message: str = Field(..., description="Message text content")
    context_used: Optional[str] = Field(None, description="Type of context used (e.g. 'full_text' or 'abstract')")
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class QAHistoryResponse(BaseModel):
    """Schema for returning conversation history for a paper."""
    paper_id: int
    total_messages: int
    messages: List[QAMessageResponse]
