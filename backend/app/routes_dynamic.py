"""
Dynamic routes - no hardcoded categories!
AI discovers semantic topics from documents.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List, Dict
from app.models_dynamic import (
    SemanticChunk, DocumentIndex, FieldIntent,
    SemanticMatch, DynamicSuggestionRequest, DynamicIngestResponse
)
from app.openai_fast import (
    analyze_document_fast,
    fast_match_chunks,
    fast_generate_suggestion
)
from app.utils.file_extractors import extract_text_from_file
import traceback

router = APIRouter()

# STATELESS BACKEND - No storage!
# Backend only PROCESSES files and returns results
# Extension stores everything in IndexedDB locally


@router.post("/upload/file", response_model=DynamicIngestResponse)
async def ingest_document_dynamic(file: UploadFile = File(...)):
    """
    Upload and analyze a document with DYNAMIC categorization.
    No predefined categories - AI discovers what's in the document!
    
    Args:
        file: Document file (PDF, DOCX, TXT, MD, etc.)
        
    Returns:
        DocumentIndex with discovered topics and semantic tags
    """
    try:
        # Read and extract text
        file_content = await file.read()
        
        if not file_content:
            raise HTTPException(status_code=400, detail="File is empty")
        
        try:
            text = extract_text_from_file(file.filename or "unknown.txt", file_content)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        if not text.strip():
            raise HTTPException(status_code=400, detail="No text could be extracted")
        
        # Analyze with HEAVY preprocessing (generates embeddings!)
        # This takes 30-60s but makes suggestions FAST (2-3s)!
        print(f"🚀 Heavy preprocessing started for {file.filename}")
        print("   Generating embeddings and optimizing for fast suggestions...")
        
        doc_index = await analyze_document_fast(text, file.filename or "unknown.txt")
        
        # Create response - extension will store this in IndexedDB
        summary = f"Discovered {len(doc_index.discovered_topics)} topics and {len(doc_index.all_tags)} unique semantic tags across {doc_index.chunk_count} chunks. Generated embeddings for instant matching!"
        
        print(f"✅ Heavy preprocessing complete for {file.filename}")
        print(f"   📊 {len(doc_index.discovered_topics)} topics, {len(doc_index.all_tags)} tags, embeddings ready")
        print("   ⚡ Suggestions will now be FAST (2-3s)!")
        print("   💾 Backend is STATELESS - returning data to extension for local storage")
        
        response = DynamicIngestResponse(
            document_index=doc_index,
            summary=summary,
            suggested_improvements=[]
        )
        
        return response
    
    except HTTPException:
        raise
    except Exception as e:
        error_details = traceback.format_exc()
        print(f"ERROR in dynamic ingestion:")
        print(error_details)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/suggest")
async def suggest_dynamic(request_data: Dict):
    """
    Generate suggestion for a field using DYNAMIC matching.
    Extension sends field context + relevant chunks from local IndexedDB.
    Backend is STATELESS - just processes and returns suggestion.
    
    Args:
        request_data: {
            "field_context": Field information,
            "all_chunks": All chunks from extension's IndexedDB
        }
        
    Returns:
        Suggestion text
    """
    try:
        field_context = request_data.get("field_context", request_data)
        all_chunks_data = request_data.get("all_chunks", [])
        
        field_label = field_context.get('label_text', 'Unknown')
        print(f"⚡ FAST suggestion for: {field_label}")
        
        if not all_chunks_data:
            return {
                "suggestion_text": "N/A",
                "reason": "No documents uploaded yet."
            }
        
        print(f"   📊 Searching {len(all_chunks_data)} chunks with embeddings...")
        
        # FAST Step 1: Use embeddings to find matching chunks (milliseconds!)
        matched_chunks = await fast_match_chunks(field_context, all_chunks_data, top_k=5)
        
        if not matched_chunks:
            return {
                "suggestion_text": "N/A",
                "reason": "No relevant information found"
            }
        
        # FAST Step 2: Single AI call to generate suggestion (~2s)
        print(f"   🤖 Generating suggestion with single AI call...")
        suggestion = await fast_generate_suggestion(field_context, matched_chunks)
        
        # Get tags from top match for debugging
        top_tags = matched_chunks[0].get('semantic_tags', []) if matched_chunks else []
        
        print(f"   ✅ Suggestion ready: {suggestion[:50]}...")
        
        return {
            "suggestion_text": suggestion,
            "matched_chunks": len(matched_chunks),
            "top_tags": top_tags[:3]
        }
    
    except Exception as e:
        error_details = traceback.format_exc()
        print(f"ERROR in dynamic suggestion:")
        print(error_details)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# STATELESS BACKEND - No storage endpoints needed!
# All data is stored in extension's IndexedDB
# Backend only processes files and generates suggestions

