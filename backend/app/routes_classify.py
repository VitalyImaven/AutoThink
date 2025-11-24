from fastapi import APIRouter, HTTPException
from app.models import FieldContext, ClassificationResult
from app.openai_client import call_llm_classify

router = APIRouter()


@router.post("/classify-field", response_model=ClassificationResult)
async def classify_field(field: FieldContext):
    """
    Classify a form field to determine what type of information it's requesting.
    
    Args:
        field: FieldContext with field metadata
        
    Returns:
        ClassificationResult with category and metadata
    """
    try:
        # Validate that we have at least some field context
        if not any([field.label_text, field.placeholder, field.name_attr, field.id_attr]):
            raise HTTPException(
                status_code=400, 
                detail="Field must have at least one of: label_text, placeholder, name_attr, or id_attr"
            )
        
        result = await call_llm_classify(field)
        
        return result
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

