from fastapi import APIRouter, HTTPException
from app.models import SuggestionRequest, SuggestionResult
from app.openai_client import call_llm_suggest

router = APIRouter()


@router.post("/suggest", response_model=SuggestionResult)
async def generate_suggestion(request: SuggestionRequest):
    """
    Generate a suggestion for a form field based on knowledge chunks.
    
    Args:
        request: SuggestionRequest with field, classification, and chunks
        
    Returns:
        SuggestionResult with suggested text
    """
    try:
        if not request.chunks:
            raise HTTPException(
                status_code=400,
                detail="At least one knowledge chunk is required"
            )
        
        result = await call_llm_suggest(request)
        
        return result
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

