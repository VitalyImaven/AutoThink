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
Available categories (BE SPECIFIC - choose the BEST match):

PERSONAL INFORMATION (about the individual):
- personal_basic: Name, age, marital status, nationality, gender
- personal_contact: Email, phone, address, location, city, country, websites
- personal_bio: Personal background, career summary, "about me", professional narrative
- personal_skills: Technical skills, competencies, expertise, tools/technologies
- personal_education: Degrees, certifications, universities, academic credentials
- personal_work_history: Past employment, companies worked at, job titles, career progression
- personal_achievements: Personal awards, recognitions, accomplishments
- personal_interests: Professional interests, areas of focus, passions

COMPANY/STARTUP INFORMATION (about the business):
- startup_one_liner: Brief company description (1-2 sentences)
- startup_problem: Problem the startup/company is solving
- startup_solution: How the solution works, approach, technology
- startup_traction: Metrics, users, revenue, growth rates, customers
- startup_team: Team members info, founders, employees (NOT personal bio)
- startup_use_of_funds: How funding will be used, financial plans

OTHER:
- insurance_profile: Insurance-related information
- generic_other: Information that doesn't fit other categories

IMPORTANT: 
- "personal_bio" = individual's background and experience
- "startup_team" = information about OTHER team members
- "personal_work_history" = individual's career path and roles
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
        # Use more powerful model for ingestion - better semantic understanding
        ingest_model = getattr(settings, 'OPENAI_INGEST_MODEL', settings.OPENAI_MODEL)
        
        response = await client.chat.completions.create(
            model=ingest_model,
            messages=[
                {"role": "system", "content": "You are a document analysis expert. Extract structured knowledge chunks from documents with deep semantic understanding."},
                {"role": "user", "content": prompt}
            ]
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

PERSONAL (about the individual filling the form):
- personal_basic: Name, age, marital status, nationality, gender
- personal_contact: Email, phone, address, location, city, websites
- personal_bio: "About you", "Tell us about yourself", background, career summary
- personal_skills: "Your skills", technical competencies, expertise
- personal_education: Degrees, certifications, university, "where did you study"
- personal_work_history: Work experience, past jobs, career history, previous roles
- personal_achievements: Awards, accomplishments, recognitions
- personal_interests: Professional interests, focus areas, passions

COMPANY (about the business):
- startup_one_liner: Brief company description (1-2 sentences)
- startup_problem: "What problem are you solving?", pain point
- startup_solution: "How does it work?", approach, technology
- startup_traction: Metrics, users, revenue, growth, customers, KPIs
- startup_team: "About your team", team members, founders (NOT personal bio)
- startup_use_of_funds: "How will you use funding?", financial plans

OTHER:
- insurance_profile: Insurance-related
- generic_other: Anything else

CRITICAL DISTINCTIONS:
- "Tell us about yourself" → personal_bio (NOT startup_team)
- "Your background" → personal_bio (NOT startup_team)
- "Work experience" → personal_work_history (NOT startup_team)
- "About your team" → startup_team
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
        # Use faster model for classification - simpler task
        suggest_model = getattr(settings, 'OPENAI_SUGGEST_MODEL', settings.OPENAI_MODEL)
        
        response = await client.chat.completions.create(
            model=suggest_model,
            messages=[
                {"role": "system", "content": "You are a form field classification expert. Analyze field context and determine what information is being requested."},
                {"role": "user", "content": prompt}
            ]
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

INSTRUCTIONS:
1. **Use ONLY facts from the provided knowledge** - never invent information
2. **Match the field category exactly**:
   - If category is "personal_bio", extract info about the INDIVIDUAL'S background
   - If category is "startup_team", extract info about TEAM MEMBERS
   - If category is "personal_work_history", extract the individual's JOB HISTORY
   - If category is "personal_contact", extract email/phone/location
3. **Respect the max length**: {classification.max_length or "No limit"}
4. **Use {classification.tone} tone**
5. **Format appropriately**: 
   - Short fields (name, email): Just the value
   - Long fields (bio, description): Well-formatted paragraph
6. **If no relevant information found**: Return "N/A"
7. **Return ONLY the field text** - no explanations, no labels

Generate the field response:"""

    try:
        # Use faster model for suggestions - simpler task with pre-categorized chunks
        suggest_model = getattr(settings, 'OPENAI_SUGGEST_MODEL', settings.OPENAI_MODEL)
        
        response = await client.chat.completions.create(
            model=suggest_model,
            messages=[
                {"role": "system", "content": "You are an expert form-filling assistant. Generate concise, accurate responses based strictly on provided information."},
                {"role": "user", "content": prompt}
            ],
            max_completion_tokens=classification.max_length if classification.max_length and classification.max_length < 4000 else 500
        )
        
        suggestion_text = response.choices[0].message.content.strip()
        
        # Remove quotes if the LLM wrapped the response
        if suggestion_text.startswith('"') and suggestion_text.endswith('"'):
            suggestion_text = suggestion_text[1:-1]
        
        return SuggestionResult(suggestion_text=suggestion_text)
    
    except Exception as e:
        print(f"Error in call_llm_suggest: {e}")
        raise

