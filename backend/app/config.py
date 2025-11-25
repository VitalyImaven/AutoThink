from pydantic_settings import BaseSettings
from typing import Optional, Literal


class Settings(BaseSettings):
    """Application settings and configuration"""
    
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-5-mini"
    
    # GPT-5 specific parameters
    OPENAI_VERBOSITY: Literal["low", "medium", "high"] = "medium"  # low=concise, medium=normal, high=detailed
    OPENAI_REASONING_EFFORT: Literal["none", "low", "medium", "high"] = "medium"
    
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

