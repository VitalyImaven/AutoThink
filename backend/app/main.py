from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app import routes_dynamic, routes_chat, routes_interview

app = FastAPI(
    title="AI Smart Autofill Backend - Dynamic Categorization",
    description="Backend API for AI-powered form autofill with dynamic AI-discovered categorization",
    version="3.0.0"
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


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "version": "3.0.0",
        "system": "Dynamic AI Categorization",
        "description": "No hardcoded categories - AI discovers semantic topics from your documents"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.BACKEND_HOST,
        port=settings.BACKEND_PORT,
        reload=True
    )

