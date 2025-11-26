"""
FAST Dynamic AI System with Heavy Preprocessing
- Upload: Slow (30-60s) - generates embeddings, pre-processes everything
- Suggestion: FAST (2-3s) - uses embeddings + single AI call
"""

import json
import numpy as np
from typing import List, Dict, Tuple
from openai import AsyncOpenAI
from app.config import settings
from app.models_dynamic import SemanticChunk, DocumentIndex, DiscoveredTopic
from app.utils.id_generation import generate_stable_chunk_id

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


async def analyze_document_fast(text: str, source_file_name: str) -> DocumentIndex:
    """
    Analyze document with HEAVY preprocessing for fast suggestions later.
    This can take 30-60 seconds - that's OK, it's one-time!
    
    Does:
    1. AI discovers topics and tags
    2. Generates embeddings for all chunks
    3. Pre-computes semantic relationships
    
    Returns:
        DocumentIndex with embeddings for fast matching
    """
    
    print(f"🔄 Starting heavy preprocessing for {source_file_name}...")
    print("   This may take 30-60s but will make suggestions MUCH faster!")
    
    # Step 1: Discover topics and tags (same as before)
    prompt = f"""Analyze this document and discover semantic topics and create chunks.

Your task:
1. Break into logical chunks (keep chunks focused and specific)
2. For EACH chunk, create 3-5 SPECIFIC semantic tags
3. Think: "What would someone ASK FOR to get this chunk?"
4. Discover high-level topics

Document:
{text}

Return JSON:
{{
  "discovered_topics": [
    {{
      "topic": "Professional Software Engineering Experience",
      "subtopics": ["backend", "Python", "cloud"],
      "confidence": 0.95
    }}
  ],
  "chunks": [
    {{
      "body": "actual text",
      "semantic_tags": [
        "full name and identity",
        "person's legal name", 
        "individual name"
      ],
      "related_topics": ["Personal Information"],
      "metadata": {{"length": "short", "tone": "professional", "language": "en"}}
    }}
  ]
}}

Make tags SPECIFIC and use natural language!
Return ONLY JSON."""

    try:
        # Use powerful model for discovery
        ingest_model = getattr(settings, 'OPENAI_INGEST_MODEL', settings.OPENAI_MODEL)
        
        print(f"   Step 1/3: AI analyzing document with {ingest_model}...")
        response = await client.chat.completions.create(
            model=ingest_model,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert at analyzing documents and discovering semantic structure."
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
        
        # Step 2: Build chunks and generate embeddings
        print(f"   Step 2/3: Generating embeddings for {len(data.get('chunks', []))} chunks...")
        
        chunks = []
        all_tags = set()
        texts_for_embedding = []  # Collect all texts for batch embedding
        
        for i, chunk_data in enumerate(data.get("chunks", [])):
            chunk_id = generate_stable_chunk_id(
                source_file_name,
                f"chunk_{i}",
                chunk_data.get("body", "")
            )
            
            tags = chunk_data.get("semantic_tags", [])
            all_tags.update(tags)
            
            # Combine body + tags for embedding
            embedding_text = chunk_data.get("body", "") + " " + " ".join(tags)
            texts_for_embedding.append(embedding_text)
            
            chunk = SemanticChunk(
                id=chunk_id,
                source_file=source_file_name,
                body=chunk_data.get("body", ""),
                semantic_tags=tags,
                related_topics=chunk_data.get("related_topics", []),
                metadata=chunk_data.get("metadata", {})
            )
            chunks.append(chunk)
        
        # Generate embeddings for ALL chunks in one batch call (faster!)
        embeddings = await generate_embeddings_batch(texts_for_embedding)
        
        # Add embeddings to chunks
        for i, chunk in enumerate(chunks):
            chunk.metadata['embedding'] = embeddings[i].tolist()  # Store as list for JSON
        
        print(f"   ✅ Generated {len(embeddings)} embeddings")
        
        # Step 3: Build topics
        print(f"   Step 3/3: Building topic index...")
        discovered_topics = []
        for topic_data in data.get("discovered_topics", []):
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
        
        print(f"   ✅ Preprocessing complete!")
        print(f"   📊 {len(discovered_topics)} topics, {len(all_tags)} tags, {len(chunks)} chunks with embeddings")
        
        return doc_index
    
    except Exception as e:
        print(f"❌ Error in fast document analysis: {e}")
        raise


async def generate_embeddings_batch(texts: List[str]) -> np.ndarray:
    """
    Generate embeddings for multiple texts in one API call.
    Much faster than individual calls!
    """
    if not texts:
        return np.array([])
    
    try:
        response = await client.embeddings.create(
            model="text-embedding-3-small",  # Fast and cheap!
            input=texts
        )
        
        embeddings = [item.embedding for item in response.data]
        return np.array(embeddings)
    
    except Exception as e:
        print(f"Error generating embeddings: {e}")
        raise


def cosine_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:
    """Calculate cosine similarity between two vectors"""
    dot_product = np.dot(vec1, vec2)
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    return dot_product / (norm1 * norm2) if norm1 and norm2 else 0.0


async def fast_match_chunks(
    field_context: Dict,
    all_chunks: List[Dict],
    top_k: int = 5
) -> List[Dict]:
    """
    FAST matching using embeddings (no AI calls needed!)
    Uses cosine similarity - takes milliseconds!
    
    Args:
        field_context: Field information
        all_chunks: All chunks from IndexedDB (with embeddings)
        top_k: Number of top matches to return
        
    Returns:
        Top matching chunks ranked by relevance
    """
    
    # Create field description for embedding
    # Handle None values explicitly (field_context values can be None)
    field_desc = " ".join([
        field_context.get('label_text') or '',
        field_context.get('placeholder') or '',
        field_context.get('name_attr') or '',
    ]).strip()
    
    if not field_desc:
        field_desc = "general information"
    
    print(f"   🔍 Fast matching for: '{field_desc}'")
    
    # Generate embedding for field (single call, fast!)
    field_embeddings = await generate_embeddings_batch([field_desc])
    field_embedding = field_embeddings[0]
    
    # Calculate similarity with all chunks (pure math, instant!)
    similarities = []
    for chunk in all_chunks:
        # Get chunk embedding
        chunk_embedding_list = chunk.get('metadata', {}).get('embedding')
        if not chunk_embedding_list:
            # Fallback: chunk doesn't have embedding (shouldn't happen)
            continue
        
        chunk_embedding = np.array(chunk_embedding_list)
        
        # Calculate cosine similarity
        similarity = cosine_similarity(field_embedding, chunk_embedding)
        
        similarities.append({
            'chunk': chunk,
            'similarity': float(similarity)
        })
    
    # Sort by similarity
    similarities.sort(key=lambda x: x['similarity'], reverse=True)
    
    # Get top K matches
    top_matches = similarities[:top_k]
    
    print(f"   ✅ Found {len(top_matches)} matches in milliseconds!")
    for match in top_matches:
        tags = match['chunk'].get('semantic_tags', [])
        print(f"      - {tags[:2]} (similarity: {match['similarity']:.3f})")
    
    return [m['chunk'] for m in top_matches]


async def fast_generate_suggestion(
    field_context: Dict,
    matched_chunks: List[Dict]
) -> str:
    """
    Generate suggestion from matched chunks with SINGLE AI call.
    Fast and accurate!
    
    Args:
        field_context: Field information
        matched_chunks: Top matching chunks (already found via embeddings)
        
    Returns:
        Suggestion text
    """
    
    if not matched_chunks:
        return "N/A"
    
    # Build context from top chunks
    chunks_context = []
    for i, chunk in enumerate(matched_chunks[:3], 1):  # Use top 3
        tags = chunk.get('semantic_tags', [])
        body = chunk.get('body', '')
        chunks_context.append(f"[Source {i}] {body}")
    
    field_label = field_context.get('label_text', 'Unknown field')
    field_placeholder = field_context.get('placeholder', '')
    max_length = field_context.get('max_length')
    
    # Build length instruction based on field constraints
    if max_length and max_length <= 300:
        length_instruction = f"This field allows up to {max_length} characters. Use AS MUCH of this space as possible! Aim for {int(max_length * 0.9)}-{max_length} characters."
    elif max_length:
        length_instruction = f"Maximum {max_length} characters."
    else:
        length_instruction = "No length limit - provide comprehensive, detailed information."
    
    # Single optimized AI call
    prompt = f"""You are filling out a form field. Extract relevant information from the provided context.

FIELD TO FILL:
- Label: {field_label}
{f'- Hint: {field_placeholder}' if field_placeholder else ''}
- {length_instruction}

RELEVANT INFORMATION (already matched to this field):
{chr(10).join(chunks_context)}

CRITICAL RULES:
1. Extract information from the context above that answers what the field is asking for
2. Write a complete, well-formatted response using the information provided
3. NEVER return empty string or just "N/A" if you have any relevant information
4. For long fields: Write detailed, comprehensive responses
5. For short fields (name, email, phone): Extract just the specific value
6. If the field asks "How does X work?" or "What is X?" → Provide a full explanation from the context
7. Use most/all of the available character space
8. Return ONLY the text to put in the field (no labels, no "Answer:", no explanations)

Now extract and format the information for this field:"""

    try:
        # Use fast model for suggestion
        suggest_model = getattr(settings, 'OPENAI_SUGGEST_MODEL', settings.OPENAI_MODEL)
        
        # GPT-5 uses tokens for BOTH reasoning AND content
        # Set high enough limit so it ALWAYS has enough for both
        # We can tune this down later if needed, but for now: ensure it works!
        token_limit = 4000  # High enough for any field + GPT-5 reasoning
        
        response = await client.chat.completions.create(
            model=suggest_model,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert form-filling assistant. Generate accurate, concise responses."
                },
                {"role": "user", "content": prompt}
            ],
            max_completion_tokens=token_limit
        )
        
        suggestion = response.choices[0].message.content
        
        if not suggestion:
            print(f"   ⚠️ WARNING: AI returned None/null!")
            return "N/A"
        
        suggestion = suggestion.strip()
        
        if not suggestion:
            print(f"   ⚠️ WARNING: AI returned empty string after strip!")
            return "N/A"
        
        # Remove quotes if wrapped
        if suggestion.startswith('"') and suggestion.endswith('"'):
            suggestion = suggestion[1:-1]
        
        # Final check
        if not suggestion or suggestion.lower() == 'n/a':
            print(f"   ⚠️ WARNING: Final suggestion is empty or N/A!")
            return "No relevant information found in your documents for this field."
        
        # Log the actual suggestion for debugging
        print(f"   📝 Full suggestion ({len(suggestion)} chars): {suggestion[:150]}{'...' if len(suggestion) > 150 else ''}")
        
        return suggestion
    
    except Exception as e:
        print(f"Error generating suggestion: {e}")
        raise

