"""
Dynamic categorization models - no hardcoded categories!
AI discovers semantic topics from each document.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class SemanticChunk(BaseModel):
    """Chunk with dynamically discovered semantic tags"""
    id: str
    source_file: str
    body: str
    semantic_tags: List[str] = Field(
        description="AI-discovered tags describing what this chunk contains"
    )
    related_topics: List[str] = Field(
        default_factory=list,
        description="Broader topics this chunk relates to"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional metadata (length, tone, language, etc.)"
    )


class DiscoveredTopic(BaseModel):
    """A topic discovered by AI in a document"""
    topic: str = Field(description="Main topic name")
    subtopics: List[str] = Field(
        default_factory=list,
        description="More specific subtopics"
    )
    chunk_ids: List[str] = Field(
        default_factory=list,
        description="Chunks related to this topic"
    )
    confidence: float = Field(
        ge=0.0, le=1.0,
        description="AI confidence in this topic"
    )


class DocumentIndex(BaseModel):
    """Index of all topics and tags discovered in a document"""
    document_id: str
    source_file: str
    uploaded_at: datetime = Field(default_factory=datetime.now)
    discovered_topics: List[DiscoveredTopic] = Field(
        default_factory=list,
        description="High-level topics found in document"
    )
    all_tags: List[str] = Field(
        default_factory=list,
        description="All unique semantic tags across all chunks"
    )
    chunk_count: int = Field(description="Total number of chunks")
    chunks: List[SemanticChunk] = Field(
        default_factory=list,
        description="All chunks with their semantic tags"
    )


class FieldIntent(BaseModel):
    """AI's understanding of what a form field is asking for"""
    field_id: str
    seeking: str = Field(description="What information is being requested")
    context: str = Field(description="Context and related concepts")
    keywords: List[str] = Field(
        default_factory=list,
        description="Key terms from the field"
    )
    semantic_meaning: str = Field(
        description="Deep semantic understanding"
    )
    confidence: float = Field(ge=0.0, le=1.0)


class SemanticMatch(BaseModel):
    """Result of matching a field to chunks"""
    chunk_id: str
    chunk_body: str
    matching_tags: List[str] = Field(
        description="Which tags matched the field intent"
    )
    relevance_score: float = Field(
        ge=0.0, le=1.0,
        description="How relevant this chunk is"
    )
    source_file: str


class DynamicSuggestionRequest(BaseModel):
    """Request for generating suggestion using dynamic matching"""
    field_context: Dict[str, Any]
    field_intent: FieldIntent
    matched_chunks: List[SemanticMatch]


class TagStatistics(BaseModel):
    """Statistics about discovered tags"""
    tag: str
    frequency: int = Field(description="How many chunks have this tag")
    documents: List[str] = Field(
        description="Which documents contain this tag"
    )
    related_tags: List[str] = Field(
        default_factory=list,
        description="Tags that often appear together"
    )


class DynamicIngestResponse(BaseModel):
    """Response from dynamic ingestion"""
    document_index: DocumentIndex
    summary: str = Field(description="Human-readable summary of what was found")
    suggested_improvements: List[str] = Field(
        default_factory=list,
        description="Suggestions for better tagging"
    )

