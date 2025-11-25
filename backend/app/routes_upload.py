from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List
from app.models import KnowledgeChunk
from app.openai_client import call_llm_ingest
from app.utils.file_extractors import extract_text_from_file
import traceback

router = APIRouter()


@router.post("/file", response_model=List[KnowledgeChunk])
async def upload_file(file: UploadFile = File(...)):
    """
    Upload and process a document file (PDF, DOCX, XLSX, MD, TXT, JSON, XML, etc.)
    
    Args:
        file: Uploaded file
        
    Returns:
        List of KnowledgeChunk objects
    """
    try:
        # Read file content
        file_content = await file.read()
        
        if not file_content:
            raise HTTPException(status_code=400, detail="File is empty")
        
        # Extract text based on file type
        try:
            text = extract_text_from_file(file.filename or "unknown.txt", file_content)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        if not text.strip():
            raise HTTPException(status_code=400, detail="No text could be extracted from the file")
        
        # Process with LLM
        chunks = await call_llm_ingest(text, file.filename or "unknown.txt")
        
        if not chunks:
            raise HTTPException(status_code=400, detail="No chunks could be extracted from the text")
        
        return chunks
    
    except HTTPException:
        raise
    except Exception as e:
        # Log the full error with traceback
        error_details = traceback.format_exc()
        print(f"ERROR in upload_file:")
        print(error_details)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

