from fastapi import APIRouter, HTTPException
from typing import List
from app.models import IngestRequest, KnowledgeChunk
from app.openai_client import call_llm_ingest

router = APIRouter()


@router.post("/text", response_model=List[KnowledgeChunk])
async def ingest_text(request: IngestRequest):
    """
    Ingest document text and return structured knowledge chunks.
    
    Args:
        request: IngestRequest with source_file_name and text
        
    Returns:
        List of KnowledgeChunk objects
    """
    try:
        if not request.text.strip():
            raise HTTPException(status_code=400, detail="Text content is empty")
        
        chunks = await call_llm_ingest(request.text, request.source_file_name)
        
        if not chunks:
            raise HTTPException(status_code=400, detail="No chunks could be extracted from the text")
        
        return chunks
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

