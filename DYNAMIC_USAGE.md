# Dynamic Categorization Usage Guide

## 🎯 What's Different?

### ❌ Old System (Legacy):
- Hardcoded categories: `personal_basic`, `startup_team`, etc.
- Only works with anticipated document types
- Requires code changes to add new categories

### ✅ New System (Dynamic):
- **NO hardcoded categories!**
- AI discovers what's in each document
- Works with **ANY** document type
- Fully general-purpose

---

## 🚀 Quick Start

### 1. Upload a Document (Dynamic Discovery)

```bash
curl -X POST http://localhost:8000/dynamic/ingest/dynamic \
  -F "file=@my-resume.pdf"
```

**Response:**
```json
{
  "document_index": {
    "document_id": "doc_abc123",
    "source_file": "my-resume.pdf",
    "discovered_topics": [
      {
        "topic": "Professional Software Engineering Experience",
        "subtopics": ["backend development", "system architecture"],
        "confidence": 0.95
      }
    ],
    "all_tags": [
      "software engineering experience",
      "backend development",
      "leadership in tech teams",
      "contact information",
      "email address"
    ],
    "chunk_count": 8,
    "chunks": [...]
  },
  "summary": "Discovered 3 topics and 15 unique semantic tags across 8 chunks."
}
```

### 2. Get a Suggestion (Dynamic Matching)

```bash
curl -X POST http://localhost:8000/dynamic/suggest/dynamic \
  -H "Content-Type: application/json" \
  -d '{
    "field_id": "bio",
    "label_text": "Tell us about your leadership experience",
    "placeholder": "Describe your experience leading teams"
  }'
```

**Response:**
```json
{
  "suggestion_text": "I led a team of 15 engineers building...",
  "field_intent": "leadership experience in managing technical teams",
  "matched_chunks": 3,
  "top_tags": ["leadership experience", "team management", "engineering leadership"]
}
```

---

## 📊 View Discovered Information

### See All Tags Across All Documents

```bash
curl http://localhost:8000/dynamic/tags/all
```

**Response:**
```json
{
  "total_tags": 42,
  "tags": [
    "backend development experience",
    "contact email",
    "engineering leadership",
    "professional background",
    "software architecture skills",
    "technical skills with Python",
    ...
  ],
  "documents": 3
}
```

### List All Documents

```bash
curl http://localhost:8000/dynamic/documents
```

**Response:**
```json
{
  "documents": [
    {
      "document_id": "doc_123",
      "source_file": "resume.pdf",
      "topics": ["Professional Experience", "Technical Skills"],
      "tags_count": 15,
      "chunks_count": 8,
      "uploaded_at": "2025-01-01T12:00:00"
    }
  ],
  "total": 1
}
```

---

## 🧪 Testing Examples

### Example 1: Resume

**Upload:**
```bash
curl -X POST http://localhost:8000/dynamic/ingest/dynamic \
  -F "file=@samples/test-profile.txt"
```

**AI Discovers:**
- "professional software engineering experience"
- "backend development skills"
- "contact information"
- "email address"
- "location in San Francisco"
- "leadership experience"
- "MIT education background"
- "startup founding experience"
- ...

**Test Field Matching:**
```bash
# Field: "Tell us about yourself"
# Matches: "professional background", "career summary", "personal bio"

# Field: "Your email"
# Matches: "contact email", "email address"

# Field: "Work experience"
# Matches: "professional experience", "career history", "past jobs"
```

### Example 2: Business Plan

**Upload:**
```bash
curl -X POST http://localhost:8000/dynamic/ingest/dynamic \
  -F "file=@business-plan.pdf"
```

**AI Discovers:**
- "company mission statement"
- "market problem being solved"
- "solution approach"
- "business model description"
- "revenue projections"
- "target market demographics"
- "competitive advantages"
- ...

### Example 3: Medical History

**Upload:**
```bash
curl -X POST http://localhost:8000/dynamic/ingest/dynamic \
  -F "file=@medical-records.pdf"
```

**AI Discovers:**
- "medical history"
- "current medications"
- "allergies and reactions"
- "past surgeries"
- "family medical history"
- "blood type information"
- ...

**It works with ANY domain!**

---

## 🔍 How It Works

### Step 1: Document Upload
```
User uploads resume.pdf
    ↓
AI analyzes document
    ↓
Discovers semantic topics and tags
    ↓
Creates DocumentIndex with dynamic tags
    ↓
Stores in memory (or database)
```

### Step 2: Form Field Focus
```
User clicks "Tell us about leadership"
    ↓
AI understands field intent
    ↓
Searches ALL tags across ALL documents
    ↓
Finds matching chunks
    ↓
Generates suggestion
```

### Step 3: Semantic Matching
```
Field: "Tell us about yourself"
    ↓
Intent: "personal background and experience"
    ↓
Search tags: ["professional background", "career summary", "personal bio", ...]
    ↓
Match chunks with these tags
    ↓
Generate personalized response
```

---

## 💾 Data Structure

### Chunk with Semantic Tags
```json
{
  "id": "chunk_abc123",
  "source_file": "resume.pdf",
  "body": "I led a team of 15 engineers building...",
  "semantic_tags": [
    "leadership experience",
    "team management",
    "engineering management",
    "past work experience",
    "technical leadership"
  ],
  "related_topics": ["Professional Experience"],
  "metadata": {
    "length": "medium",
    "tone": "professional",
    "language": "en"
  }
}
```

---

## 🎯 Benefits

### 1. Universal Compatibility
- ✅ Works with resumes
- ✅ Works with business plans
- ✅ Works with medical records
- ✅ Works with legal documents
- ✅ Works with ANYTHING!

### 2. Better Accuracy
- Semantic understanding vs keyword matching
- "Leadership experience" matches "managing teams", "led engineers", etc.
- No confusion between categories

### 3. No Maintenance
- No need to update code for new document types
- Users can upload any type of content
- System adapts automatically

### 4. Transparent
- Users can see what was discovered
- Can view all tags
- Can understand why suggestions were made

---

## 🔧 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/dynamic/ingest/dynamic` | POST | Upload & analyze document |
| `/dynamic/suggest/dynamic` | POST | Get suggestion for field |
| `/dynamic/tags/all` | GET | View all discovered tags |
| `/dynamic/documents` | GET | List all documents |
| `/dynamic/documents/{id}` | DELETE | Delete a document |
| `/dynamic/documents` | DELETE | Clear all documents |

---

## 🚀 Migration from Legacy

### Option 1: Side-by-Side
- Keep old system for backward compatibility
- Use new system for new uploads
- Gradually migrate

### Option 2: Full Migration
- Switch all endpoints to dynamic
- Re-upload existing documents
- Remove legacy code

---

## 📈 Next Steps

1. **Test with your documents**
   - Upload various types of documents
   - See what topics are discovered
   - Test field matching

2. **Update extension**
   - Point to `/dynamic/` endpoints
   - Use dynamic suggestion flow

3. **Monitor performance**
   - Check accuracy of suggestions
   - Verify semantic matching works well

4. **Iterate and improve**
   - Fine-tune prompts if needed
   - Add embeddings for better matching
   - Optimize performance

---

## 🎉 Result

A truly **general-purpose** autofill system that works with any document type, any language, any domain!

No more hardcoded categories! 🚀

