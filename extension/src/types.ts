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

export type ExtensionMessage =
  | FieldFocusedMessage
  | ManualSuggestMessage
  | AutoFillPageMessage
  | SuggestionAvailableMessage
  | SuggestionErrorMessage;

// Configuration
export interface ExtensionConfig {
  backendUrl: string;
}

// Extension settings
export interface ExtensionSettings {
  enabled: boolean;
  autoSuggest: boolean;  // Auto-suggest on focus vs manual only
}

