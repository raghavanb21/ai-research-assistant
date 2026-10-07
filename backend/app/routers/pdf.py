import os
import re
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.schemas.paper import PaperCreate, PaperResponse
from app.services.paper_service import PaperService
from app.services.pdf_service import PDFExtractionService

router = APIRouter(prefix="/api/pdf", tags=["pdf"])

MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB


@router.post("/upload", response_model=PaperResponse, status_code=status.HTTP_201_CREATED)
async def upload_pdf(
    file: UploadFile = File(..., description="PDF research paper file to upload (max 25MB)"),
    db: Session = Depends(get_db)
):
    """
    Upload a research paper in PDF format.
    Extracts paper title, authors, publication year, abstract, and full body text locally with PyMuPDF.
    Saves the PDF to local storage and persists the paper record in the SQLite database.
    """
    filename = file.filename or "uploaded_paper.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid file type. Only PDF documents (.pdf) are supported."
        )

    # Read uploaded bytes into memory
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty (0 bytes)."
        )

    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds the 25MB limit ({len(file_bytes) / (1024*1024):.1f}MB uploaded)."
        )

    # Validate PDF magic header
    if not file_bytes.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The uploaded file is not a valid PDF document (missing standard PDF header)."
        )

    # Extract text and metadata locally using PyMuPDF
    try:
        extracted = PDFExtractionService.extract_pdf_data(file_bytes, filename)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to extract content from PDF: {str(e)}"
        )

    # Persist the physical PDF file to local storage directory
    stored_path = PDFExtractionService.save_pdf_file(file_bytes, filename)

    # Persist the paper to the SQLite database
    paper_in = PaperCreate(
        title=extracted["title"],
        authors=extracted["authors"],
        publication_year=extracted["publication_year"],
        abstract=extracted["abstract"],
        url=None,
        doi=extracted.get("doi"),
        arxiv_id=extracted.get("arxiv_id"),
        source="upload",
        pdf_file_path=stored_path,
        full_text=extracted["full_text"]
    )

    paper, _ = PaperService.save_paper(db, paper_in)
    return paper


@router.get("/{paper_id}/view")
def view_pdf(
    paper_id: int,
    db: Session = Depends(get_db)
):
    """
    Safely stream the uploaded PDF file for viewing/previewing in the browser.
    Prevents path traversal and validates file existence.
    """
    paper = PaperService.get_paper_by_id(db, paper_id)
    if not paper or not paper.pdf_file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF document not found for this paper."
        )

    # Security check: resolve absolute path and ensure it's within storage directory
    file_path = os.path.abspath(paper.pdf_file_path)
    storage_dir = os.path.abspath(settings.PDF_STORAGE_DIR)
    if not file_path.startswith(storage_dir):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to the requested file path is forbidden."
        )

    if not os.path.isfile(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The PDF file on disk is missing or has been deleted."
        )

    # Clean filename for content-disposition header
    clean_title = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', paper.title[:50]).strip("_") or f"paper_{paper_id}"
    filename = f"{clean_title}.pdf"

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=filename,
        content_disposition_type="inline"  # Allows in-browser rendering in iframe/tab
    )
