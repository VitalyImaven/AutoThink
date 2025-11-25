# Quick Start Guide

## 🚀 Current Status

✅ **Backend Server:** RUNNING on http://localhost:8000  
✅ **Extension:** Built and ready to load  
⚠️ **API Key:** Needs configuration

---

## ⚡ Quick Actions

### 1. Configure OpenAI API Key (REQUIRED)
```bash
# Edit backend/.env and replace with your actual API key
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 2. Load Extension in Chrome
1. Open: `chrome://extensions/`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select folder: `D:\GitImavenAi\AutoThink\AutoThink\extension\dist`

### 3. Test the Backend
```bash
# Health check (working)
curl http://localhost:8000/health

# Test ingestion (requires API key)
curl -X POST http://localhost:8000/ingest/text -H "Content-Type: application/json" -d "{\"source_file_name\": \"test.txt\", \"text\": \"My name is Alice Johnson. I am 28 years old.\"}"
```

---

## 🎯 What We Have

### Backend (Python FastAPI)
- ✅ All dependencies installed
- ✅ Server running with auto-reload
- ✅ Supports: PDF, DOCX, XLSX, PPTX, MD, TXT, JSON, XML
- ✅ GPT-5 integration configured
- ✅ Hebrew text support enabled

### Extension (TypeScript/React)
- ✅ All dependencies installed (73 packages)
- ✅ TypeScript compiled successfully
- ✅ Vite bundle created
- ✅ Placeholder icons generated
- ✅ Ready to load in Chrome

---

## 📂 Key Files

### Configuration
- `backend/.env` - **Configure your API key here**
- `backend/requirements.txt` - Python dependencies (updated)
- `extension/package.json` - Node dependencies

### Sample Data
- `samples/personal-info.txt` - Personal information example
- `samples/startup-info.md` - Startup information example
- `samples/vitaly-info-hebrew.txt` - Hebrew text example
- `test-form.html` - HTML form for testing

### Documentation
- `SETUP_STATUS.md` - Detailed setup report
- `TESTING.md` - Complete testing guide
- `README.md` - Project overview

---

## 🧪 Testing Workflow

### Step 1: Basic Test (No API Key Needed)
```bash
curl http://localhost:8000/health
# Expected: {"status":"ok","version":"2.0.0"}
```

### Step 2: Add API Key
Edit `backend/.env` with your OpenAI API key

### Step 3: Test Document Ingestion
```bash
curl -X POST http://localhost:8000/ingest/text \
  -H "Content-Type: application/json" \
  -d '{"source_file_name": "test.txt", "text": "My name is Alice. My email is alice@example.com."}'
```

### Step 4: Load Extension
1. Go to `chrome://extensions/`
2. Load unpacked from `extension/dist`
3. Click extension icon or right-click → Options

### Step 5: Upload Documents
1. Click extension options
2. Upload sample files from `samples/` folder
3. Verify chunks are created

### Step 6: Test Forms
1. Open `test-form.html` in Chrome
2. Click on any form field
3. Wait for AI suggestion to appear
4. Click suggestion to fill the field

---

## 🔧 Development Commands

### Backend
```bash
cd backend

# Start server (already running in background)
python -m app.main

# Test GPT-5 integration
python test_gpt5_migration.py
```

### Extension
```bash
cd extension

# Rebuild after changes
npm run build

# Watch mode (auto-rebuild)
npm run dev

# Reload extension in Chrome after rebuild
```

---

## 📊 API Endpoints

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/health` | GET | Health check | ✅ Working |
| `/ingest/text` | POST | Process text | ⚠️ Needs API key |
| `/upload/file` | POST | Upload file | ⚠️ Needs API key |
| `/classify-field` | POST | Classify field | ⚠️ Needs API key |
| `/suggest` | POST | Generate suggestion | ⚠️ Needs API key |
| `/docs` | GET | API documentation | ✅ Working |

---

## 🐛 Common Issues

### "Incorrect API key" Error
**Solution:** Edit `backend/.env` and add your actual OpenAI API key

### Extension Not Loading
**Solution:** 
1. Check `extension/dist` folder exists
2. Rebuild: `npm run build`
3. Reload in Chrome

### Server Not Responding
**Solution:**
- Check terminal output for errors
- Verify server is running: `curl http://localhost:8000/health`
- Restart server if needed

### Port 8000 In Use
**Solution:** Edit `backend/.env` and change `BACKEND_PORT=8001`

---

## 🎓 Learn More

For detailed information, see:
- `TESTING.md` - Full testing guide
- `backend/README.md` - Backend API documentation
- `extension/README.md` - Extension development guide
- `ARCHITECTURE.md` - System architecture
- `GPT5_MIGRATION_GUIDE.md` - GPT-5 configuration options

---

## ✅ Ready to Go!

Everything is set up and the server is running. Just add your OpenAI API key to get started!

**Server:** http://localhost:8000  
**API Docs:** http://localhost:8000/docs  
**Extension Folder:** `extension/dist`

