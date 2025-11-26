# Chrome Extension Setup Guide

## Quick Setup Instructions

### Prerequisites
1. Node.js and npm installed
2. Python 3.8+ installed
3. OpenAI API key

### Step 1: Setup Backend

```bash
# Navigate to backend directory
cd backend

# Create virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp env.example .env

# Edit .env and add your OpenAI API key
# OPENAI_API_KEY=your_api_key_here

# Start the backend server
python -m uvicorn app.main:app --reload --port 8000
```

### Step 2: Build Chrome Extension

```bash
# Navigate to extension directory
cd extension

# Install dependencies
npm install

# Build the extension
npm run build
```

### Step 3: Load Extension in Chrome

1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Enable **"Developer mode"** (toggle in top-right corner)
4. Click **"Load unpacked"**
5. Select the `extension/dist` folder
6. The extension icon should appear in your toolbar!

### Step 4: Test the Extension

1. **Click the extension icon** to see the popup
2. Try the new features:
   - 💬 **Open AI Chat Assistant** - Chat with AI about any webpage
   - 📄 **Summarize This Page** - Get quick page summaries
   - ✨ **Highlight Important Elements** - Find clickable elements easily
   - ⚙️ **Manage Knowledge Base** - Upload documents for form autofill
   - 🤖 **Auto-Fill Entire Page** - Fill all form fields at once

## New Features Overview

### 1. AI Chat Assistant 💬
- **What it does**: Interactive chat interface for asking questions about web pages
- **How to use**: Click "Open AI Chat Assistant" button in popup
- **Example questions**:
  - "What does this page do?"
  - "How do I submit this form?"
  - "Summarize the main points"

### 2. Element Highlighting ✨
- **What it does**: Highlights all important interactive elements on the page
- **How to use**: Click "Highlight Important Elements" in popup
- **Visual feedback**: Blue outlines with numbered labels on all buttons, links, and form fields

### 3. Page Summarization 📄
- **What it does**: AI-generated summary of page content
- **How to use**: Click "Summarize This Page" in popup
- **Output**: Concise summary with main purpose, key points, and available actions

## Architecture

```
AutoThink/
├── backend/                    # FastAPI Backend
│   ├── app/
│   │   ├── main.py            # Main application
│   │   ├── routes_dynamic.py  # Form autofill routes
│   │   ├── routes_chat.py     # NEW: Chat & summarization routes
│   │   └── openai_fast.py     # AI processing
│   └── requirements.txt
│
└── extension/                  # Chrome Extension
    ├── src/
    │   ├── manifest.json      # Extension manifest
    │   ├── background.ts      # Service worker
    │   ├── content.ts         # Content script (page interaction)
    │   ├── popup.html/ts      # Popup UI
    │   ├── chat.html/ts       # NEW: Chat interface
    │   └── options/           # Settings page
    └── dist/                  # Build output (load this in Chrome)
```

## API Endpoints

The backend now includes these new endpoints:

### POST /chat
Chat with AI about the current page
```json
{
  "message": "What does this page do?",
  "conversation_history": [],
  "page_context": "..."
}
```

### POST /summarize
Get a summary of page content
```json
{
  "page_content": "...",
  "page_title": "...",
  "page_url": "..."
}
```

### POST /suggest
Existing endpoint for form field suggestions
```json
{
  "field_context": {...},
  "all_chunks": [...]
}
```

## Troubleshooting

### Extension not loading
- Make sure you selected the `dist` folder, not the `src` folder
- Check that the build completed successfully
- Try reloading the extension in `chrome://extensions/`

### Backend connection errors
- Verify backend is running: `http://localhost:8000/health`
- Check CORS settings in browser console
- Ensure OpenAI API key is valid in `.env` file

### Chat/Summarization not working
- Check backend logs for errors
- Verify OpenAI API key has available credits
- Check browser console for network errors
- Ensure page has loaded completely before using features

### Element highlighting not showing
- Wait for page to fully load
- Try clicking the button again
- Some pages with complex layouts may not highlight perfectly

## Development Mode

For development with auto-rebuild:

```bash
cd extension
npm run dev
```

This watches for file changes and rebuilds automatically. You'll need to manually refresh the extension in Chrome after changes.

## Configuration

### Backend Configuration (backend/.env)
```env
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4o-mini
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
```

### Extension Configuration (extension/src/config.ts)
```typescript
export const config = {
  backendUrl: 'http://localhost:8000',
};
```

## Additional Resources

- [NEW_FEATURES.md](extension/NEW_FEATURES.md) - Detailed feature documentation
- [Backend README](backend/README.md) - Backend API documentation
- [Extension README](extension/README.md) - Extension architecture
- API Docs: `http://localhost:8000/docs` (when backend is running)

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review browser DevTools console (F12)
3. Check backend terminal logs
4. Ensure all dependencies are installed
5. Verify API key is valid and has credits

## Next Steps

After setup:
1. Upload some personal documents via "Manage Knowledge Base"
2. Navigate to a form-heavy website
3. Try the auto-fill features
4. Open the chat assistant and ask questions
5. Use page summarization on long articles
6. Highlight elements on unfamiliar websites

Enjoy your enhanced browsing experience! 🚀

