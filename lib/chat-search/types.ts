/**
 * Chat Search Types
 * 
 * Core interfaces and types for the AI-powered chat search system.
 * Follows existing patterns from lib/content-retrieval/types.ts
 */

import type { ChatCompletionTool, ChatCompletionMessageParam } from 'openai/resources/chat/completions'

// ============================================
// Tool Interface (Strategy Pattern)
// ============================================

/**
 * Interface for chat search tools
 * Each tool implements semantic search, field matching, etc.
 */
export interface IChatSearchTool {
  /** Unique tool name */
  readonly name: string
  
  /** OpenAI function definition */
  getDefinition(): ChatCompletionTool
  
  /** Execute the tool with parsed arguments */
  execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolExecutionResult>
}

/**
 * Context provided to tools during execution
 */
export interface ToolExecutionContext {
  userId: string
  agentConfigId?: string
  assignedKBIds: string[]
  assignedKBNames: string[]
}

/**
 * Result from tool execution
 */
export interface ToolExecutionResult {
  success: boolean
  source: 'knowledge_base' | 'analyzed_emails' | 'exact_match' | 'clarification'
  count: number
  results: ToolResultItem[]
  error?: string
}

/**
 * Individual result item (normalized across sources)
 */
export interface ToolResultItem {
  id: string
  title: string
  subtitle?: string
  similarity?: number
  preview?: string  // Snippet with highlighted matches (uses **** markers)
  snippet?: string  // Raw snippet with HTML marks
  fullContent?: string  // Full content for detail view
  content?: string  // Also content for backwards compat
  match_type?: 'hybrid' | 'fulltext' | 'semantic'
  
  // KB result specific fields (at top level for easy access)
  document_id?: string
  knowledge_base_id?: string
  chunk_id?: string
  
  // Email result specific fields (at top level for easy access)
  email_id?: string
  source_url?: string
  content_type?: string
  embedded_text?: string
  
  metadata?: Record<string, unknown>
}

// ============================================
// Chat Message Types
// ============================================

/**
 * Chat message for conversation history
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: string
  kbResults?: KBSearchResult[]
  emailResults?: EmailSearchResult[]
}

/**
 * Knowledge base search result (from existing service)
 */
export interface KBSearchResult {
  chunk_id: string
  document_id: string
  document_title: string
  document_type: string
  knowledge_base_id: string
  kb_name: string
  kb_type: string
  content: string
  snippet?: string  // Highlighted snippet with **** markers
  similarity: number
  chunk_index: number
  context_tags?: string[]
  match_type?: 'hybrid' | 'fulltext' | 'semantic'
}

/**
 * Analyzed email search result (from existing service)
 */
export interface EmailSearchResult {
  email_id: string
  email_subject: string
  email_from: string
  matched: boolean
  extracted_data?: Record<string, unknown>
  data_by_source?: DataBySourceItem[]
  similarity: number
  content_type: string
  source_url?: string
  embedded_text: string
  snippet?: string  // Highlighted snippet with **** markers
  match_type?: 'hybrid' | 'fulltext' | 'semantic'
}

/**
 * Data by source item from analyzed emails
 */
export interface DataBySourceItem {
  source: string
  data: Record<string, unknown>
  reasoning: string
  confidence: number
}

// ============================================
// Search Context Types
// ============================================

/**
 * Agent configuration context for prompt building
 */
export interface AgentContext {
  id: string
  name: string
  match_criteria?: string
  extraction_fields?: string
  user_intent?: string
  assigned_kb_ids: string[]
  assigned_kb_names: string[]
}

/**
 * Current email context (when viewing specific email)
 */
export interface EmailContext {
  id: string
  email_subject?: string
  email_from?: string
  extracted_data?: Record<string, unknown>
  data_by_source?: DataBySourceItem[]
  matched?: boolean
}

/**
 * Full search context passed to service
 */
export interface SearchContext {
  agent?: AgentContext
  currentEmail?: EmailContext
}

// ============================================
// Service Types
// ============================================

/**
 * Options for chat search service
 */
export interface ChatSearchOptions {
  userId: string
  agentConfigId?: string
  currentEmailId?: string
  conversationHistory?: ChatMessage[]
  similarityThreshold?: number
  resultLimit?: number
}

/**
 * Result from chat search service
 */
export interface ChatSearchResult {
  success: boolean
  response: string
  kbResults?: KBSearchResult[]
  emailResults?: EmailSearchResult[]
  followUpQuestion?: string
  toolsUsed?: string[]
  error?: string
}

// ============================================
// Tool Argument Types
// ============================================

/**
 * Arguments for KB search tool
 */
export interface KBSearchArgs {
  semantic_query: string
  kb_ids?: string[]
  filters?: {
    document_type?: 'text_note' | 'saved_email' | 'saved_url' | 'uploaded_document'
    context_tags?: string[]
  }
  limit?: number
}

/**
 * Arguments for email search tool
 */
export interface EmailSearchArgs {
  semantic_query: string
  filters?: {
    matched_only?: boolean
    content_type?: 'extracted_data' | 'scraped_url'
  }
  limit?: number
}

/**
 * Arguments for field match tool
 */
export interface FieldMatchArgs {
  field_name: string
  field_value: string
  source?: 'kb' | 'emails' | 'both'
  limit?: number
}

/**
 * Arguments for clarification tool
 */
export interface ClarificationArgs {
  question: string
  options?: string[]
}

// ============================================
// Re-export OpenAI types for convenience
// ============================================

export type { ChatCompletionTool, ChatCompletionMessageParam }

