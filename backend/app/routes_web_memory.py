"""
Web Memory Routes - AI-powered search through visited websites
Enables natural language queries like "What was that vacation site in Finland?"
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from openai import AsyncOpenAI
from app.config import settings

router = APIRouter()
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


class VisitedPageInfo(BaseModel):
    """Page information from the extension"""
    url: str
    title: str
    domain: str
    content: str  # Page content (truncated)
    headings: List[str]
    description: str
    keywords: List[str]
    visited_at: str
    visit_count: int


class WebMemorySearchRequest(BaseModel):
    """Request to search web memory"""
    query: str
    pages: List[VisitedPageInfo]  # All pages from IndexedDB sent by extension
    max_results: int = 5


class WebMemorySearchResult(BaseModel):
    """A single search result"""
    url: str
    title: str
    snippet: str
    domain: str
    relevance: float  # 0-1 relevance score
    visited_at: str


class WebMemorySearchResponse(BaseModel):
    """Response with search results and AI answer"""
    results: List[WebMemorySearchResult]
    answer: str  # AI-generated answer based on the query and results


@router.post("/web-memory/search", response_model=WebMemorySearchResponse)
async def search_web_memory(request: WebMemorySearchRequest):
    """
    Search through visited websites using AI to understand natural language queries.
    
    Example queries:
    - "What was that vacation site about Finland?"
    - "Show me the restaurant I looked at last week"
    - "Find that article about machine learning"
    - "Where did I see information about electric cars?"
    """
    try:
        print(f"\n{'='*60}")
        print(f"🧠 WEB MEMORY SEARCH")
        print(f"{'='*60}")
        print(f"Query: '{request.query}'")
        print(f"Searching through {len(request.pages)} saved pages...")
        
        if not request.pages:
            return WebMemorySearchResponse(
                results=[],
                answer="I don't have any saved websites in your Web Memory yet. Browse some websites and I'll remember them for you!"
            )
        
        # Build a compact representation of all pages for AI analysis
        pages_summary = []
        for i, page in enumerate(request.pages[:100]):  # Limit to 100 pages for performance
            # Create a compact summary of each page
            summary = f"""[{i}] {page.title}
URL: {page.url}
Domain: {page.domain}
Visited: {page.visited_at} ({page.visit_count}x)
Description: {page.description[:200] if page.description else 'N/A'}
Keywords: {', '.join(page.keywords[:10])}
Headings: {', '.join(page.headings[:5])}
Content preview: {page.content[:300]}...
"""
            pages_summary.append(summary)
        
        # Use AI to find relevant pages and generate an answer
        prompt = f"""You are a personal web browsing memory assistant. The user is trying to find a website they visited before.

USER QUERY: "{request.query}"

SAVED WEBSITES (from their browsing history):
{chr(10).join(pages_summary)}

YOUR TASK:
1. Analyze the user's query to understand what they're looking for
2. Find the most relevant websites from their browsing history
3. Provide a helpful answer

RESPOND IN THIS EXACT FORMAT:
RELEVANT_PAGES: [comma-separated list of page indices, e.g., 0,5,12 - max 5 pages]
ANSWER: [A helpful, conversational response that:
- Identifies the most likely website(s) they're looking for
- Explains WHY you think these are relevant
- Includes specific details like the URL, title, or content that matches their query
- If you're not sure, suggest the most likely candidates]

Example response:
RELEVANT_PAGES: 3,7
ANSWER: I found what you're looking for! The Finland vacation site you mentioned is likely "Visit Finland - Official Travel Guide" (visitfinland.com) which you visited 3 days ago. It had information about Helsinki and Lapland destinations. You also looked at "Booking.com - Finland Hotels" around the same time.
"""

        print(f"   Sending to AI for analysis...")
        
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": """You are a helpful Web Memory assistant that helps users find websites they visited before. 
You have access to their browsing history and can search through saved pages.
Be conversational, helpful, and specific in your answers.
Always try to find relevant results even if the query is vague."""
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            max_completion_tokens=1500
        )
        
        response_text = response.choices[0].message.content or ""
        print(f"   AI Response: {response_text[:300]}...")
        
        # Parse the response
        relevant_indices = []
        answer = "I couldn't find any relevant websites in your browsing history."
        
        lines = response_text.split('\n')
        for line in lines:
            if line.startswith('RELEVANT_PAGES:'):
                indices_str = line.replace('RELEVANT_PAGES:', '').strip()
                indices_str = indices_str.strip('[]')
                try:
                    relevant_indices = [int(n.strip()) for n in indices_str.split(',') if n.strip().isdigit()]
                except:
                    pass
            elif line.startswith('ANSWER:'):
                # Get everything after ANSWER:
                answer_start = response_text.find('ANSWER:')
                if answer_start != -1:
                    answer = response_text[answer_start + 7:].strip()
        
        # Build results from relevant pages
        results = []
        for idx in relevant_indices[:request.max_results]:
            if 0 <= idx < len(request.pages):
                page = request.pages[idx]
                # Create a relevant snippet
                snippet = page.description if page.description else page.content[:200]
                
                results.append(WebMemorySearchResult(
                    url=page.url,
                    title=page.title,
                    snippet=snippet,
                    domain=page.domain,
                    relevance=1.0 - (relevant_indices.index(idx) * 0.1),  # Higher relevance for earlier matches
                    visited_at=page.visited_at
                ))
        
        print(f"   ✅ Found {len(results)} relevant pages")
        
        return WebMemorySearchResponse(
            results=results,
            answer=answer
        )
        
    except Exception as e:
        print(f"❌ Error in web memory search: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Web memory search error: {str(e)}")


class WebMemorySuggestRequest(BaseModel):
    """Request for proactive suggestions based on current context"""
    current_context: str  # What the user is currently doing/looking at
    pages: List[VisitedPageInfo]


class WebMemorySuggestResponse(BaseModel):
    """Proactive suggestions based on context"""
    suggestions: List[WebMemorySearchResult]
    explanation: str


@router.post("/web-memory/suggest", response_model=WebMemorySuggestResponse)
async def suggest_from_memory(request: WebMemorySuggestRequest):
    """
    Proactively suggest relevant websites based on current context.
    
    Example: If user is looking at a vacation booking page, 
    suggest other vacation sites they visited before.
    """
    try:
        print(f"\n{'='*60}")
        print(f"🧠 WEB MEMORY SUGGESTIONS")
        print(f"{'='*60}")
        print(f"Context: '{request.current_context[:100]}...'")
        print(f"Checking {len(request.pages)} saved pages...")
        
        if not request.pages:
            return WebMemorySuggestResponse(
                suggestions=[],
                explanation="No saved websites in your Web Memory yet."
            )
        
        # Build compact page summaries
        pages_summary = []
        for i, page in enumerate(request.pages[:50]):
            summary = f"[{i}] {page.title} ({page.domain}) - {page.description[:100] if page.description else page.content[:100]}"
            pages_summary.append(summary)
        
        prompt = f"""Based on the user's current activity, suggest relevant websites from their browsing history.

CURRENT CONTEXT:
{request.current_context[:1000]}

BROWSING HISTORY:
{chr(10).join(pages_summary)}

Find 1-3 websites from their history that might be helpful given their current context.
Respond with:
SUGGESTIONS: [indices, e.g., 2,5,8]
EXPLANATION: [why these might be helpful]
"""
        
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant that suggests relevant websites from the user's browsing history based on their current activity."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            max_completion_tokens=800
        )
        
        response_text = response.choices[0].message.content or ""
        
        # Parse response
        suggestion_indices = []
        explanation = "Here are some websites that might be relevant."
        
        for line in response_text.split('\n'):
            if line.startswith('SUGGESTIONS:'):
                indices_str = line.replace('SUGGESTIONS:', '').strip().strip('[]')
                try:
                    suggestion_indices = [int(n.strip()) for n in indices_str.split(',') if n.strip().isdigit()]
                except:
                    pass
            elif line.startswith('EXPLANATION:'):
                explanation = line.replace('EXPLANATION:', '').strip()
        
        # Build suggestions
        suggestions = []
        for idx in suggestion_indices[:3]:
            if 0 <= idx < len(request.pages):
                page = request.pages[idx]
                suggestions.append(WebMemorySearchResult(
                    url=page.url,
                    title=page.title,
                    snippet=page.description or page.content[:150],
                    domain=page.domain,
                    relevance=0.8,
                    visited_at=page.visited_at
                ))
        
        return WebMemorySuggestResponse(
            suggestions=suggestions,
            explanation=explanation
        )
        
    except Exception as e:
        print(f"❌ Error in web memory suggest: {e}")
        raise HTTPException(status_code=500, detail=str(e))






