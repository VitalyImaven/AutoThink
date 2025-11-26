"""
Dynamic AI-powered categorization - no hardcoded categories!
AI discovers semantic topics and tags from documents.
"""

import json
from typing import List
from openai import AsyncOpenAI
from app.config import settings
from app.models_dynamic import (
    SemanticChunk, DocumentIndex, DiscoveredTopic,
    FieldIntent, SemanticMatch, DynamicSuggestionRequest
)
from app.utils.id_generation import generate_stable_chunk_id

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


async def analyze_document_dynamically(text: str, source_file_name: str) -> DocumentIndex:
    """
    Analyze document and discover semantic topics dynamically.
    No predefined categories - AI discovers what's in the document!
    
    Args:
        text: Raw document text
        source_file_name: Original filename
        
    Returns:
        DocumentIndex with discovered topics and semantic tags
    """
    
    prompt = f"""Analyze this document and discover what types of information it contains.

Your task:
1. Break the document into logical chunks
2. For each chunk, identify semantic tags describing what it contains
3. Think about: "What would someone ASK FOR to get this information?"
4. Be SPECIFIC with tags (not just "experience", but "software engineering experience")
5. Discover high-level topics across the document

Document:
{text}

Return JSON in this exact format:
{{
  "discovered_topics": [
    {{
      "topic": "Professional Software Engineering Experience",
      "subtopics": ["backend development", "system architecture", "Python programming"],
      "confidence": 0.95
    }}
  ],
  "chunks": [
    {{
      "body": "the actual text content",
      "semantic_tags": [
        "software engineering experience",
        "backend development",
        "leadership in tech teams",
        "professional work history"
      ],
      "related_topics": ["Professional Software Engineering Experience"],
      "metadata": {{
        "length": "medium",
        "tone": "professional",
        "language": "en"
      }}
    }}
  ]
}}

Guidelines for semantic tags:
- Use natural language (how people would ask for this info)
- Be specific: "leadership experience in healthcare" not just "leadership"
- Think of multiple ways to describe the same info:
  * "email address", "contact email", "how to reach me"
  * "work history", "past jobs", "professional experience", "career background"
- Include universal tags: "contact information", "personal details"
- Include domain-specific tags: "medical history", "technical skills", "business metrics"

Return ONLY the JSON, no other text."""

    try:
        # Use powerful model for dynamic discovery
        ingest_model = getattr(settings, 'OPENAI_INGEST_MODEL', settings.OPENAI_MODEL)
        
        response = await client.chat.completions.create(
            model=ingest_model,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert at analyzing documents and discovering semantic structure. You understand that different documents contain different types of information, and you excel at identifying what's actually in each document without relying on predefined categories."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.3  # Lower temperature for more consistent tagging
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
        
        data = json.loads(content)
        
        # Build DocumentIndex
        chunks = []
        all_tags = set()
        
        for i, chunk_data in enumerate(data.get("chunks", [])):
            # Generate stable ID
            chunk_id = generate_stable_chunk_id(
                source_file_name,
                f"chunk_{i}",
                chunk_data.get("body", "")
            )
            
            tags = chunk_data.get("semantic_tags", [])
            all_tags.update(tags)
            
            chunk = SemanticChunk(
                id=chunk_id,
                source_file=source_file_name,
                body=chunk_data.get("body", ""),
                semantic_tags=tags,
                related_topics=chunk_data.get("related_topics", []),
                metadata=chunk_data.get("metadata", {})
            )
            chunks.append(chunk)
        
        # Build discovered topics
        discovered_topics = []
        for topic_data in data.get("discovered_topics", []):
            # Find chunks related to this topic
            topic_name = topic_data.get("topic", "")
            related_chunk_ids = [
                c.id for c in chunks
                if topic_name in c.related_topics
            ]
            
            topic = DiscoveredTopic(
                topic=topic_name,
                subtopics=topic_data.get("subtopics", []),
                chunk_ids=related_chunk_ids,
                confidence=topic_data.get("confidence", 0.8)
            )
            discovered_topics.append(topic)
        
        # Create DocumentIndex
        doc_index = DocumentIndex(
            document_id=generate_stable_chunk_id(source_file_name, "", ""),
            source_file=source_file_name,
            discovered_topics=discovered_topics,
            all_tags=sorted(list(all_tags)),
            chunk_count=len(chunks),
            chunks=chunks
        )
        
        return doc_index
    
    except Exception as e:
        print(f"Error in dynamic document analysis: {e}")
        raise


async def understand_field_intent(field_context: dict) -> FieldIntent:
    """
    Understand what a form field is asking for (semantic intent).
    
    Args:
        field_context: Field information (label, placeholder, etc.)
        
    Returns:
        FieldIntent with semantic understanding
    """
    
    field_info = f"""
Field context:
- Label: {field_context.get('label_text', 'N/A')}
- Placeholder: {field_context.get('placeholder', 'N/A')}
- Name: {field_context.get('name_attr', 'N/A')}
- ID: {field_context.get('id_attr', 'N/A')}
- Nearby text: {field_context.get('nearby_text', 'N/A')}
"""
    
    prompt = f"""Analyze this form field and determine what information it's asking for.

{field_info}

Return JSON:
{{
  "seeking": "brief description of what's being requested",
  "context": "related concepts and context",
  "keywords": ["key", "terms", "from", "field"],
  "semantic_meaning": "deep understanding of the intent",
  "confidence": 0.95
}}

Examples:
- Field "Tell us about yourself" → seeking: "personal background and experience"
- Field "Your email" → seeking: "contact email address"
- Field "Company description" → seeking: "brief description of the company/business"
- Field "What problem are you solving?" → seeking: "problem statement or pain point being addressed"

Be specific and think about how this would naturally match against document content.

Return ONLY the JSON."""

    try:
        suggest_model = getattr(settings, 'OPENAI_SUGGEST_MODEL', settings.OPENAI_MODEL)
        
        response = await client.chat.completions.create(
            model=suggest_model,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert at understanding form fields and what information they're requesting. You think about semantic meaning, not just keywords."
                },
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
        
        data = json.loads(content)
        
        return FieldIntent(
            field_id=field_context.get('field_id', 'unknown'),
            seeking=data.get("seeking", ""),
            context=data.get("context", ""),
            keywords=data.get("keywords", []),
            semantic_meaning=data.get("semantic_meaning", ""),
            confidence=data.get("confidence", 0.8)
        )
    
    except Exception as e:
        print(f"Error understanding field intent: {e}")
        raise


async def match_field_to_chunks(
    field_intent: FieldIntent,
    all_chunks: List[SemanticChunk],
    max_matches: int = 5
) -> List[SemanticMatch]:
    """
    Match a field's intent to relevant chunks using semantic matching.
    
    Args:
        field_intent: What the field is asking for
        all_chunks: All available chunks from all documents
        max_matches: Maximum number of matches to return
        
    Returns:
        List of SemanticMatch objects ranked by relevance
    """
    
    # Build context for matching
    all_tags = set()
    chunk_tags_map = {}
    for chunk in all_chunks:
        all_tags.update(chunk.semantic_tags)
        chunk_tags_map[chunk.id] = chunk.semantic_tags
    
    prompt = f"""Match this field intent to relevant semantic tags.

Field is asking for:
- Seeking: {field_intent.seeking}
- Context: {field_intent.context}
- Semantic meaning: {field_intent.semantic_meaning}
- Keywords: {', '.join(field_intent.keywords)}

Available semantic tags from documents:
{json.dumps(sorted(list(all_tags)), indent=2)}

Task: Return the top {max_matches} most relevant tags that match what this field is asking for.

Return JSON:
{{
  "relevant_tags": [
    {{"tag": "tag name", "relevance": 0.95, "reason": "why it matches"}},
    ...
  ]
}}

Think semantically:
- "Tell us about yourself" matches "personal background", "professional experience", "career summary"
- "Your email" matches "contact email", "email address", "how to reach"
- "Team info" matches "team members", "founding team", "team background" (NOT personal bio)

Return ONLY the JSON."""

    try:
        suggest_model = getattr(settings, 'OPENAI_SUGGEST_MODEL', settings.OPENAI_MODEL)
        
        response = await client.chat.completions.create(
            model=suggest_model,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert at semantic matching. You understand that different phrases can mean the same thing."
                },
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
        
        data = json.loads(content)
        
        # Find chunks with these tags
        matched_tags = {
            item["tag"]: item["relevance"]
            for item in data.get("relevant_tags", [])
        }
        
        matches = []
        for chunk in all_chunks:
            # Find matching tags
            chunk_matched_tags = [
                tag for tag in chunk.semantic_tags
                if tag in matched_tags
            ]
            
            if chunk_matched_tags:
                # Calculate relevance score (max of matching tag scores)
                relevance = max(matched_tags[tag] for tag in chunk_matched_tags)
                
                match = SemanticMatch(
                    chunk_id=chunk.id,
                    chunk_body=chunk.body,
                    matching_tags=chunk_matched_tags,
                    relevance_score=relevance,
                    source_file=chunk.source_file
                )
                matches.append(match)
        
        # Sort by relevance and return top matches
        matches.sort(key=lambda x: x.relevance_score, reverse=True)
        return matches[:max_matches]
    
    except Exception as e:
        print(f"Error matching field to chunks: {e}")
        raise


async def generate_dynamic_suggestion(request: DynamicSuggestionRequest) -> str:
    """
    Generate suggestion from matched chunks.
    
    Args:
        request: Request with field context and matched chunks
        
    Returns:
        Suggested text for the field
    """
    
    if not request.matched_chunks:
        return "N/A"
    
    # Build context from matched chunks
    chunks_context = []
    for match in request.matched_chunks:
        chunks_context.append(
            f"[Relevance: {match.relevance_score:.2f}] {match.chunk_body}"
        )
    
    field_ctx = request.field_context
    
    prompt = f"""Generate a response for this form field using the provided information.

Field is asking for: {request.field_intent.seeking}
Semantic meaning: {request.field_intent.semantic_meaning}

Field details:
- Label: {field_ctx.get('label_text', 'N/A')}
- Max length: {field_ctx.get('max_length', 'No limit')}

Matched information (ranked by relevance):
{chr(10).join(chunks_context)}

Instructions:
1. Use ONLY the provided information
2. Match the field's intent exactly
3. Format appropriately for the field type
4. Be concise and relevant
5. If max length specified, respect it
6. Return ONLY the text to fill in the field

Generate the field response:"""

    try:
        suggest_model = getattr(settings, 'OPENAI_SUGGEST_MODEL', settings.OPENAI_MODEL)
        
        response = await client.chat.completions.create(
            model=suggest_model,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert form-filling assistant. You generate accurate, concise responses based on provided information."
                },
                {"role": "user", "content": prompt}
            ],
            max_completion_tokens=field_ctx.get('max_length', 500) if field_ctx.get('max_length') and field_ctx.get('max_length') < 4000 else 500
        )
        
        suggestion = response.choices[0].message.content.strip()
        
        # Remove quotes if wrapped
        if suggestion.startswith('"') and suggestion.endswith('"'):
            suggestion = suggestion[1:-1]
        
        return suggestion
    
    except Exception as e:
        print(f"Error generating suggestion: {e}")
        raise

