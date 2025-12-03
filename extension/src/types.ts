/**
 * TypeScript type definitions matching backend Pydantic models
 */

export type KnowledgeCategory =
  | "personal_basic"
  | "personal_contact"
  | "startup_one_liner"
  | "startup_problem"
  | "startup_solution"
  | "startup_traction"
  | "startup_team"
  | "startup_use_of_funds"
  | "insurance_profile"
  | "generic_other";

export type LengthHint = "short" | "medium" | "long";
export type Tone = "professional" | "casual" | "formal";

export interface KnowledgeChunkMeta {
  id: string;
  source_file: string;
  section: string | null;
  category: KnowledgeCategory;
  language: string;
  length_hint: LengthHint | null;
  tags: string[];
  priority: number | null;
}

export interface KnowledgeChunk {
  meta: KnowledgeChunkMeta;
  body: string;
}

export interface FieldContext {
  field_id: string;
  name_attr: string | null;
  id_attr: string | null;
  label_text: string | null;
  placeholder: string | null;
  nearby_text: string | null;
  max_length: number | null;
}

export interface ClassificationResult {
  category: KnowledgeCategory;
  max_length: number | null;
  tone: Tone | null;
  confidence: number;
}

export interface SuggestionRequest {
  field: FieldContext;
  classification: ClassificationResult;
  chunks: KnowledgeChunk[];
}

export interface SuggestionResult {
  suggestion_text: string;
}

export interface IngestRequest {
  source_file_name: string;
  text: string;
}

// Extension-specific message types
export interface FieldFocusedMessage {
  type: "FIELD_FOCUSED";
  fieldContext: FieldContext;
}

export interface ManualSuggestMessage {
  type: "MANUAL_SUGGEST";
  tabId: number;
}

export interface AutoFillPageMessage {
  type: "AUTO_FILL_PAGE";
}

export interface SuggestionAvailableMessage {
  type: "SUGGESTION_AVAILABLE";
  fieldId: string;
  suggestionText: string;
}

export interface SuggestionErrorMessage {
  type: "SUGGESTION_ERROR";
  fieldId: string;
  error: string;
}

// New message types for chat, highlighting, and summarization
export interface ChatMessage {
  type: "CHAT_MESSAGE";
  message: string;
  conversationHistory?: Array<{role: string, content: string}>;
}

export interface ChatResponseMessage {
  type: "CHAT_RESPONSE";
  response: string;
  error?: string;
}

export interface HighlightElementsMessage {
  type: "HIGHLIGHT_ELEMENTS";
  query: string;
}

export interface HighlightElementsResultMessage {
  type: "HIGHLIGHT_ELEMENTS_RESULT";
  elements: Array<{selector: string, description: string}>;
}

export interface SummarizePageMessage {
  type: "SUMMARIZE_PAGE";
}

export interface SummarizePageResultMessage {
  type: "SUMMARIZE_PAGE_RESULT";
  summary: string;
  error?: string;
}

export interface ClearHighlightsMessage {
  type: "CLEAR_HIGHLIGHTS";
}

export interface ToggleSidePanelMessage {
  type: "TOGGLE_SIDE_PANEL";
}

// Web Memory types - Save and search visited websites
export interface SavePageToMemoryMessage {
  type: "SAVE_PAGE_TO_MEMORY";
  pageData: {
    url: string;
    title: string;
    content: string;
    headings: string[];
    description: string;
    keywords: string[];
  };
}

export interface SearchWebMemoryMessage {
  type: "SEARCH_WEB_MEMORY";
  query: string;
}

export interface WebMemoryResultMessage {
  type: "WEB_MEMORY_RESULT";
  results: Array<{
    url: string;
    title: string;
    snippet: string;
    domain: string;
    relevance: number;
    visited_at: string;
  }>;
  answer?: string;  // AI-generated answer based on the results
}

export interface GetWebMemoryStatsMessage {
  type: "GET_WEB_MEMORY_STATS";
}

export interface WebMemoryStatsResultMessage {
  type: "WEB_MEMORY_STATS_RESULT";
  stats: {
    totalPages: number;
    uniqueDomains: number;
    totalVisits: number;
  };
}

export interface ClearWebMemoryMessage {
  type: "CLEAR_WEB_MEMORY";
}

export interface OpenOptionsPageMessage {
  type: "OPEN_OPTIONS_PAGE";
}

export type ExtensionMessage =
  | FieldFocusedMessage
  | ManualSuggestMessage
  | AutoFillPageMessage
  | SuggestionAvailableMessage
  | SuggestionErrorMessage
  | ChatMessage
  | ChatResponseMessage
  | HighlightElementsMessage
  | HighlightElementsResultMessage
  | SummarizePageMessage
  | SummarizePageResultMessage
  | ClearHighlightsMessage
  | ToggleSidePanelMessage
  | SavePageToMemoryMessage
  | SearchWebMemoryMessage
  | WebMemoryResultMessage
  | GetWebMemoryStatsMessage
  | WebMemoryStatsResultMessage
  | ClearWebMemoryMessage
  | OpenOptionsPageMessage;

// Configuration
export interface ExtensionConfig {
  backendUrl: string;
}

// Extension settings
export interface ExtensionSettings {
  enabled: boolean;
  autoSuggest: boolean;  // Auto-suggest on focus vs manual only
}

