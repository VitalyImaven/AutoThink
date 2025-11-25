import json
from typing import List
from openai import AsyncOpenAI
from app.config import settings
from app.models import (
    KnowledgeChunk, KnowledgeChunkMeta, KnowledgeCategory,
    FieldContext, ClassificationResult, SuggestionRequest, SuggestionResult
)
from app.utils.id_generation import generate_stable_chunk_id

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


async def call_llm_ingest(text: str, source_file_name: str) -> List[KnowledgeChunk]:
    """
    Process document text and extract structured knowledge chunks.
    
    Args:
        text: Raw document text
        source_file_name: Original filename
        
    Returns:
        List of KnowledgeChunk objects
    """
    categories_info = """
Available categories:
- personal_basic: Basic personal info (name, age, nationality, etc.)
- personal_contact: Contact information (email, phone, address)
- startup_one_liner: Brief company/startup description
- startup_problem: Problem the startup is solving
- startup_solution: How the startup solves the problem
- startup_traction: Metrics, growth, achievements
- startup_team: Team members, backgrounds, roles
- startup_use_of_funds: How funding will be used
- insurance_profile: Insurance-related information
- generic_other: Other general information
"""
    
    prompt = f"""Analyze the following document and extract knowledge chunks.

For each logical chunk of information:
1. Identify the category from the list below
2. Extract the body text (clean, well-formatted)
3. Assign metadata

{categories_info}

Document:
{text}

Return a JSON array of chunks. Each chunk should have:
{{
  "category": "category_name",
  "section": "optional section title",
  "body": "the actual text content",
  "language": "en",
  "length_hint": "short|medium|long",
  "tags": ["tag1", "tag2"],
  "priority": 0.0-1.0
}}

Return ONLY the JSON array, no other text."""

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "You are a document analysis expert. Extract structured knowledge chunks from documents."},
                {"role": "user", "content": prompt}
            ],
            # GPT-5 parameters for structured data extraction
            extra_body={
                "verbosity": "low",  # Concise for JSON output
                "reasoning_effort": "low"  # Fast categorization
            }
        )
        
        content = response.choices[0].message.content.strip()
        
        # Parse JSON response
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        chunks_data = json.loads(content)
        
        # Convert to KnowledgeChunk objects
        chunks = []
        for chunk_data in chunks_data:
            # Generate stable ID
            chunk_id = generate_stable_chunk_id(
                source_file_name,
                chunk_data.get("section", ""),
                chunk_data.get("body", "")
            )
            
            meta = KnowledgeChunkMeta(
                id=chunk_id,
                source_file=source_file_name,
                section=chunk_data.get("section"),
                category=KnowledgeCategory(chunk_data["category"]),
                language=chunk_data.get("language", "en"),
                length_hint=chunk_data.get("length_hint"),
                tags=chunk_data.get("tags", []),
                priority=chunk_data.get("priority")
            )
            
            chunk = KnowledgeChunk(
                meta=meta,
                body=chunk_data["body"]
            )
            chunks.append(chunk)
        
        return chunks
    
    except Exception as e:
        print(f"Error in call_llm_ingest: {e}")
        raise


async def call_llm_classify(field: FieldContext) -> ClassificationResult:
    """
    Classify a form field to determine what information it's asking for.
    
    Args:
        field: Field context information
        
    Returns:
        ClassificationResult with category and metadata
    """
    categories_info = """
Available categories:
- personal_basic: Name, age, date of birth, nationality, gender, etc.
- personal_contact: Email, phone, address, social media
- startup_one_liner: Brief company description (1-2 sentences)
- startup_problem: What problem does your startup solve?
- startup_solution: How does your startup solve it?
- startup_traction: Metrics, users, revenue, growth
- startup_team: Team information, backgrounds
- startup_use_of_funds: How will you use funding?
- insurance_profile: Insurance needs, coverage, history
- generic_other: Other types of information
"""
    
    field_info = f"""
Field attributes:
- Label: {field.label_text or "N/A"}
- Placeholder: {field.placeholder or "N/A"}
- Name attribute: {field.name_attr or "N/A"}
- ID attribute: {field.id_attr or "N/A"}
- Nearby text: {field.nearby_text or "N/A"}
- Max length: {field.max_length or "N/A"}
"""
    
    prompt = f"""Classify this form field to determine what information it's asking for.

{categories_info}

{field_info}

Return a JSON object with:
{{
  "category": "category_name",
  "max_length": optional_integer,
  "tone": "professional|casual|formal",
  "confidence": 0.0-1.0
}}

Return ONLY the JSON object, no other text."""

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "You are a form field classification expert. Analyze field context and determine what information is being requested."},
                {"role": "user", "content": prompt}
            ],
            # GPT-5 parameters for fast classification
            extra_body={
                "verbosity": "low",  # Concise JSON response
                "reasoning_effort": "low"  # Fast field classification
            }
        )
        
        content = response.choices[0].message.content.strip()
        
        # Parse JSON
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        result_data = json.loads(content)
        
        return ClassificationResult(
            category=KnowledgeCategory(result_data["category"]),
            max_length=result_data.get("max_length"),
            tone=result_data.get("tone", "professional"),
            confidence=result_data.get("confidence", 0.8)
        )
    
    except Exception as e:
        print(f"Error in call_llm_classify: {e}")
        raise


async def call_llm_suggest(request: SuggestionRequest) -> SuggestionResult:
    """
    Generate a suggestion for a form field based on knowledge chunks.
    
    Args:
        request: SuggestionRequest with field, classification, and chunks
        
    Returns:
        SuggestionResult with suggested text
    """
    field = request.field
    classification = request.classification
    chunks = request.chunks
    
    # Build context from chunks
    chunks_text = "\n\n".join([
        f"Source: {chunk.meta.source_file}\n{chunk.body}"
        for chunk in chunks
    ])
    
    field_info = f"""
Field information:
- Label: {field.label_text or "N/A"}
- Placeholder: {field.placeholder or "N/A"}
- Category: {classification.category.value}
- Max length: {classification.max_length or "No limit"}
- Tone: {classification.tone}
"""
    
    prompt = f"""Generate a response for this form field using ONLY the provided information.

{field_info}

Available knowledge:
{chunks_text}

Rules:
1. Use ONLY facts from the provided knowledge
2. Do NOT invent information
3. Respect the max length constraint
4. Use {classification.tone} tone
5. Return ONLY the text to fill in the field, no explanations
6. If information is not available, return a brief placeholder or "N/A"

Generate the field response:"""

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "You are an expert form-filling assistant. Generate concise, accurate responses based strictly on provided information."},
                {"role": "user", "content": prompt}
            ],
            max_completion_tokens=classification.max_length if classification.max_length and classification.max_length < 4000 else 500,
            # GPT-5 parameters for quality suggestions
            extra_body={
                "verbosity": "medium",  # Normal detail for user-facing content
                "reasoning_effort": "medium"  # Better quality suggestions
            }
        )
        
        suggestion_text = response.choices[0].message.content.strip()
        
        # Remove quotes if the LLM wrapped the response
        if suggestion_text.startswith('"') and suggestion_text.endswith('"'):
            suggestion_text = suggestion_text[1:-1]
        
        return SuggestionResult(suggestion_text=suggestion_text)
    
    except Exception as e:
        print(f"Error in call_llm_suggest: {e}")
        raise

