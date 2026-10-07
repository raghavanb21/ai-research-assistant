import os
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.models.paper import Paper
from app.schemas.paper import PaperCreate, PaperUpdate


class PaperService:
    """Service handling CRUD operations and deduplication for the persistent paper library."""

    @staticmethod
    def get_papers(
        db: Session,
        query: Optional[str] = None,
        source: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> Tuple[List[Paper], int]:
        """
        Retrieves saved papers from the database with optional text search and source filtering.
        Returns a tuple of (papers_list, total_count).
        """
        stmt = db.query(Paper)

        if source and source.lower() not in ("all", ""):
            stmt = stmt.filter(Paper.source == source.lower())

        if query and query.strip():
            search_pattern = f"%{query.strip().lower()}%"
            stmt = stmt.filter(
                or_(
                    func.lower(Paper.title).ilike(search_pattern),
                    func.lower(Paper.abstract).ilike(search_pattern),
                    func.lower(Paper.authors_json).ilike(search_pattern)
                )
            )

        total_count = stmt.count()
        papers = stmt.order_by(Paper.created_at.desc(), Paper.id.desc()).offset(offset).limit(limit).all()
        return papers, total_count

    @staticmethod
    def get_paper_by_id(db: Session, paper_id: int) -> Optional[Paper]:
        """Retrieves a single paper by its primary key ID."""
        return db.query(Paper).filter(Paper.id == paper_id).first()

    @staticmethod
    def find_existing_paper(db: Session, paper_in: PaperCreate) -> Optional[Paper]:
        """
        Checks for duplicate papers in the database using unique identifiers:
        1. arXiv ID (if provided)
        2. DOI (if provided)
        3. Exact title match (case-insensitive)
        """
        if paper_in.arxiv_id and paper_in.arxiv_id.strip():
            existing = db.query(Paper).filter(Paper.arxiv_id == paper_in.arxiv_id.strip()).first()
            if existing:
                return existing

        if paper_in.doi and paper_in.doi.strip():
            existing = db.query(Paper).filter(Paper.doi == paper_in.doi.strip()).first()
            if existing:
                return existing

        if paper_in.title and paper_in.title.strip():
            normalized_title = paper_in.title.strip().lower()
            existing = db.query(Paper).filter(func.lower(Paper.title) == normalized_title).first()
            if existing:
                return existing

        return None

    @classmethod
    def save_paper(cls, db: Session, paper_in: PaperCreate) -> Tuple[Paper, bool]:
        """
        Saves a paper to the persistent database.
        If a duplicate is found, updates any missing fields and returns (existing_paper, False).
        If a new paper is created, returns (new_paper, True).
        """
        existing = cls.find_existing_paper(db, paper_in)
        if existing:
            # Idempotent update: enrich existing record if new info is available
            updated = False
            if not existing.abstract and paper_in.abstract:
                existing.abstract = paper_in.abstract
                updated = True
            if not existing.url and paper_in.url:
                existing.url = paper_in.url
                updated = True
            if not existing.publication_year and paper_in.publication_year:
                existing.publication_year = paper_in.publication_year
                updated = True
            if not existing.full_text and paper_in.full_text:
                existing.full_text = paper_in.full_text
                updated = True
            if not existing.pdf_file_path and paper_in.pdf_file_path:
                existing.pdf_file_path = paper_in.pdf_file_path
                updated = True
            if not existing.doi and paper_in.doi:
                existing.doi = paper_in.doi
                updated = True
            if not existing.arxiv_id and paper_in.arxiv_id:
                existing.arxiv_id = paper_in.arxiv_id
                updated = True

            if updated:
                db.commit()
                db.refresh(existing)
            return existing, False

        # Create new record
        new_paper = Paper(
            title=paper_in.title.strip(),
            publication_year=paper_in.publication_year,
            abstract=paper_in.abstract.strip() if paper_in.abstract else None,
            url=paper_in.url.strip() if paper_in.url else None,
            doi=paper_in.doi.strip() if paper_in.doi else None,
            arxiv_id=paper_in.arxiv_id.strip() if paper_in.arxiv_id else None,
            source=paper_in.source or "search",
            pdf_file_path=paper_in.pdf_file_path,
            full_text=paper_in.full_text
        )
        new_paper.authors = paper_in.authors or []

        db.add(new_paper)
        db.commit()
        db.refresh(new_paper)
        return new_paper, True

    @staticmethod
    def update_paper(db: Session, paper_id: int, paper_update: PaperUpdate) -> Optional[Paper]:
        """Updates metadata fields of an existing saved paper."""
        paper = db.query(Paper).filter(Paper.id == paper_id).first()
        if not paper:
            return None

        update_data = paper_update.model_dump(exclude_unset=True)
        if "authors" in update_data and update_data["authors"] is not None:
            paper.authors = update_data.pop("authors")

        for key, value in update_data.items():
            setattr(paper, key, value)

        db.commit()
        db.refresh(paper)
        return paper

    @staticmethod
    def delete_paper(db: Session, paper_id: int) -> bool:
        """
        Deletes a paper from the persistent database by ID.
        Also removes any associated local PDF file on disk.
        Cascade deletion in SQLite handles child summaries and Q&A messages.
        """
        paper = db.query(Paper).filter(Paper.id == paper_id).first()
        if not paper:
            return False

        # Clean up local PDF file if present
        if paper.pdf_file_path and os.path.isfile(paper.pdf_file_path):
            try:
                os.remove(paper.pdf_file_path)
            except OSError:
                pass  # Ignore file deletion errors to avoid blocking DB cleanup

        db.delete(paper)
        db.commit()
        return True
