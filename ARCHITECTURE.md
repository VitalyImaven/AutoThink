# Architecture Documentation

## System Overview

AI Smart Autofill is designed as a **two-tier architecture** with strict separation between frontend (Chrome extension) and backend (Python API).

```
┌─────────────────────────────────────────────────────────────┐
│                        USER / BROWSER                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    CHROME EXTENSION                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Content    │  │  Background  │  │   Options    │      │
│  │   Script     │◄─┤   Service    │  │     Page     │      │
│  │              │  │   Worker     │  │   (React)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                            ▼                                 │
│                   ┌─────────────────┐                        │
│                   │   IndexedDB     │                        │
│                   │ (Local Storage) │                        │
│                   └─────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/JSON
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     FASTAPI BACKEND                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Ingest     │  │  Classify    │  │   Suggest    │      │
│  │   Route      │  │   Route      │  │    Route     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                            │                                 │
│                            ▼                                 │
│                   ┌─────────────────┐                        │
│                   │ OpenAI Client   │                        │
│                   └─────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ API Calls
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      OPENAI API                              │
│                  (GPT-4 / GPT-3.5)                           │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### Chrome Extension

#### 1. Content Script (`content.ts`)
**Role:** DOM interaction and field detection

- Runs on all web pages
- Listens for focus events on form fields
- Extracts field context (labels, placeholders, nearby text)
- Displays suggestion popups
- Handles user acceptance/rejection of suggestions

**Key Functions:**
- `extractFieldContext()` - Gathers field metadata
- `showSuggestionPopup()` - Creates and positions popup UI
- `acceptSuggestion()` - Inserts text into field

#### 2. Background Service Worker (`background.ts`)
**Role:** Coordination and API communication

- Receives messages from content scripts
- Caches field classifications to avoid redundant API calls
- Queries IndexedDB for relevant knowledge chunks
- Makes HTTP requests to backend API
- Routes suggestions back to content scripts

**Key Functions:**
- `handleFieldFocused()` - Main orchestration logic
- `classifyField()` - Backend API call
- `generateSuggestion()` - Backend API call
- Classification caching by (hostname, pathname, field attributes)

#### 3. Options Page (`options/App.tsx`)
**Role:** User interface for knowledge management

- File upload interface (drag & drop)
- Document processing and ingestion
- Knowledge base visualization
- Chunk statistics and management

**Key Functions:**
- `handleFileSelect()` - Process uploaded files
- `loadKnowledgeBase()` - Display stored chunks
- `handleClearKnowledgeBase()` - Clear all data

#### 4. IndexedDB (`db/index.ts`)
**Role:** Local persistent storage

- Stores knowledge chunks locally
- Indexed by category for fast retrieval
- Upsert semantics (stable chunk IDs)

**Schema:**
```typescript
knowledge_chunks: {
  key: meta.id,
  indexes: {
    by-category: meta.category,
    by-source: meta.source_file
  }
}
```

### Backend (FastAPI)

#### 1. Ingestion Route (`routes_ingest.py`)
**Endpoint:** `POST /ingest/text`

**Flow:**
1. Receive document text + filename
2. Call OpenAI to analyze and chunk document
3. Generate stable chunk IDs
4. Return structured knowledge chunks

**LLM Prompt Strategy:**
- Ask LLM to identify logical sections
- Classify each section into predefined categories
- Extract metadata (tags, priority, length)
- Return structured JSON

#### 2. Classification Route (`routes_classify.py`)
**Endpoint:** `POST /classify-field`

**Flow:**
1. Receive field context (label, placeholder, etc.)
2. Call OpenAI to determine field intent
3. Return category + metadata (tone, max_length)

**LLM Prompt Strategy:**
- Provide all field attributes as context
- List available categories with descriptions
- Ask for confidence score
- Return structured classification

#### 3. Suggestion Route (`routes_suggest.py`)
**Endpoint:** `POST /suggest`

**Flow:**
1. Receive field context + classification + relevant chunks
2. Call OpenAI to synthesize answer from chunks
3. Return suggested text

**LLM Prompt Strategy:**
- Provide field context and requirements
- Include knowledge chunks as source material
- Enforce constraints (max length, tone)
- Instruct to use ONLY provided information (no hallucination)

#### 4. OpenAI Client (`openai_client.py`)
**Role:** LLM interaction wrapper

Three main functions:
- `call_llm_ingest()` - Document analysis
- `call_llm_classify()` - Field classification
- `call_llm_suggest()` - Suggestion generation

All use structured prompts and JSON response parsing.

## Data Flow

### Document Upload Flow

```
User uploads file
      ↓
Options Page reads file content
      ↓
POST /ingest/text (filename + text)
      ↓
Backend LLM analyzes document
      ↓
Returns KnowledgeChunk[]
      ↓
Extension saves to IndexedDB
      ↓
Ready for use
```

### Suggestion Generation Flow

```
User focuses form field
      ↓
Content script extracts FieldContext
      ↓
Sends message to Background
      ↓
Background checks classification cache
      ↓
If not cached: POST /classify-field
      ↓
Query IndexedDB by category
      ↓
POST /suggest (field + classification + chunks)
      ↓
Backend LLM generates suggestion
      ↓
Background sends to Content script
      ↓
Content script shows popup
      ↓
User accepts → insert into field
```

## Data Models

All data models are defined identically in both Python (Pydantic) and TypeScript:

### KnowledgeChunk
```python
{
  meta: {
    id: str,              # Stable hash
    source_file: str,
    section: str | None,
    category: KnowledgeCategory,
    language: str,
    length_hint: "short" | "medium" | "long" | None,
    tags: List[str],
    priority: float | None  # 0-1
  },
  body: str
}
```

### FieldContext
```python
{
  field_id: str,          # UUID for this instance
  name_attr: str | None,
  id_attr: str | None,
  label_text: str | None,
  placeholder: str | None,
  nearby_text: str | None,
  max_length: int | None
}
```

### ClassificationResult
```python
{
  category: KnowledgeCategory,
  max_length: int | None,
  tone: "professional" | "casual" | "formal" | None,
  confidence: float  # 0-1
}
```

## Extensibility Points

### Adding New Categories

1. Update `KnowledgeCategory` enum in:
   - `backend/app/models.py`
   - `extension/src/types.ts`

2. Update LLM prompts with category descriptions:
   - `backend/app/openai_client.py` (all three functions)

3. Optionally update UI colors:
   - `extension/src/options/App.tsx` (`getCategoryColor()`)

### Adding New Endpoints

1. Create new route file in `backend/app/`
2. Define Pydantic request/response models in `models.py`
3. Add corresponding TypeScript types in `extension/src/types.ts`
4. Include router in `main.py`
5. Call from extension (background or options page)

### Enhancing Suggestions

Current: Single suggestion per field

Future possibilities:
- Multiple suggestions with ranking
- Interactive refinement ("make it shorter", "more formal")
- Manual category selection
- Region-based extraction from documents
- Suggestion history and learning

Implementation: Extend `routes_suggest.py` and `background.ts`

### Supporting More File Types

Current: `.txt`, `.md`

To add (e.g., PDF, DOCX):
1. Add file parsing in options page
2. Extract text content
3. Send to existing `/ingest/text` endpoint

No backend changes needed!

## Performance Considerations

### Caching Strategy

**Field Classification Cache:**
- Key: `hostname:pathname:label:name:id`
- Stored in: Background worker memory
- Lifetime: Extension session
- Benefit: Avoid redundant classification calls for same form

**Future:** Consider persistent cache in chrome.storage

### Chunk Retrieval Optimization

Current: Fetch all chunks for category, sort by priority, take top 10

Future optimizations:
- Add more indexes (language, tags)
- Implement relevance scoring
- Use semantic search (embeddings)

### Rate Limiting

Not currently implemented. Consider:
- Debouncing rapid field focus events
- Request queuing in background worker
- Backend rate limiting per extension instance

## Security Considerations

### Data Privacy

- ✅ All knowledge stored locally (IndexedDB)
- ✅ No external persistence
- ✅ User controls all data
- ✅ Can clear anytime

### API Security

- ⚠️ Backend currently has no authentication
- ⚠️ CORS allows all origins

For production:
- Add API key authentication
- Restrict CORS to specific origins
- Implement rate limiting
- Add request validation

### Content Script Injection

- ✅ Only runs on user-visited pages
- ✅ No automatic form submission
- ✅ User must accept suggestions
- ✅ XSS protection via proper escaping

## Error Handling

### Backend Errors

- Invalid input → HTTP 400 with details
- LLM failures → HTTP 500 with message
- All exceptions caught and logged

### Extension Errors

- Network failures → Error message to user
- Missing knowledge → Suggestion error popup
- Invalid responses → Logged to console

All errors are graceful; extension remains functional.

## Testing Strategy

### Backend Testing

```bash
# Manual API testing
curl http://localhost:8000/health
curl -X POST http://localhost:8000/ingest/text -H "Content-Type: application/json" -d '{"source_file_name":"test.txt","text":"..."}'
```

### Extension Testing

1. Build and load extension
2. Upload sample documents
3. Visit test forms (see TESTING.md)
4. Check console for errors
5. Verify suggestions appear

### Integration Testing

End-to-end flow:
1. Upload document → verify chunks in IndexedDB
2. Focus field → verify classification call
3. Check suggestion → verify correct category used
4. Accept suggestion → verify field filled

## Monitoring & Debugging

### Backend Logs

FastAPI logs all requests:
- Request method and path
- Response status
- Errors with stack traces

### Extension Logs

Check browser console (F12):
- Content script: Page-specific logs
- Background: Extension-wide logs
- Options page: Upload and DB operations

Key log points:
- Field focus detected
- Classification result
- Chunks retrieved
- Suggestion generated

## Deployment Considerations

### Backend Deployment

Options:
- Docker container
- Cloud services (AWS, GCP, Azure)
- Serverless (AWS Lambda + API Gateway)

Requirements:
- Python 3.11+
- OpenAI API access
- HTTPS for production

### Extension Distribution

Options:
- Chrome Web Store (public)
- Enterprise deployment (private)
- Developer mode (testing)

Requirements:
- Valid icons (proper sizes)
- Privacy policy (if collecting data)
- Manifest V3 compliance

### Configuration Management

Environment-based config:
- Development: localhost
- Production: deployed backend URL

Update `extension/src/config.ts` before building for production.

## Future Architecture Improvements

### Potential Enhancements

1. **Vector Search**
   - Store embeddings for semantic search
   - Better chunk relevance matching

2. **Offline Mode**
   - Cache common suggestions
   - Fallback to simple templates

3. **Multi-user Support**
   - Backend authentication
   - Cloud knowledge sync

4. **Learning & Adaptation**
   - Track accepted/rejected suggestions
   - Improve ranking over time

5. **Advanced UI**
   - Side panel for context
   - Suggestion preview before focus
   - Manual editing interface

All achievable with current architecture!

