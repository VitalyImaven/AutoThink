# Testing Guide

Complete testing guide for AI Smart Autofill.

## Prerequisites

- Backend running at `http://localhost:8000`
- Extension loaded in Chrome
- Sample documents uploaded

## Quick Smoke Test (5 minutes)

### 1. Backend Health Check

```bash
curl http://localhost:8000/health
```

Expected: `{"status":"ok"}`

### 2. Test Document Ingestion

```bash
curl -X POST http://localhost:8000/ingest/text \
  -H "Content-Type: application/json" \
  -d '{
    "source_file_name": "test.txt",
    "text": "My name is Alice Johnson. I am 28 years old. My email is alice@example.com."
  }'
```

Expected: JSON array with knowledge chunks

### 3. Test Field Classification

```bash
curl -X POST http://localhost:8000/classify-field \
  -H "Content-Type: application/json" \
  -d '{
    "field_id": "test-123",
    "label_text": "Your email address",
    "placeholder": "email@example.com",
    "name_attr": "email",
    "id_attr": null,
    "nearby_text": null,
    "max_length": null
  }'
```

Expected: Classification result with category

## Extension Testing

### Setup Test Data

1. Open extension options (right-click extension icon → Options)
2. Upload both sample files:
   - `samples/personal-info.txt`
   - `samples/startup-info.md`
3. Verify chunks are extracted (should see 15-25 chunks)

### Test Websites

Visit these sites with various form types:

#### 1. Contact Forms

- https://www.google.com/search?q=contact+form+test
- Look for: Name, Email, Phone fields
- Expected suggestions: Personal info from your documents

#### 2. Job Application Forms

- https://www.linkedin.com/jobs/ (create test application)
- Look for: Experience, Skills, Bio fields
- Expected suggestions: Professional background info

#### 3. Startup Application Forms

- https://www.ycombinator.com/apply (don't submit!)
- Look for: Company description, Problem, Solution
- Expected suggestions: Startup-specific info

#### 4. Generic Forms

Create a simple HTML test page:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Form Test</title>
</head>
<body>
    <h1>Test Form</h1>
    
    <form>
        <label for="name">Full Name:</label>
        <input type="text" id="name" name="name"><br><br>
        
        <label for="email">Email Address:</label>
        <input type="email" id="email" name="email"><br><br>
        
        <label for="phone">Phone Number:</label>
        <input type="tel" id="phone" name="phone"><br><br>
        
        <label for="company">Company Description:</label>
        <textarea id="company" name="company" rows="4"></textarea><br><br>
        
        <label for="problem">What problem are you solving?</label>
        <textarea id="problem" name="problem" rows="4"></textarea><br><br>
        
        <label for="bio">Tell us about yourself:</label>
        <textarea id="bio" name="bio" rows="6"></textarea><br><br>
        
        <button type="submit">Submit</button>
    </form>
</body>
</html>
```

Save as `test-form.html` and open in Chrome.

### Expected Behavior

For each field:
1. **Click on field** → Wait 2-3 seconds
2. **Suggestion appears** below field in blue popup
3. **Click suggestion** → Text fills the field
4. **Press Esc** → Suggestion dismisses

### Test Different Scenarios

#### Scenario 1: Personal Info Fields
- Field: "Your name"
- Expected: "John Doe" or similar from your docs

#### Scenario 2: Contact Fields
- Field: "Email address"
- Expected: Email from your docs

#### Scenario 3: Startup Fields
- Field: "Describe your company"
- Expected: Startup one-liner

#### Scenario 4: Problem/Solution
- Field: "What problem are you solving?"
- Expected: Problem description from startup docs

#### Scenario 5: Team Info
- Field: "Tell us about your team"
- Expected: Team member information

## Debugging Tests

### Check Console Logs

Open DevTools (F12) on any page:

**Content Script Logs:**
```
AI Smart Autofill content script loaded
```

**Background Worker Logs:**
1. Right-click extension icon
2. Select "Manage extensions"
3. Find "AI Smart Autofill"
4. Click "service worker" link
5. Check console for:
```
AI Smart Autofill background service worker loaded
Classifying field: {...}
Classification result: {...}
Found X chunks for category Y
Generating suggestion...
Suggestion generated: ...
```

### Common Issues

#### Issue: No suggestion appears

**Debug steps:**
1. Check backend is running: `curl http://localhost:8000/health`
2. Check browser console for errors
3. Verify documents uploaded (Options page)
4. Check background worker logs

**Possible causes:**
- Backend not running
- Network errors (CORS, connection refused)
- No relevant knowledge in database
- Field not detected properly

#### Issue: Wrong suggestion

**Debug steps:**
1. Check classification result in background logs
2. Verify correct category assigned
3. Check chunks retrieved for that category

**Possible causes:**
- Incorrect field classification
- Missing knowledge for that category
- LLM misunderstanding context

#### Issue: Suggestion too long

**Debug steps:**
1. Check field's `maxlength` attribute
2. Verify classification includes max_length
3. Check LLM prompt includes length constraint

**Fix:**
- LLM should respect max_length in classification
- May need prompt tuning

#### Issue: Extension not loading

**Debug steps:**
1. Check `chrome://extensions/` for errors
2. Verify `dist/` folder exists
3. Check all icons present
4. Verify manifest.json copied to dist

**Fix:**
```bash
cd extension
npm run build
# Reload extension in Chrome
```

## Performance Testing

### Measure Response Times

Add timing logs:

**In background.ts:**
```typescript
console.time('suggestion-generation');
// ... existing code ...
console.timeEnd('suggestion-generation');
```

Expected times:
- Classification (cached): <100ms
- Classification (new): 1-3 seconds
- Chunk retrieval: <100ms
- Suggestion generation: 2-5 seconds

### Test Load

Focus multiple fields rapidly:
- Should queue requests properly
- No crashes or hangs
- Each field gets suggestion eventually

## Integration Testing

### End-to-End Test Flow

1. **Clear Knowledge Base**
   - Options page → "Clear All"
   - Verify 0 chunks

2. **Upload Document**
   - Upload `samples/personal-info.txt`
   - Verify chunks extracted (~8-12 chunks)

3. **Test Suggestion**
   - Open test form
   - Focus "Name" field
   - Verify suggestion with correct name

4. **Upload More Documents**
   - Upload `samples/startup-info.md`
   - Verify more chunks added

5. **Test Startup Fields**
   - Focus "Company description" field
   - Verify startup-related suggestion

6. **Test Cache**
   - Focus same field again
   - Should be faster (classification cached)

### Cross-Origin Testing

Test on different domains:
- localhost
- Live websites
- HTTPS and HTTP

Verify:
- Suggestions work on all domains
- No CORS errors
- Classification cache respects domains

## Regression Testing

After making changes, verify:

### Backend Changes
- [ ] All endpoints still respond
- [ ] LLM prompts produce valid JSON
- [ ] Chunk IDs remain stable
- [ ] Error handling works

### Extension Changes
- [ ] Content script loads on pages
- [ ] Background worker starts
- [ ] Options page renders
- [ ] IndexedDB operations work
- [ ] Suggestions still appear

## Automated Testing

### Backend Unit Tests

Create `backend/tests/test_api.py`:

```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_ingest():
    response = client.post("/ingest/text", json={
        "source_file_name": "test.txt",
        "text": "Test content"
    })
    assert response.status_code == 200
    assert isinstance(response.json(), list)
```

Run: `pytest backend/tests/`

### Extension Testing

Consider using:
- Puppeteer for automated browser testing
- Jest for unit testing utilities
- Chrome Extension Test Framework

## Production Testing Checklist

Before deploying:

- [ ] Backend health endpoint responds
- [ ] All API endpoints tested
- [ ] Extension loads without errors
- [ ] Sample documents ingest successfully
- [ ] Suggestions appear on test forms
- [ ] Error handling graceful
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Works on multiple websites
- [ ] Icons display correctly
- [ ] Options page functional
- [ ] Can clear knowledge base
- [ ] No data loss on reload

## User Acceptance Testing

Have someone else test:
1. Follow QUICKSTART.md
2. Upload their own documents
3. Test on real forms they use
4. Report any issues or confusion

Gather feedback on:
- Setup difficulty
- Suggestion quality
- UI/UX experience
- Performance
- Missing features

## Continuous Testing

Set up monitoring for:
- Backend API availability
- Response times
- Error rates
- Extension crashes
- User feedback

Tools:
- Backend: Application logging
- Extension: Error reporting to backend
- User feedback: Form or email

## Need Help?

If tests fail:
1. Check backend logs
2. Check browser console
3. Verify configuration
4. Review ARCHITECTURE.md
5. Check GitHub issues (if open source)

Common fixes solve 90% of issues:
- Restart backend
- Rebuild extension
- Clear and re-upload documents
- Check API key is valid

