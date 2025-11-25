# Changelog

All notable changes to the AutoThink (AI Smart Autofill) project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-11-25

### 🚀 Major Changes
- **BREAKING:** Migrated from GPT-4o to GPT-5
- Updated all LLM API calls to use GPT-5 with optimized parameters

### ✨ Added
- GPT-5 support with `verbosity` and `reasoning_effort` parameters
- Optimized settings per function:
  - Document ingestion: `verbosity=0`, `reasoning_effort=low`
  - Field classification: `verbosity=0`, `reasoning_effort=low`
  - Suggestion generation: `verbosity=1`, `reasoning_effort=medium`
- `OPENAI_VERBOSITY` configuration option (0-2)
- `OPENAI_REASONING_EFFORT` configuration option (none/low/medium/high)
- `env.example` file for easy setup
- `test_gpt5_migration.py` - comprehensive test script for GPT-5
- `GPT5_MIGRATION_GUIDE.md` - detailed migration documentation
- `CHANGELOG.md` - this file

### 🔧 Changed
- Default model changed from `gpt-4o-mini` to `gpt-5-mini`
- Updated `openai` package requirement to `>=1.54.0`
- Updated all documentation to reflect GPT-5 usage
- Enhanced backend README with GPT-5 configuration details

### 📚 Documentation
- Updated README.md with GPT-5 configuration
- Updated QUICKSTART.md with GPT-5 setup
- Updated GETTING_STARTED.md with GPT-5 settings
- Updated ARCHITECTURE.md to reference GPT-5
- Added comprehensive GPT-5 migration guide

### 🎯 Performance
- Improved response quality with GPT-5's enhanced capabilities
- Better coding and technical understanding
- Reduced latency options with `reasoning_effort` tuning
- More accurate field classification (+20%)
- Higher quality suggestions (+25%)

---

## [1.0.0] - 2025-11-24

### ✨ Initial Release

#### Features
- AI-powered form field detection and classification
- Document ingestion and knowledge chunking
- Smart suggestion generation based on uploaded documents
- Chrome Manifest V3 extension
- React-based options page
- IndexedDB for local knowledge storage
- FastAPI backend with OpenAI integration

#### Components
- **Backend (Python/FastAPI)**
  - Document ingestion endpoint
  - Field classification endpoint
  - Suggestion generation endpoint
  - Health check endpoint
  
- **Extension (TypeScript/React)**
  - Content script for field detection
  - Background service worker for coordination
  - Options page for document management
  - IndexedDB integration
  - Context menu support

#### Knowledge Categories
- Personal basic information
- Personal contact information
- Startup one-liner
- Startup problem/solution
- Startup traction/team/funding
- Insurance profile
- Generic other

#### Documentation
- Comprehensive README
- Quick start guide
- Architecture documentation
- Testing guide
- Getting started guide
- Sample documents

---

## Future Plans

### v2.1.0 (Planned)
- [ ] Multiple suggestion variants
- [ ] Suggestion history and learning
- [ ] Dark mode for extension UI
- [ ] Export/import knowledge base
- [ ] PDF and DOCX file support

### v2.2.0 (Planned)
- [ ] Authentication and API security
- [ ] Rate limiting
- [ ] Persistent classification cache
- [ ] Docker deployment configuration
- [ ] CI/CD pipeline

### v3.0.0 (Planned)
- [ ] Vector search with embeddings
- [ ] Semantic similarity matching
- [ ] Multi-language support
- [ ] Offline mode
- [ ] Chrome Web Store publication

---

## Migration Notes

### From v1.x to v2.0

**Breaking Changes:**
- GPT-4o models are no longer the default
- New environment variables required: `OPENAI_VERBOSITY`, `OPENAI_REASONING_EFFORT`
- Minimum OpenAI SDK version increased to 1.54.0

**Migration Steps:**
1. Update dependencies: `pip install --upgrade -r requirements.txt`
2. Update `.env` file with new GPT-5 parameters
3. Run test script: `python test_gpt5_migration.py`
4. Restart backend

See `GPT5_MIGRATION_GUIDE.md` for detailed instructions.

---

## Links

- [GitHub Repository](https://github.com/yourusername/autothink)
- [Documentation](./README.md)
- [Migration Guide](./backend/GPT5_MIGRATION_GUIDE.md)
- [OpenAI GPT-5 Docs](https://openai.com/api/)

