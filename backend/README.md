# Backend API Documentation

## Overview

FastAPI backend for AI Smart Autofill with GPT-5 integration.

## Setup

### 1. Install Dependencies

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment

Copy the example file:
```bash
cp env.example .env
```

Edit `.env` and set your OpenAI API key:
```env
OPENAI_API_KEY=sk-your-actual-api-key-here
OPENAI_MODEL=gpt-5-mini
```

### 3. Test GPT-5 Integration

```bash
python test_gpt5_migration.py
```

This will verify that GPT-5 is working correctly.

### 4. Start the Server

```bash
python -m app.main
```

Server will run at `http://localhost:8000`

API docs at `http://localhost:8000/docs`

## GPT-5 Configuration

The backend now uses **GPT-5** with optimized settings:

### Model Options
- `gpt-5` - Full model (best quality)
- `gpt-5-mini` - Balanced (default)
- `gpt-5-nano` - Fastest

### Parameters

**Verbosity** (`OPENAI_VERBOSITY`):
- `0` = Concise (for JSON)
- `1` = Normal (default)
- `2` = Detailed

**Reasoning Effort** (`OPENAI_REASONING_EFFORT`):
- `low` - Fast operations
- `medium` - Balanced (default)
- `high` - Best quality

## API Endpoints

### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

### `POST /ingest/text`
Process and chunk a document.

**Request:**
```json
{
  "source_file_name": "my-info.txt",
  "text": "Document content here..."
}
```

**Response:**
```json
[
  {
    "meta": {
      "id": "abc123",
      "source_file": "my-info.txt",
      "section": "Personal Info",
      "category": "personal_basic",
      "language": "en",
      "length_hint": "short",
      "tags": ["name", "age"],
      "priority": 0.9
    },
    "body": "My name is John Doe and I'm 32 years old."
  }
]
```

### `POST /classify-field`
Classify a form field.

**Request:**
```json
{
  "field_id": "uuid-123",
  "name_attr": "full_name",
  "id_attr": "name",
  "label_text": "Your Name",
  "placeholder": "Enter your name",
  "nearby_text": null,
  "max_length": 100
}
```

**Response:**
```json
{
  "category": "personal_basic",
  "max_length": 100,
  "tone": "professional",
  "confidence": 0.95
}
```

### `POST /suggest`
Generate a suggestion for a field.

**Request:**
```json
{
  "field": { /* FieldContext */ },
  "classification": { /* ClassificationResult */ },
  "chunks": [ /* Array of KnowledgeChunk */ ]
}
```

**Response:**
```json
{
  "suggestion_text": "John Doe"
}
```

## Knowledge Categories

The system supports these categories:

- `personal_basic` - Name, age, nationality
- `personal_contact` - Email, phone, address
- `startup_one_liner` - Company description
- `startup_problem` - Problem statement
- `startup_solution` - Solution description
- `startup_traction` - Metrics, users, revenue
- `startup_team` - Team information
- `startup_use_of_funds` - Funding plans
- `insurance_profile` - Insurance info
- `generic_other` - Other information

## Development

### Run with auto-reload:
```bash
python -m app.main
```

### Test GPT-5:
```bash
python test_gpt5_migration.py
```

### Access API docs:
Open `http://localhost:8000/docs` in your browser.

## GPT-5 Migration

The project uses GPT-5 by default. See `GPT5_MIGRATION_GUIDE.md` for:
- Configuration options
- Cost optimization
- Troubleshooting
- Performance tuning

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | (required) | Your OpenAI API key |
| `OPENAI_MODEL` | `gpt-5-mini` | Model to use |
| `OPENAI_VERBOSITY` | `1` | Response detail (0-2) |
| `OPENAI_REASONING_EFFORT` | `medium` | Reasoning depth |
| `BACKEND_HOST` | `0.0.0.0` | Server host |
| `BACKEND_PORT` | `8000` | Server port |

## Troubleshooting

### "Model not found" error

You may not have access to GPT-5 yet. Fallback to GPT-4o:
```env
OPENAI_MODEL=gpt-4o-mini
```

And remove `extra_body` parameters from `app/openai_client.py`.

### Slow responses

Reduce reasoning effort:
```env
OPENAI_REASONING_EFFORT=low
```

Or use a smaller model:
```env
OPENAI_MODEL=gpt-5-nano
```

### API key errors

Make sure `.env` file exists and contains:
```env
OPENAI_API_KEY=sk-your-key-here
```

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app
│   ├── config.py            # Settings with GPT-5 params
│   ├── models.py            # Pydantic models
│   ├── openai_client.py     # GPT-5 API calls
│   ├── routes_ingest.py     # Document ingestion
│   ├── routes_classify.py   # Field classification
│   ├── routes_suggest.py    # Suggestion generation
│   └── utils/
│       ├── id_generation.py # Stable chunk IDs
│       └── text_split.py    # Text utilities
├── requirements.txt
├── env.example             # Example config
├── test_gpt5_migration.py  # Test script
└── README.md               # This file
```

## License

MIT
