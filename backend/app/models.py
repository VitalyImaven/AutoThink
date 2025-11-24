from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from enum import Enum


class KnowledgeCategory(str, Enum):
    """Predefined categories for knowledge classification"""
    personal_basic = "personal_basic"
    personal_contact = "personal_contact"
    startup_one_liner = "startup_one_liner"
    startup_problem = "startup_problem"
    startup_solution = "startup_solution"
    startup_traction = "startup_traction"
    startup_team = "startup_team"
    startup_use_of_funds = "startup_use_of_funds"
    insurance_profile = "insurance_profile"
    generic_other = "generic_other"


class KnowledgeChunkMeta(BaseModel):
    """Metadata about a single knowledge chunk"""
    id: str
    source_file: str
    section: Optional[str] = None
    category: KnowledgeCategory
    language: str = "en"
    length_hint: Optional[Literal["short", "medium", "long"]] = None
    tags: List[str] = Field(default_factory=list)
    priority: Optional[float] = None  # 0-1 range


class KnowledgeChunk(BaseModel):
    """Full knowledge chunk with metadata and content"""
    meta: KnowledgeChunkMeta
    body: str


class FieldContext(BaseModel):
    """Context information about a form field"""
    field_id: str
    name_attr: Optional[str] = None
    id_attr: Optional[str] = None
    label_text: Optional[str] = None
    placeholder: Optional[str] = None
    nearby_text: Optional[str] = None
    max_length: Optional[int] = None


class ClassificationResult(BaseModel):
    """Result of classifying a field"""
    category: KnowledgeCategory
    max_length: Optional[int] = None
    tone: Optional[Literal["professional", "casual", "formal"]] = "professional"
    confidence: float = Field(ge=0.0, le=1.0)


class SuggestionRequest(BaseModel):
    """Request for generating a suggestion"""
    field: FieldContext
    classification: ClassificationResult
    chunks: List[KnowledgeChunk]


class SuggestionResult(BaseModel):
    """Result containing the suggested text"""
    suggestion_text: str


class IngestRequest(BaseModel):
    """Request to ingest a document"""
    source_file_name: str
    text: str

