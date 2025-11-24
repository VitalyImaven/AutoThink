# AI Smart Autofill - Chrome Extension

AI-powered smart autofill assistant for web forms.

## Features

- 🤖 Automatically suggests relevant content for form fields
- 📄 Upload personal/business documents to build knowledge base
- 🧠 Uses AI to understand field context and generate appropriate responses
- 💾 Local knowledge storage using IndexedDB
- 🔒 Privacy-focused: data stays in your browser

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the Extension

```bash
npm run build
```

This creates a `dist` folder with the compiled extension.

### 3. Load in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `extension/dist` folder

### Development Mode

For development with auto-rebuild:

```bash
npm run dev
```

This watches for file changes and rebuilds automatically. You'll need to manually refresh the extension in Chrome after changes.

## Usage

### Upload Documents

1. Click the extension icon or navigate to the Options page
2. Upload `.txt` or `.md` files with your personal/business information
3. The AI will automatically:
   - Extract relevant information chunks
   - Categorize them (personal info, startup details, etc.)
   - Store them locally in your browser

### Auto-suggest in Forms

1. Navigate to any webpage with forms
2. Click on a form field
3. The extension will:
   - Analyze what the field is asking for
   - Find relevant information from your knowledge base
   - Show an AI-generated suggestion below the field
4. Click the suggestion to accept it, or press Esc to dismiss

## Architecture

```
extension/
├── src/
│   ├── manifest.json         # Chrome extension manifest (MV3)
│   ├── types.ts              # TypeScript type definitions
│   ├── config.ts             # Configuration (backend URL)
│   ├── background.ts         # Service worker (coordination)
│   ├── content.ts            # Content script (field detection)
│   ├── db/
│   │   └── index.ts          # IndexedDB helper
│   └── options/
│       ├── index.html        # Options page HTML
│       ├── main.tsx          # React entry point
│       ├── App.tsx           # Main React component
│       └── styles.css        # Styles
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Technology Stack

- **TypeScript** - Type-safe development
- **React** - Options page UI
- **Vite** - Build tool
- **IndexedDB (idb)** - Local knowledge storage
- **Chrome Manifest V3** - Latest extension standard

## Configuration

Edit `src/config.ts` to change the backend URL:

```typescript
export const config = {
  backendUrl: 'http://localhost:8000',
};
```

## Knowledge Categories

The extension supports these categories:

- `personal_basic` - Name, age, nationality, etc.
- `personal_contact` - Email, phone, address
- `startup_one_liner` - Brief company description
- `startup_problem` - Problem being solved
- `startup_solution` - Your solution
- `startup_traction` - Metrics and growth
- `startup_team` - Team information
- `startup_use_of_funds` - Funding usage plans
- `insurance_profile` - Insurance information
- `generic_other` - Other information

## Privacy & Security

- All knowledge is stored locally in your browser (IndexedDB)
- Data is only sent to the backend API for AI processing
- No data is stored on external servers
- You can clear your knowledge base at any time

## Troubleshooting

### Extension not loading
- Make sure you've run `npm run build`
- Check that you selected the `dist` folder when loading

### No suggestions appearing
- Ensure the backend is running (`http://localhost:8000`)
- Check that you've uploaded documents with relevant information
- Open DevTools console to check for errors

### Backend connection issues
- Verify backend URL in `src/config.ts`
- Ensure CORS is enabled on the backend
- Check backend is running and accessible

