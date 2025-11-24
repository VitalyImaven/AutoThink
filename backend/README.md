# AI Smart Autofill Backend

FastAPI backend for the AI Smart Autofill Chrome extension.

## Setup

1. **Install Python 3.11+**

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment:**
   Create a `.env` file in the `backend` directory:
   ```
   OPENAI_API_KEY=your-openai-api-key-here
   OPENAI_MODEL=gpt-4o-mini
   BACKEND_HOST=0.0.0.0
   BACKEND_PORT=8000
   ```

## Running the Server

```bash
# From the backend directory
python -m app.main
```

Or with uvicorn directly:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

API documentation: `http://localhost:8000/docs`

## API Endpoints

### Health Check
- `GET /health` - Returns server status

### Document Ingestion
- `POST /ingest/text` - Process document and extract knowledge chunks
  - Body: `{"source_file_name": "...", "text": "..."}`
  - Returns: Array of `KnowledgeChunk` objects

### Field Classification
- `POST /classify-field` - Classify a form field
  - Body: `FieldContext` object
  - Returns: `ClassificationResult` with category and metadata

### Suggestion Generation
- `POST /suggest` - Generate field suggestion
  - Body: `SuggestionRequest` with field, classification, and chunks
  - Returns: `SuggestionResult` with suggested text

## Architecture

```
backend/
├── app/
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration and settings
│   ├── models.py            # Pydantic data models
│   ├── openai_client.py     # OpenAI API wrapper
│   ├── routes_ingest.py     # Document ingestion endpoint
│   ├── routes_classify.py   # Field classification endpoint
│   ├── routes_suggest.py    # Suggestion generation endpoint
│   └── utils/
│       ├── id_generation.py # Stable chunk ID generation
│       └── text_split.py    # Text chunking utilities
├── requirements.txt
└── README.md
```

