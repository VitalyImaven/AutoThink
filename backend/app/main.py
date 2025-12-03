from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app import routes_dynamic, routes_chat, routes_interview, routes_web_memory

app = FastAPI(
    title="AI Smart Autofill Backend - Dynamic Categorization",
    description="Backend API for AI-powered form autofill with dynamic AI-discovered categorization and Web Memory",
    version="3.1.0"
)

# CORS middleware for Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Chrome extension origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include dynamic routes (NO hardcoded categories!)
app.include_router(routes_dynamic.router, tags=["Dynamic AI Categorization"])

# Include chat and summarization routes
app.include_router(routes_chat.router, tags=["Chat & Summarization"])

# Include interview routes (voice + interactive knowledge gathering)
app.include_router(routes_interview.router, tags=["Interactive Interview"])

# Include web memory routes (save & search visited websites)
app.include_router(routes_web_memory.router, tags=["Web Memory"])


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "version": "3.1.0",
        "system": "Dynamic AI Categorization + Web Memory",
        "description": "AI discovers semantic topics from your documents. Web Memory remembers every site you visit.",
        "features": [
            "Form Autofill",
            "Chat Assistant",
            "Page Summarization",
            "Element Highlighting",
            "Web Memory - Search your browsing history with AI"
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.BACKEND_HOST,
        port=settings.BACKEND_PORT,
        reload=True
    )

