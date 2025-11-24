from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app import routes_ingest, routes_classify, routes_suggest

app = FastAPI(
    title="AI Smart Autofill Backend",
    description="Backend API for AI-powered form autofill",
    version="1.0.0"
)

# CORS middleware for Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Chrome extension origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(routes_ingest.router, prefix="/ingest", tags=["Ingestion"])
app.include_router(routes_classify.router, tags=["Classification"])
app.include_router(routes_suggest.router, tags=["Suggestion"])


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.BACKEND_HOST,
        port=settings.BACKEND_PORT,
        reload=True
    )

