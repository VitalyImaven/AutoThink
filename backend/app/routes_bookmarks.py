"""
Smart Bookmarks Routes - AI-powered bookmark search and summarization
"""

import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from .openai_client import client
from .config import settings

router = APIRouter(prefix="/bookmarks", tags=["bookmarks"])


class BookmarkData(BaseModel):
    url: str
    title: str
    domain: str
    rating: int
    comment: Optional[str] = None
    categories: List[str] = []
    ai_summary: Optional[str] = None


class BookmarkSearchRequest(BaseModel):
    query: str
    bookmarks: List[BookmarkData]
    min_rating: Optional[int] = None
    max_rating: Optional[int] = None


class BookmarkSearchResponse(BaseModel):
    answer: str
    relevant_urls: List[str]


class BookmarkSummarizeRequest(BaseModel):
    url: str
    title: str
    content: str


class BookmarkSummarizeResponse(BaseModel):
    summary: str
    suggested_categories: List[str]


@router.post("/search", response_model=BookmarkSearchResponse)
async def search_bookmarks(request: BookmarkSearchRequest):
    """
    AI-powered bookmark search - understand natural language queries
    like "show me shopping sites with rating 8-10" or "find that article about machine learning"
    """
    print(f"\n{'='*60}")
    print(f"🔍 BOOKMARK SEARCH REQUEST")
    print(f"{'='*60}")
    print(f"Query: '{request.query}'")
    print(f"Total bookmarks received: {len(request.bookmarks)}")
    print(f"Rating filter: {request.min_rating} - {request.max_rating}")
    
    try:
        # Filter by rating if specified
        bookmarks = request.bookmarks
        if request.min_rating is not None:
            bookmarks = [b for b in bookmarks if b.rating >= request.min_rating]
        if request.max_rating is not None:
            bookmarks = [b for b in bookmarks if b.rating <= request.max_rating]
        
        print(f"After filtering: {len(bookmarks)} bookmarks")
        
        if not bookmarks:
            print("   ⚠️ No bookmarks match criteria")
            return BookmarkSearchResponse(
                answer="No bookmarks found matching your criteria.",
                relevant_urls=[]
            )
        
        # Build context for AI
        bookmarks_context = "\n".join([
            f"- [{b.rating}/10] {b.title} ({b.domain})\n"
            f"  Categories: {', '.join(b.categories) if b.categories else 'None'}\n"
            f"  Comment: {b.comment or 'None'}\n"
            f"  Summary: {b.ai_summary or 'None'}\n"
            f"  URL: {b.url}"
            for b in bookmarks
        ])
        
        prompt = f"""You are a helpful assistant that helps users find their bookmarked websites.

User's bookmarks (with ratings 1-10, higher is better):
{bookmarks_context}

User's search query: "{request.query}"

Based on the user's query:
1. Identify which bookmarks are most relevant to what they're looking for
2. Provide a helpful answer explaining what you found
3. List the URLs of the most relevant bookmarks (up to 5)

Consider:
- The user might ask about categories (e.g., "shopping sites", "tech articles")
- The user might ask about ratings (e.g., "best rated", "8 stars or above")
- The user might describe content they remember (e.g., "that site about cooking")
- The user might ask about domains (e.g., "amazon", "github")

Respond in this exact JSON format:
{{
  "answer": "Your helpful response explaining what you found",
  "relevant_urls": ["url1", "url2", "url3"]
}}"""

        model = settings.OPENAI_SUGGEST_MODEL
        print(f"   📤 Calling OpenAI model: {model}")
        
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You help users search their bookmarks. Always respond with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        
        print(f"   ✅ OpenAI response received")
        result = json.loads(response.choices[0].message.content)
        print(f"   📥 Found {len(result.get('relevant_urls', []))} relevant URLs")
        
        return BookmarkSearchResponse(
            answer=result.get("answer", "Here are your matching bookmarks."),
            relevant_urls=result.get("relevant_urls", [])[:5]
        )
        
    except Exception as e:
        print(f"❌ Bookmark search error: {e}")
        import traceback
        traceback.print_exc()
        # Fallback: return all bookmarks without AI answer
        return BookmarkSearchResponse(
            answer=f"Found {len(request.bookmarks)} bookmarks matching your criteria.",
            relevant_urls=[b.url for b in request.bookmarks[:5]]
        )


@router.post("/summarize", response_model=BookmarkSummarizeResponse)
async def summarize_bookmark(request: BookmarkSummarizeRequest):
    """
    Generate an AI summary for a bookmarked page and suggest categories
    """
    print(f"\n{'='*60}")
    print(f"📝 BOOKMARK SUMMARIZE REQUEST")
    print(f"{'='*60}")
    print(f"Title: '{request.title}'")
    print(f"URL: {request.url}")
    print(f"Content length: {len(request.content)} chars")
    
    try:
        prompt = f"""Analyze this bookmarked webpage and provide:
1. A concise 2-3 sentence summary of what this page is about
2. Suggested categories for organizing this bookmark (e.g., Shopping, Tech, News, Tutorial, Entertainment, etc.)

Page Title: {request.title}
URL: {request.url}
Content (excerpt):
{request.content[:3000]}

Respond in this exact JSON format:
{{
  "summary": "Your 2-3 sentence summary here",
  "suggested_categories": ["Category1", "Category2", "Category3"]
}}"""

        model = settings.OPENAI_SUGGEST_MODEL
        print(f"   📤 Calling OpenAI model: {model}")

        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You summarize webpages and suggest categories. Always respond with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        
        print(f"   ✅ OpenAI response received")
        result = json.loads(response.choices[0].message.content)
        summary = result.get("summary", "No summary available.")
        categories = result.get("suggested_categories", [])[:5]
        print(f"   📥 Summary: {summary[:100]}...")
        print(f"   📁 Categories: {categories}")
        
        return BookmarkSummarizeResponse(
            summary=summary,
            suggested_categories=categories
        )
        
    except Exception as e:
        print(f"❌ Bookmark summarize error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

