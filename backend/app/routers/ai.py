import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.paper import Paper
from app.schemas.ai import (
    SummaryResponse,
    SummarizeRequest,
    QARequest,
    QAMessageResponse,
    QAHistoryResponse
)
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["AI & LLM"])


@router.post("/summarize/{paper_id}", response_model=SummaryResponse, status_code=status.HTTP_200_OK)
def summarize_paper(
    paper_id: int,
    force_regenerate: bool = Query(False, description="Whether to bypass cache and regenerate summary"),
    db: Session = Depends(get_db)
):
    """
    Generates a structured, comprehensive summary for the selected paper.
    If a summary was already generated and force_regenerate is False, returns the cached summary.
    The summary is grounded strictly in the paper's actual text content (or detailed abstract).
    """
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail=f"Paper with ID {paper_id} not found in library.")

    if not llm_service.is_configured:
        raise HTTPException(
            status_code=500,
            detail="Gemini API is not configured. Please ensure GEMINI_API_KEY is set in backend/.env."
        )

    try:
        summary = llm_service.generate_summary(paper, db, force_regenerate=force_regenerate)
        return summary
    except Exception as e:
        logger.error(f"Error summarizing paper {paper_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate summary: {str(e)}")


@router.get("/summary/{paper_id}", response_model=SummaryResponse)
def get_paper_summary(paper_id: int, db: Session = Depends(get_db)):
    """
    Retrieves the cached summary for a paper if one exists.
    """
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail=f"Paper with ID {paper_id} not found in library.")

    summary = llm_service.get_summary(paper_id, db)
    if not summary:
        raise HTTPException(status_code=404, detail=f"No summary has been generated for paper {paper_id} yet.")

    return summary


@router.post("/qa/{paper_id}", response_model=QAMessageResponse, status_code=status.HTTP_200_OK)
def ask_paper_question(
    paper_id: int,
    request: QARequest,
    db: Session = Depends(get_db)
):
    """
    Asks a natural-language question about the selected paper.
    The answer is strictly grounded in the paper's content and conversation history is persisted.
    """
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail=f"Paper with ID {paper_id} not found in library.")

    if not llm_service.is_configured:
        raise HTTPException(
            status_code=500,
            detail="Gemini API is not configured. Please ensure GEMINI_API_KEY is set in backend/.env."
        )

    try:
        assistant_message = llm_service.answer_question(paper, request.question, db)
        return assistant_message
    except Exception as e:
        logger.error(f"Error answering question for paper {paper_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to answer question: {str(e)}")


@router.get("/qa/{paper_id}", response_model=QAHistoryResponse)
def get_paper_qa_history(paper_id: int, db: Session = Depends(get_db)):
    """
    Retrieves the complete interactive Q&A history for a paper.
    """
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail=f"Paper with ID {paper_id} not found in library.")

    messages = llm_service.get_qa_history(paper_id, db)
    return QAHistoryResponse(
        paper_id=paper_id,
        total_messages=len(messages),
        messages=messages
    )


@router.delete("/qa/{paper_id}", status_code=status.HTTP_200_OK)
def clear_paper_qa_history(paper_id: int, db: Session = Depends(get_db)):
    """
    Clears the entire Q&A conversation history for a paper.
    """
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail=f"Paper with ID {paper_id} not found in library.")

    deleted = llm_service.clear_qa_history(paper_id, db)
    return {"success": True, "deleted_messages": deleted, "paper_id": paper_id}
