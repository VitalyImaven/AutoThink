from pydantic_settings import BaseSettings
from typing import Optional, Literal


class Settings(BaseSettings):
    """Application settings and configuration"""
    
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-5-mini"
    
    # Model Selection Strategy:
    # Use powerful model for ingestion (one-time, heavy semantic analysis)
    # Use faster/cheaper model for suggestions (frequent, lighter task)
    OPENAI_INGEST_MODEL: str = "gpt-5"  # Best understanding for document parsing
    OPENAI_SUGGEST_MODEL: str = "gpt-5-mini"  # Faster/cheaper for suggestions
    
    # GPT-5 specific parameters
    OPENAI_VERBOSITY: Literal["low", "medium", "high"] = "medium"  # low=concise, medium=normal, high=detailed
    OPENAI_REASONING_EFFORT: Literal["none", "low", "medium", "high"] = "medium"
    
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

