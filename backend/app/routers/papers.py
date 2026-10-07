from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.paper import PaperCreate, PaperUpdate, PaperResponse
from app.services.paper_service import PaperService

router = APIRouter(prefix="/api/papers", tags=["papers"])


@router.get("", response_model=List[PaperResponse])
def get_all_papers(
    q: Optional[str] = Query(None, description="Search term in title, abstract, or authors"),
    source: Optional[str] = Query(None, description="Filter by source ('openalex', 'arxiv', 'upload')"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of papers to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: Session = Depends(get_db)
):
    """
    Retrieve all saved research papers from the persistent database with optional search and source filtering.
    """
    papers, _ = PaperService.get_papers(db, query=q, source=source, limit=limit, offset=offset)
    return papers


@router.get("/{paper_id}", response_model=PaperResponse)
def get_paper(
    paper_id: int,
    db: Session = Depends(get_db)
):
    """
    Retrieve a specific research paper by its database ID.
    """
    paper = PaperService.get_paper_by_id(db, paper_id)
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paper with ID {paper_id} not found."
        )
    return paper


@router.post("", response_model=PaperResponse, status_code=status.HTTP_201_CREATED)
def save_paper(
    paper_in: PaperCreate,
    db: Session = Depends(get_db)
):
    """
    Save a research paper to the persistent database.
    If the paper already exists (matched by arXiv ID, DOI, or exact title), updates missing fields and returns it.
    """
    paper, _ = PaperService.save_paper(db, paper_in)
    return paper


@router.put("/{paper_id}", response_model=PaperResponse)
def update_paper(
    paper_id: int,
    paper_update: PaperUpdate,
    db: Session = Depends(get_db)
):
    """
    Update metadata of an existing saved paper.
    """
    updated_paper = PaperService.update_paper(db, paper_id, paper_update)
    if not updated_paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paper with ID {paper_id} not found."
        )
    return updated_paper


@router.delete("/{paper_id}")
def delete_paper(
    paper_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete a research paper and all its associated summaries, Q&A messages, and local PDF files.
    """
    deleted = PaperService.delete_paper(db, paper_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paper with ID {paper_id} not found."
        )
    return {
        "success": True,
        "message": f"Paper {paper_id} deleted successfully.",
        "id": paper_id
    }
