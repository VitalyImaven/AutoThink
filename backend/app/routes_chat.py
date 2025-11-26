"""
Chat and page summarization routes for Chrome extension
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
from openai import AsyncOpenAI
from app.config import settings

router = APIRouter()
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    conversation_history: List[ChatMessage] = []
    page_context: Optional[str] = None


class ChatResponse(BaseModel):
    response: str


class SummarizeRequest(BaseModel):
    page_content: str
    page_title: str
    page_url: str


class SummarizeResponse(BaseModel):
    summary: str


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Handle chat messages with context awareness
    """
    try:
        print(f"\n{'='*60}")
        print(f"💬 CHAT REQUEST RECEIVED")
        print(f"{'='*60}")
        print(f"Message: '{request.message}'")
        print(f"Page context: {'Yes' if request.page_context else 'No'}")
        print(f"History: {len(request.conversation_history)} messages")
        
        # Check if this is a greeting/first-time interaction
        greetings = ['hi', 'hello', 'hey', 'greetings', 'help', 'what can you do', 'how to use']
        is_greeting = any(greeting in request.message.lower() for greeting in greetings)
        is_first_message = len(request.conversation_history) == 0
        
        # Build extension knowledge base
        extension_info = """
=== AI SMART AUTOFILL CHROME EXTENSION - COMPLETE GUIDE ===

WHAT THIS EXTENSION DOES:
1. AI-Powered Form Autofill - Automatically fills web forms using your personal documents
2. AI Chat Assistant - Ask questions about any webpage and get intelligent answers
3. Element Highlighting - Highlights important buttons/links to guide navigation
4. Page Summarization - Get AI-generated summaries of any webpage content

HOW TO GET STARTED:
Step 1: Upload Your Documents
- Click the extension icon → Go to "Controls" tab → Click "⚙️ Manage Knowledge Base"
- Upload .txt or .md files with your information (resume, bio, company info, etc.)
- The AI will analyze and store this information locally in your browser

Step 2: Use Auto-Fill
- Navigate to any form on the web
- Click on a form field
- Extension automatically suggests relevant content from your documents
- Click the suggestion to accept it
- Or use "Auto-Fill Entire Page" button to fill all fields at once

MAIN FEATURES:

📝 FORM AUTOFILL:
- Intelligent field detection (understands what each field asks for)
- AI-powered suggestions from your uploaded documents
- Manual or automatic suggestions (toggle in Controls)
- Right-click any field → "AI Autofill Suggest"

💬 CHAT ASSISTANT (What you're using now!):
- Ask questions about the current webpage
- Get specific guidance (e.g., "where to click to...", "how do I...")
- AI analyzes the actual page content and gives specific answers
- Available in both floating window and docked panel modes

✨ ELEMENT HIGHLIGHTING:
- Automatically highlights important buttons, links, and form fields
- Intelligent highlighting: Ask "where do I click to X?" and relevant elements get highlighted in orange
- General highlighting: Click "Highlight Important Elements" to see all interactive elements in blue
- Click "Clear Highlights" to remove

📄 PAGE SUMMARIZATION:
- Get AI-generated summaries of any webpage
- Useful for long articles, documentation, product pages
- Summary stays visible in the Summary tab until you close the page
- Click "Refresh Summary" to update

⚙️ SETTINGS & CONTROLS:
- Extension Enabled: Master on/off switch
- Auto-Suggest: Toggle automatic suggestions when you focus on fields
- Access via Controls tab or right-click extension icon → Options

🪟 PANEL MODES:
- Floating Window: Click extension icon (movable, resizable)
- Docked Panel: Click the ⛶ dock icon to pin to page side (like Gmail extensions)
- Switch between modes anytime

QUICK TIPS:
- All your data is stored locally in your browser (private and secure)
- Chat history persists per tab until you close it
- Use quick action buttons for common tasks
- Ask natural questions like "How do I..." or "Where is..."

WHERE TO FIND THINGS:
- Upload Documents: Controls tab → "Manage Knowledge Base"
- Chat with AI: Switch to Chat tab
- Get Summary: Switch to Summary tab → "Generate Summary"
- Highlight Elements: Controls tab → "Highlight Important Elements"
- Settings: Controls tab → Toggle switches at top

EXAMPLE QUESTIONS TO ASK:
- "How do I upload my documents?"
- "Where can I change settings?"
- "Show me how to use auto-fill"
- "What's the difference between docked and floating mode?"
- "How do I fill a form automatically?"

=== END EXTENSION GUIDE ===
"""

        # Build messages for OpenAI
        has_page_context = request.page_context and len(request.page_context.strip()) > 0
        
        if has_page_context:
            # User is asking about the CURRENT PAGE
            context = request.page_context[:3000]  # Limit to 3000 chars
            
            # If greeting or first message, include extension guide
            if is_greeting or is_first_message:
                messages = [
                    {
                        "role": "system",
                        "content": """You are a helpful AI assistant integrated into the AI Smart Autofill Chrome Extension.

CRITICAL CONTEXT:
You are part of a CHROME EXTENSION called "AI Smart Autofill" that helps users auto-fill web forms using their personal documents.

WHEN USER ASKS ABOUT "AUTO-FILL" OR "AUTOFILL":
They are asking about THIS EXTENSION'S auto-fill feature, NOT Google's autocomplete or Chrome's built-in autofill!

Answer like this:
"To use AI Smart Autofill extension:
1. Upload documents: Controls tab → 'Manage Knowledge Base' → Upload .txt/.md files with your info
2. Go to any web form
3. Click on a field → Extension suggests content from your documents
4. Click the suggestion to accept it
Or use 'Auto-Fill Entire Page' button to fill all fields at once!"

WHEN USER GREETS YOU:
1. Greet warmly
2. Briefly explain THIS extension (AI-powered form filling)
3. Guide on getting started (upload documents!)
4. Offer help with current page or extension features

WHEN USER ASKS ABOUT EXTENSION FEATURES:
Use the guide below. Always talk about THIS extension, not Google/Chrome features.

WHEN USER ASKS ABOUT THE CURRENT PAGE:
Analyze page content and give specific answers about THIS page."""
                    },
                    {
                        "role": "system",
                        "content": extension_info
                    },
                    {
                        "role": "system",
                        "content": f"=== CURRENT PAGE INFORMATION ===\n{context}\n=== END PAGE INFO ==="
                    }
                ]
            else:
                # Regular page question - but still know about extension
                messages = [
                    {
                        "role": "system",
                        "content": """You are a helpful AI assistant integrated into the AI Smart Autofill Chrome Extension.

PRIORITY: The user is asking about THE CURRENT WEBPAGE they are viewing RIGHT NOW.
- Give specific, actionable answers based on THIS PAGE
- Reference specific elements, buttons, or sections you see on THIS PAGE

BUT REMEMBER: If they ask about "auto-fill", "autofill", "extension features", "upload documents", etc.:
They mean THIS EXTENSION'S features, not Google/Chrome built-in features!"""
                    },
                    {
                        "role": "system",
                        "content": extension_info
                    },
                    {
                        "role": "system",
                        "content": f"=== CURRENT PAGE INFORMATION ===\n{context}\n=== END PAGE INFO ==="
                    }
                ]
            print(f"Added page context: {len(context)} chars (CURRENT PAGE MODE)")
        else:
            # Generic mode or extension questions
            messages = [
                {
                    "role": "system",
                    "content": """You are a helpful AI assistant integrated into the AI Smart Autofill Chrome extension.

IMPORTANT: When users ask about "auto-fill", "autofill", or extension features:
They mean THIS EXTENSION, not Google's autocomplete or Chrome's built-in autofill!

Your job:
- Help users understand THIS extension's features
- Guide them through using AI-powered form filling
- Explain how to upload documents, use chat, highlighting, etc.
- Be concise, helpful, and friendly
- Focus on THIS extension's capabilities

Always refer to the extension guide below for accurate information."""
                },
                {
                    "role": "system",
                    "content": extension_info
                }
            ]
            print(f"No page context - extension guide mode")
        
        # Add conversation history
        for msg in request.conversation_history[-5:]:  # Last 5 messages only
            messages.append({
                "role": msg.role,
                "content": msg.content
            })
        print(f"Added {len(request.conversation_history[-5:])} history messages")
        
        # Add current message
        messages.append({
            "role": "user",
            "content": request.message
        })
        
        # Get response from OpenAI
        # Note: GPT-5 doesn't support custom temperature - only default (1)
        # IMPORTANT: GPT-5 uses tokens for BOTH reasoning AND content
        # So we need a higher limit to ensure content is generated
        print(f"💬 Chat request: '{request.message[:100]}'")
        print(f"   Model: {settings.OPENAI_MODEL}")
        print(f"   Messages in conversation: {len(messages)}")
        
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=messages,
            max_completion_tokens=2000  # Higher limit for GPT-5 (reasoning + content)
        )
        
        print(f"   ✅ Got response from OpenAI")
        print(f"   Response object: {response}")
        
        # Check if response exists
        if not response or not response.choices:
            print(f"   ❌ ERROR: No choices in response")
            raise HTTPException(status_code=500, detail="No response from AI - empty choices")
        
        response_text = response.choices[0].message.content
        print(f"   Response text: '{response_text[:200] if response_text else 'None'}'")
        
        if not response_text:
            print(f"   ❌ ERROR: Empty response text from OpenAI")
            print(f"   Full response: {response}")
            raise HTTPException(status_code=500, detail="No response from AI - empty content")
        
        final_response = response_text.strip()
        print(f"   ✅ Returning response: {len(final_response)} chars")
        
        return ChatResponse(response=final_response)
    
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        print(f"❌ UNEXPECTED Error in chat endpoint: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@router.post("/summarize", response_model=SummarizeResponse)
async def summarize_page(request: SummarizeRequest):
    """
    Summarize a web page's content
    """
    try:
        prompt = f"""Summarize the following web page in a clear, concise way.

Page Title: {request.page_title}
URL: {request.page_url}

Content:
{request.page_content[:4000]}

Provide a summary that includes:
1. Main purpose of the page (1-2 sentences)
2. Key information or sections (bullet points)
3. Any important actions the user can take

Keep the summary under 200 words."""

        # Get response from OpenAI
        print(f"📄 Summarizing page: {request.page_title[:100]}")
        print(f"   Content length: {len(request.page_content)} chars")
        
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert at analyzing and summarizing web page content. Provide clear, structured summaries."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            max_completion_tokens=1500  # Higher for GPT-5 (reasoning + content)
        )
        
        summary = response.choices[0].message.content
        
        print(f"   ✅ Got summary: {len(summary) if summary else 0} chars")
        
        if not summary or summary.strip() == "":
            print("   ⚠️ WARNING: Empty summary from OpenAI")
            return SummarizeResponse(summary="Unable to generate summary for this page. The content may be too complex or unavailable.")
        
        return SummarizeResponse(summary=summary.strip())
    
    except Exception as e:
        print(f"Error in summarize endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze-elements")
async def analyze_elements(request: Dict):
    """
    Analyze page elements and identify which ones match the user's intent
    Returns element indices to highlight
    """
    try:
        query = request.get("query", "important interactive elements")
        elements = request.get("elements", [])
        
        if not elements:
            return {"element_indices": [], "guidance": "No elements found on the page."}
        
        print(f"🔍 Analyzing {len(elements)} elements for query: '{query}'")
        
        # Build prompt with element details
        elements_text = []
        for i, el in enumerate(elements[:30]):  # Analyze up to 30 elements
            text = el.get('text', '').strip()[:100]  # First 100 chars
            tag = el.get('tag', 'unknown')
            attrs = el.get('attributes', {})
            
            # Build description
            desc_parts = [f"{i}. <{tag}>"]
            if text:
                desc_parts.append(f"text: '{text}'")
            if attrs.get('aria-label'):
                desc_parts.append(f"label: '{attrs['aria-label']}'")
            if attrs.get('title'):
                desc_parts.append(f"title: '{attrs['title']}'")
            if attrs.get('class'):
                desc_parts.append(f"class: '{attrs['class']}'")
            
            elements_text.append(" | ".join(desc_parts))
        
        prompt = f"""You are helping a user navigate a webpage. The user wants to: "{query}"

Here are the interactive elements on the page:
{chr(10).join(elements_text)}

YOUR TASK:
1. Identify which element(s) the user should click to accomplish their goal
2. Return ONLY the element numbers (indices) that are relevant
3. Provide brief guidance on what to do

Return your response in this EXACT format:
ELEMENTS: [comma-separated list of numbers, e.g., 5,12,18]
GUIDANCE: [one sentence explaining what to click and why]

Example:
ELEMENTS: 5,12
GUIDANCE: Click element 5 (Settings button) then element 12 (Profile section) to change your name.

Now analyze:"""

        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert at analyzing web page elements and identifying which ones match user intent. Be precise and only select truly relevant elements."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            max_completion_tokens=1000  # Higher for GPT-5 (reasoning + content)
        )
        
        response_text = response.choices[0].message.content or ""
        print(f"   AI response: {response_text[:200]}")
        
        # Parse response
        element_indices = []
        guidance = "Navigate to the highlighted elements."
        
        lines = response_text.split('\n')
        for line in lines:
            if line.startswith('ELEMENTS:'):
                # Extract numbers
                elements_str = line.replace('ELEMENTS:', '').strip()
                elements_str = elements_str.strip('[]')
                try:
                    element_indices = [int(n.strip()) for n in elements_str.split(',') if n.strip().isdigit()]
                except:
                    pass
            elif line.startswith('GUIDANCE:'):
                guidance = line.replace('GUIDANCE:', '').strip()
        
        print(f"   ✅ Found {len(element_indices)} relevant elements: {element_indices}")
        
        return {
            "element_indices": element_indices,
            "guidance": guidance
        }
    
    except Exception as e:
        print(f"Error in analyze-elements endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

