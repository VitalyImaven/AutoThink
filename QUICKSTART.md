# Quick Start Guide

Get up and running with AI Smart Autofill in 5 minutes!

## Prerequisites

- Python 3.11+
- Node.js 18+
- Chrome browser
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

## Step 1: Backend (2 minutes)

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv

# Activate it
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Edit .env and add your OpenAI API key
# (Use any text editor)
```

In `.env`:
```
OPENAI_API_KEY=sk-your-actual-key-here
OPENAI_MODEL=gpt-5-mini
OPENAI_VERBOSITY=1
OPENAI_REASONING_EFFORT=medium
```

Start the backend:
```bash
python -m app.main
```

✅ Backend should now be running at http://localhost:8000

## Step 2: Extension (2 minutes)

Open a **new terminal** (keep backend running):

```bash
# Navigate to extension
cd extension

# Install dependencies
npm install

# Build the extension
npm run build
```

✅ Extension is now built in `extension/dist/`

## Step 3: Load in Chrome (1 minute)

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable **"Developer mode"** (toggle in top-right corner)
4. Click **"Load unpacked"**
5. Navigate to and select the `extension/dist` folder
6. You should see "AI Smart Autofill" extension loaded!

## Step 4: Add Sample Data (1 minute)

### Create Icon Files (Required)

The extension needs icon files. Quick solution:

1. Go to `extension/public/`
2. Create three PNG files (any color/design):
   - `icon16.png` (16x16 pixels)
   - `icon48.png` (48x48 pixels)  
   - `icon128.png` (128x128 pixels)

Or use ImageMagick to create blue placeholders:
```bash
cd extension/public
convert -size 16x16 xc:#4285f4 icon16.png
convert -size 48x48 xc:#4285f4 icon48.png
convert -size 128x128 xc:#4285f4 icon128.png
```

### Upload Documents

1. Click the extension icon in Chrome toolbar
2. Select **"Options"** or right-click and choose **"Options"**
3. Drag and drop the sample files from `samples/` folder:
   - `personal-info.txt`
   - `startup-info.md`
4. Wait for processing (20-30 seconds per file)
5. You should see chunks extracted and saved!

## Step 5: Try It! (30 seconds)

1. Visit any website with a form (e.g., job application, contact form)
2. Click on a text field (like "Name", "Email", "Company Description")
3. Wait 2-3 seconds
4. You should see an AI-generated suggestion appear below the field!
5. Click the suggestion to accept it

## 🎉 Done!

You now have a working AI autofill assistant!

## Troubleshooting

### Backend issues
```bash
# Check Python version
python --version  # Should be 3.11+

# Check backend is running
curl http://localhost:8000/health
# Should return: {"status":"ok"}
```

### Extension issues
```bash
# Rebuild extension
cd extension
npm run build

# Then reload extension in chrome://extensions/
```

### No suggestions appearing
1. Make sure backend is running
2. Upload documents via Options page
3. Check browser console (F12) for errors
4. Verify backend URL in `extension/src/config.ts` is `http://localhost:8000`

## Next Steps

- Edit `samples/personal-info.txt` with your actual information
- Create more documents for different categories
- Try it on various forms around the web
- Check out the full [README.md](README.md) for advanced features

## Development Mode

For active development:

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
python -m app.main  # Auto-reloads on changes
```

**Terminal 2 - Extension:**
```bash
cd extension
npm run dev  # Watches and rebuilds on changes
```

After extension changes, go to `chrome://extensions/` and click the refresh icon.

Happy autofilling! 🚀

