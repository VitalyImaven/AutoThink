# Dynamic Categorization Architecture

## 🎯 Vision

Make AutoThink **truly general-purpose** by:
- ❌ NO hardcoded categories
- ✅ AI discovers content types dynamically
- ✅ Works with ANY document type
- ✅ Adapts to user's specific needs

---

## 🔄 Current vs New Approach

### ❌ Current (Fixed Categories)
```
Document → Check against predefined list → Assign category → Store
                ↓
    [personal_basic, startup_team, ...]
```

**Problem:** Only works for documents we anticipated!

### ✅ New (Dynamic Discovery)
```
Document → AI analyzes → Discovers semantic topics → Create dynamic tags → Store
                ↓
    ["Professional Background", "Technical Expertise", 
     "Project History", "Leadership Experience", ...]
```

**Benefit:** Works with ANY document!

---

## 🏗️ Implementation Design

### 1. Dynamic Chunk Structure

```json
{
  "id": "chunk_abc123",
  "source_file": "resume.pdf",
  "body": "Led a team of 15 engineers...",
  "semantic_tags": [
    "leadership experience",
    "team management", 
    "engineering management",
    "past work experience"
  ],
  "embeddings": [0.123, 0.456, ...],  // Optional: for semantic search
  "metadata": {
    "length": "medium",
    "tone": "professional",
    "language": "en",
    "confidence": 0.95
  }
}
```

### 2. Document Analysis Prompt

```python
"""
Analyze this document and extract semantic topics.

For each chunk of information, identify:
1. What TYPE of information is this? (be specific)
2. What would someone ASK FOR to get this information?
3. Alternative ways to describe this information

Document:
{text}

Return JSON:
[
  {
    "body": "...",
    "semantic_tags": ["tag1", "tag2", "tag3"],
    "description": "What this chunk is about"
  }
]

Examples of good semantic tags:
- "professional experience" (not just "experience")
- "technical skills with Python" (not just "skills")  
- "leadership in healthcare" (not just "leadership")
- "contact information" (universal)
- "company mission statement" (specific)
"""
```

### 3. Field Matching Algorithm

**Option A: Semantic Similarity**
```python
# When user focuses on field:
field_description = extract_field_context(field)
# "Tell us about your leadership experience"

# Find matching chunks:
for chunk in all_chunks:
    for tag in chunk.semantic_tags:
        similarity = calculate_similarity(field_description, tag)
        if similarity > threshold:
            candidate_chunks.append(chunk)

# Rank and pick best matches
```

**Option B: LLM-based Matching**
```python
# Ask AI to match field to available tags
prompt = f"""
Field: {field_description}

Available semantic tags across all documents:
{all_unique_tags}

Which tags are most relevant? Return top 5.
"""

# Then retrieve chunks with those tags
```

---

## 📁 Storage Structure

### JSON Schema (per document)

```json
{
  "document_id": "doc_123",
  "source_file": "my-resume.pdf",
  "uploaded_at": "2025-01-01T12:00:00Z",
  "discovered_topics": [
    {
      "topic": "software engineering experience",
      "subtopics": ["backend development", "system architecture", "API design"],
      "chunk_count": 3
    },
    {
      "topic": "education background",
      "subtopics": ["computer science degree", "MIT", "machine learning"],
      "chunk_count": 2
    }
  ],
  "chunks": [
    {
      "id": "chunk_1",
      "body": "...",
      "semantic_tags": ["software engineering", "backend", "Python"],
      "related_to": ["professional experience", "technical skills"]
    }
  ],
  "all_tags": [
    "software engineering",
    "backend development",
    "Python expertise",
    "..." 
  ]
}
```

### IndexedDB Schema

```typescript
// Store in browser
interface DynamicChunk {
  id: string;
  source_file: string;
  body: string;
  semantic_tags: string[];
  metadata: {
    length: "short" | "medium" | "long";
    tone: string;
    language: string;
  };
}

interface DocumentIndex {
  document_id: string;
  source_file: string;
  all_tags: string[];  // For quick lookup
  topic_map: Record<string, string[]>;  // topic -> chunk_ids
}
```

---

## 🔍 Field Classification Process

### Step 1: Understand the Field
```python
field_context = {
  "label": "Tell us about your leadership experience",
  "placeholder": "Describe times you led teams...",
  "nearby_text": "Leadership & Management",
  "field_type": "textarea"
}

# AI extracts intent:
intent = {
  "seeking": "leadership experience",
  "context": "management, teams, leading people",
  "keywords": ["leadership", "management", "teams", "led"],
  "semantic_meaning": "past experiences in leadership roles"
}
```

### Step 2: Search Across All Documents
```python
# Get all unique tags from all documents
all_tags = get_all_semantic_tags()

# Find relevant tags
relevant_tags = find_matching_tags(intent, all_tags)
# ["leadership experience", "team management", "engineering management"]

# Get chunks with these tags
candidate_chunks = get_chunks_by_tags(relevant_tags)
```

### Step 3: Rank and Select
```python
# Rank by relevance
ranked_chunks = rank_by_relevance(
  chunks=candidate_chunks,
  field_intent=intent,
  max_results=5
)

# Generate suggestion from top chunks
suggestion = generate_suggestion(ranked_chunks, field_context)
```

---

## 🎯 Benefits

### 1. **Universal Compatibility**
- Works with resumes, business plans, medical records, legal docs, anything!
- No need to update code for new document types

### 2. **Better Accuracy**
- Semantic understanding vs keyword matching
- Can match "Tell us about leadership" with chunk tagged "managing teams"

### 3. **User Control**
- Users see what topics were discovered
- Can edit/refine tags if needed
- Can merge similar tags

### 4. **Scalability**
- Add new documents without changing system
- Tags evolve with user's content
- No category limits

---

## 🚀 Migration Path

### Phase 1: Keep Categories as Fallback
```python
# Try dynamic matching first
dynamic_result = match_dynamically(field)

# Fallback to categories if confidence low
if dynamic_result.confidence < 0.7:
    category_result = match_by_category(field)
    return category_result

return dynamic_result
```

### Phase 2: Fully Dynamic
```python
# Remove all hardcoded categories
# Pure semantic matching
```

---

## 💾 Example Flow

### User uploads resume.pdf:

1. **Extract text:** "...I led a team of 15 engineers..."

2. **AI discovers topics:**
```json
{
  "chunks": [
    {
      "body": "I led a team of 15 engineers building...",
      "semantic_tags": [
        "leadership experience",
        "team management",
        "engineering management", 
        "past work experience",
        "technical leadership"
      ]
    }
  ]
}
```

3. **Store in IndexedDB**

4. **User focuses on field: "Tell us about your leadership"**

5. **System matches:**
   - Field intent: "leadership experience"
   - Available tags: ["leadership experience", ...]
   - Match! Confidence: 0.95

6. **Generate suggestion from matched chunk**

---

## 🔧 Technical Implementation

### New Models

```python
class SemanticChunk(BaseModel):
    id: str
    source_file: str
    body: str
    semantic_tags: List[str]
    related_topics: List[str]
    metadata: Dict[str, Any]

class DocumentIndex(BaseModel):
    document_id: str
    source_file: str
    discovered_topics: List[str]
    all_tags: List[str]
    chunks: List[SemanticChunk]
```

### New Endpoints

```python
@router.post("/ingest/dynamic")
async def ingest_with_dynamic_discovery(file):
    """Analyze document and create dynamic semantic tags"""
    
@router.post("/search/semantic")
async def semantic_search(query: str):
    """Search across all chunks using semantic matching"""
    
@router.get("/tags/all")
async def get_all_tags():
    """Get all discovered semantic tags across documents"""
```

---

## 📊 Performance Considerations

### Optimization Strategies:

1. **Tag Indexing**
   - Build inverted index: tag → [chunk_ids]
   - Fast lookup of relevant chunks

2. **Caching**
   - Cache field → tags mapping
   - Cache frequently accessed chunks

3. **Embeddings** (Optional)
   - Generate embeddings for chunks
   - Fast semantic similarity search
   - Use vector DB (if needed)

4. **Lazy Loading**
   - Load document indices on startup
   - Load full chunks on demand

---

## 🎯 Result

A **truly general-purpose** autofill system that works with:
- ✅ Any document type
- ✅ Any language
- ✅ Any domain
- ✅ Any use case

No more hardcoded categories! 🚀

