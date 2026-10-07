from fastapi import APIRouter, Query, HTTPException
from app.schemas.search import SearchResponse
from app.services.search_service import search_service

router = APIRouter(prefix="/api/search", tags=["Search"])


@router.get("", response_model=SearchResponse)
async def search_papers(
    q: str = Query(..., min_length=1, max_length=256, description="Search query string (e.g. 'Transformer attention')"),
    source: str = Query("openalex", pattern="^(openalex|arxiv|all)$", description="Academic source to query ('openalex', 'arxiv', or 'all')"),
    limit: int = Query(10, ge=1, le=30, description="Max number of results to return")
):
    """
    Search academic research papers across free public APIs (OpenAlex & arXiv).
    Returns normalized metadata: title, authors, publication year, abstract, and paper links.
    """
    try:
        response = await search_service.search(query=q, source=source, limit=limit)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while searching for papers: {str(e)}"
        )
