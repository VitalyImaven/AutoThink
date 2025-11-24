# 🤖 AI Smart Autofill Web Assistant

A professional, extensible AI-powered autofill assistant for web forms in Chrome. Upload your personal and business documents, and let AI automatically fill form fields with relevant, contextual information.

## 🎯 Overview

**AI Smart Autofill** consists of two main components:

1. **Backend (Python/FastAPI)** - Processes documents, classifies fields, and generates AI suggestions using OpenAI
2. **Extension (TypeScript/React)** - Chrome extension that detects form fields and shows suggestions

### Key Features

- 🧠 **Smart Field Detection** - Automatically understands what each form field is asking for
- 📄 **Document Ingestion** - Upload `.txt` or `.md` files to build your knowledge base
- 💡 **AI-Powered Suggestions** - GPT-powered contextual responses based on your documents
- 💾 **Local Storage** - All knowledge stored locally in your browser (IndexedDB)
- 🔄 **Incremental Updates** - Add new documents anytime without rebuilding
- 🎨 **Clean Architecture** - Modular, extensible design for easy feature additions

## 🏗️ Architecture

```
/
├── backend/              # Python FastAPI backend
│   ├── app/
│   │   ├── main.py              # FastAPI application
│   │   ├── config.py            # Configuration
│   │   ├── models.py            # Pydantic data models
│   │   ├── openai_client.py     # OpenAI API wrapper
│   │   ├── routes_ingest.py     # Document ingestion
│   │   ├── routes_classify.py   # Field classification
│   │   ├── routes_suggest.py    # Suggestion generation
│   │   └── utils/
│   └── requirements.txt
│
└── extension/           # Chrome extension (TypeScript/React)
    ├── src/
    │   ├── manifest.json        # Extension manifest
    │   ├── types.ts             # Type definitions
    │   ├── background.ts        # Service worker
    │   ├── content.ts           # Content script
    │   ├── db/                  # IndexedDB helper
    │   └── options/             # React options page
    └── package.json
```

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- OpenAI API key
- Chrome browser

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Run the backend
python -m app.main
```

Backend will be available at `http://localhost:8000`

API documentation: `http://localhost:8000/docs`

### 2. Extension Setup

```bash
cd extension

# Install dependencies
npm install

# Build the extension
npm run build
```

### 3. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `extension/dist` folder

## 📖 Usage

### Step 1: Upload Documents

1. Click the extension icon or right-click and select "Options"
2. Upload `.txt` or `.md` files containing your information:
   - Personal details (name, contact, bio)
   - Company/startup information
   - Team backgrounds
   - Any other relevant data

The AI will automatically:
- Split documents into logical chunks
- Categorize information
- Store it locally in your browser

### Step 2: Fill Forms Automatically

1. Visit any webpage with a form
2. Click on a form field
3. The extension will:
   - Analyze the field context
   - Find relevant information from your knowledge base
   - Generate an AI-powered suggestion
4. Click the suggestion to accept it

## 🎨 Knowledge Categories

The system organizes information into these categories:

- **Personal Basic** - Name, age, nationality, etc.
- **Personal Contact** - Email, phone, address
- **Startup One-liner** - Brief company description
- **Startup Problem** - Problem you're solving
- **Startup Solution** - Your solution
- **Startup Traction** - Metrics, users, revenue
- **Startup Team** - Team member information
- **Startup Use of Funds** - How funding will be used
- **Insurance Profile** - Insurance-related info
- **Generic Other** - Other information

## 🔧 Configuration

### Backend Configuration

Edit `backend/.env`:

```env
OPENAI_API_KEY=your-key-here
OPENAI_MODEL=gpt-4o-mini
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
```

### Extension Configuration

Edit `extension/src/config.ts`:

```typescript
export const config = {
  backendUrl: 'http://localhost:8000',
};
```

## 🛠️ Development

### Backend Development

```bash
cd backend
source venv/bin/activate
python -m app.main  # Auto-reloads on changes
```

### Extension Development

```bash
cd extension
npm run dev  # Watch mode - rebuilds on changes
```

After code changes, go to `chrome://extensions/` and click the refresh icon on your extension.

## 📋 API Endpoints

### POST /ingest/text
Process document and extract knowledge chunks

**Request:**
```json
{
  "source_file_name": "my-info.txt",
  "text": "..."
}
```

**Response:** Array of `KnowledgeChunk` objects

### POST /classify-field
Classify a form field

**Request:** `FieldContext` object

**Response:** `ClassificationResult` with category and metadata

### POST /suggest
Generate field suggestion

**Request:** `SuggestionRequest` with field, classification, and chunks

**Response:** `SuggestionResult` with suggested text

## 🔒 Privacy & Security

- ✅ All knowledge stored **locally** in your browser (IndexedDB)
- ✅ Data sent to OpenAI only for AI processing (via your backend)
- ✅ No external data storage or tracking
- ✅ Clear your knowledge base anytime
- ✅ Full control over your data

## 🧩 Extensibility

The architecture is designed to be easily extensible:

- **Add new categories** - Update `KnowledgeCategory` enum
- **Add new endpoints** - Create new route files in backend
- **Enhance UI** - Modify React components in `extension/src/options/`
- **Custom field handlers** - Extend content script logic
- **Multiple suggestion variants** - Modify suggestion generation logic

## 🐛 Troubleshooting

### Backend not starting
- Check Python version: `python --version` (requires 3.11+)
- Verify OpenAI API key in `.env`
- Check port 8000 is not in use

### Extension not working
- Ensure backend is running at `http://localhost:8000`
- Check backend URL in `extension/src/config.ts`
- Open DevTools console for error messages
- Verify extension is loaded in `chrome://extensions/`

### No suggestions appearing
- Upload documents first via Options page
- Ensure documents contain relevant information
- Check that field detection is working (console logs)
- Verify chunks are stored (check Options page stats)

## 📦 Tech Stack

**Backend:**
- Python 3.11+
- FastAPI
- OpenAI API
- Pydantic

**Extension:**
- TypeScript
- React
- Vite
- IndexedDB (idb)
- Chrome Manifest V3

## 🤝 Contributing

This is a modular, well-structured project designed for easy extension. Key design principles:

- Clear separation between backend and frontend
- Type-safe data models
- Minimal coupling between components
- Easy to add new features without architectural changes

## 📝 License

MIT License - feel free to use and modify as needed.

## 🙏 Acknowledgments

Built with modern best practices for Chrome extensions and FastAPI backends.

---

**Need help?** Check the individual README files in `backend/` and `extension/` directories for more detailed information.

