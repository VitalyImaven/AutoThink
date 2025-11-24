# 🚀 Getting Started with AI Smart Autofill

Welcome! This guide will help you get the AI Smart Autofill system up and running.

## What is This?

AI Smart Autofill is an intelligent Chrome extension that automatically fills web forms using your personal and business documents. Instead of typing the same information repeatedly, the AI learns from your documents and suggests relevant content for each field.

## How It Works

1. **Upload Documents** - You upload text files with your information (resume, company info, etc.)
2. **AI Processes** - The system analyzes and organizes your information into categories
3. **Auto-Suggest** - When you click on a form field, the AI suggests relevant content
4. **One-Click Fill** - Click the suggestion to instantly fill the field

## Prerequisites

Before starting, make sure you have:

- ✅ **Python 3.11 or higher** - [Download here](https://www.python.org/downloads/)
- ✅ **Node.js 18 or higher** - [Download here](https://nodejs.org/)
- ✅ **Google Chrome** - [Download here](https://www.google.com/chrome/)
- ✅ **OpenAI API Key** - [Get one here](https://platform.openai.com/api-keys)

## Installation Steps

### Step 1: Clone or Download

If you haven't already, get the project files on your computer.

### Step 2: Backend Setup (3 minutes)

Open a terminal and navigate to the project folder:

```bash
# Go to the backend folder
cd backend

# Create a virtual environment
python -m venv venv

# Activate it
# On Mac/Linux:
source venv/bin/activate

# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

Now create your configuration file:

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your favorite text editor
# Add your OpenAI API key
```

Your `.env` file should look like this:
```
OPENAI_API_KEY=sk-your-actual-openai-key-here
OPENAI_MODEL=gpt-4o-mini
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
```

Start the backend:

```bash
python -m app.main
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

✅ **Backend is ready!** Keep this terminal open.

### Step 3: Extension Setup (2 minutes)

Open a **new terminal** (keep the backend running):

```bash
# Go to the extension folder
cd extension

# Install dependencies
npm install

# Build the extension
npm run build
```

This creates a `dist` folder with your Chrome extension.

✅ **Extension is built!**

### Step 4: Load Extension in Chrome (1 minute)

1. Open Google Chrome
2. Type `chrome://extensions/` in the address bar
3. Turn on **"Developer mode"** (toggle in the top-right)
4. Click **"Load unpacked"**
5. Navigate to the `extension/dist` folder and select it
6. You should see "AI Smart Autofill" appear in your extensions list

✅ **Extension is loaded!**

### Step 5: Upload Your First Document (1 minute)

1. Click the extension icon in Chrome's toolbar
2. Select **"Options"** (or right-click → Options)
3. You'll see the options page with an upload area
4. Drag and drop one of the sample files:
   - Find `samples/personal-info.txt` in the project folder
   - Drag it onto the upload area
5. Wait 10-20 seconds while it processes
6. You should see "Successfully uploaded" and a table with extracted chunks

✅ **First document uploaded!**

### Step 6: Test It! (1 minute)

1. Open the test form:
   - Find `test-form.html` in the project folder
   - Double-click to open in Chrome
   
2. Try the autofill:
   - Click on the "Full Name" field
   - Wait 2-3 seconds
   - A suggestion should appear below the field!
   - Click the suggestion to accept it

🎉 **It's working!**

## What to Do Next

### Upload More Documents

Upload your real information:

1. Create a `.txt` or `.md` file with your:
   - Personal information (name, email, phone)
   - Professional background (bio, skills, experience)
   - Company information (if applicable)

2. Upload via the Options page

3. The more information you provide, the better the suggestions!

### Try Real Forms

Test on actual websites:
- Job applications
- Contact forms
- Registration pages
- Survey forms

The extension works on any webpage!

### Customize

- **Change backend URL**: Edit `extension/src/config.ts`
- **Adjust prompts**: Edit `backend/app/openai_client.py`
- **Add categories**: Update enum in `models.py` and `types.ts`

## Troubleshooting

### "Backend not responding"

**Check if backend is running:**
```bash
curl http://localhost:8000/health
```

Should return: `{"status":"ok"}`

If not, restart the backend:
```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
python -m app.main
```

### "No suggestions appearing"

1. **Check backend is running** (see above)
2. **Verify documents are uploaded**:
   - Go to Options page
   - Check "Total Chunks" is > 0
3. **Check browser console** (F12) for errors

### "Extension not loading"

1. Make sure you built it: `npm run build` in `extension` folder
2. Check for errors at `chrome://extensions/`
3. Try reloading the extension (click refresh icon)

### "OpenAI API error"

1. Check your API key in `backend/.env`
2. Verify you have credits in your OpenAI account
3. Check for errors in backend terminal

## Getting Help

- **Quick setup**: See `QUICKSTART.md`
- **Architecture details**: See `ARCHITECTURE.md`
- **Testing guide**: See `TESTING.md`
- **API documentation**: Visit `http://localhost:8000/docs` when backend is running

## Tips for Best Results

1. **Be specific in documents**
   - Use clear headings and sections
   - Write in complete sentences
   - Include all variations (full name, nickname, etc.)

2. **Organize by topic**
   - Personal info in one file
   - Professional background in another
   - Company/startup info in a third

3. **Update regularly**
   - Upload new documents anytime
   - Old information gets updated automatically

4. **Check the options page**
   - Monitor what information is stored
   - See how it's categorized
   - Clear and re-upload if needed

## Privacy & Security

- ✅ All data stored locally in your browser
- ✅ Only sent to OpenAI for processing
- ✅ No external storage or tracking
- ✅ You control all your data
- ✅ Clear everything anytime

## What Makes This Special?

- **Smart Context Understanding** - Knows what each field wants
- **Natural Language** - Write documents naturally, no special format
- **Incremental Updates** - Add documents anytime
- **Professional Quality** - Enterprise-grade architecture
- **Extensible** - Easy to customize and extend

## Development Mode

For active development:

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
python -m app.main
```

**Terminal 2 - Extension:**
```bash
cd extension
npm run dev
```

Changes to code will auto-rebuild. Reload extension in Chrome after changes.

## Architecture Overview

```
You ──→ Upload Documents ──→ Backend API ──→ OpenAI
                               ↓
                          Extract Chunks
                               ↓
                          IndexedDB (Browser)
                               ↓
You ──→ Focus Form Field ──→ Extension
                               ↓
                     Query Relevant Chunks
                               ↓
                Backend API ──→ OpenAI ──→ Generate Suggestion
                               ↓
                    Show Suggestion ──→ You Accept ──→ Fill Field
```

## Success Indicators

You'll know it's working when:

✅ Backend responds to `curl http://localhost:8000/health`  
✅ Extension appears in Chrome toolbar  
✅ Options page opens and displays properly  
✅ Documents upload successfully (see chunks in table)  
✅ Focusing a field shows a suggestion within 3 seconds  
✅ Clicking suggestion fills the field  

## Next Steps

1. ✅ Get it running (you're almost there!)
2. ✅ Upload sample documents
3. ✅ Test on test-form.html
4. ✅ Try on real websites
5. ✅ Upload your own documents
6. ✅ Customize to your needs

## Resources

- **Main README**: `README.md`
- **Quick Start**: `QUICKSTART.md`
- **Testing**: `TESTING.md`
- **Architecture**: `ARCHITECTURE.md`
- **Project Summary**: `PROJECT_SUMMARY.md`

---

**Ready? Let's go!** 🚀

Start with Step 1 above, and you'll be auto-filling forms in under 10 minutes!

Questions? Check the troubleshooting section or review the detailed documentation.

Happy auto-filling! 😊

