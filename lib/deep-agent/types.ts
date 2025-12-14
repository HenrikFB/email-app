/**
 * Deep Agent Types
 * 
 * Type definitions for the Deep Agent email analysis pipeline.
 * This module is independent and self-contained.
 */

// ============================================
// Core Pipeline Types
// ============================================

/**
 * Input configuration for running the deep agent pipeline
 */
export interface DeepAgentInput {
  /** User ID for database operations */
  userId: string
  /** Agent configuration ID */
  agentConfigId: string
  /** Microsoft Graph access token */
  accessToken: string
  /** Email ID to analyze */
  emailId: string
  /** Agent configuration settings */
  config: DeepAgentConfig
}

/**
 * Configuration from agent_configurations table
 */
export interface DeepAgentConfig {
  /** What to look for in emails */
  matchCriteria: string
  /** Fields to extract */
  extractionFields: string
  /** User's intent description */
  userIntent?: string
  /** Whether draft generation is enabled */
  draftGenerationEnabled: boolean
  /** Free-form draft instructions */
  draftInstructions?: string
  /** Knowledge base IDs to search */
  knowledgeBaseIds: string[]
}

/**
 * Result from the deep agent pipeline
 */
export interface DeepAgentResult {
  success: boolean
  emailId: string
  
  // Analysis results
  matched: boolean
  extractedData: Record<string, unknown>
  confidence: number
  reasoning: string
  
  // Sources
  webSourcesSearched: WebSearchResult[]
  kbSourcesFound: KBSearchResult[]
  
  // Draft (if enabled)
  generatedDraft?: GeneratedDraft
  
  // Metadata
  processingTimeMs: number
  error?: string
}

// ============================================
// Email Analysis Types
// ============================================

/**
 * Extracted email content
 */
export interface ParsedEmail {
  subject: string
  from: string
  to: string[]
  date: string
  plainText: string
  snippet: string
}

/**
 * Extracted entities and intent from email
 */
export interface EmailAnalysis {
  /** Extracted entities (companies, technologies, locations, etc.) */
  entities: ExtractedEntities
  /** Refined user intent based on email content */
  intent: string
  /** Key search terms derived from email */
  searchTerms: string[]
  /** Whether email matches criteria */
  matched: boolean
  /** Match confidence 0-1 */
  confidence: number
  /** Reasoning for the match decision */
  reasoning: string
  /** Extracted structured data based on extraction_fields */
  extractedData: Record<string, unknown>
}

/**
 * Entities extracted from email
 */
export interface ExtractedEntities {
  companies: string[]
  technologies: string[]
  locations: string[]
  jobTitles: string[]
  skills: string[]
  other: Record<string, string[]>
}

// ============================================
// Web Search Types
// ============================================

/**
 * Web search query
 */
export interface WebSearchQuery {
  query: string
  sourceEntity?: string
  priority: number
}

/**
 * Web search result from Tavily
 */
export interface WebSearchResult {
  url: string
  title: string
  content: string
  score: number
  publishedDate?: string
}

/**
 * Aggregated web research results
 */
export interface WebResearchResult {
  queries: WebSearchQuery[]
  results: WebSearchResult[]
  summary: string
  relevantUrls: string[]
}

// ============================================
// Knowledge Base Search Types
// ============================================

/**
 * KB search query with intent
 */
export interface KBSearchQuery {
  query: string
  sourceField?: string
  sourceValue?: string
  reasoning: string
}

/**
 * KB search result
 */
export interface KBSearchResult {
  documentId: string
  documentTitle: string
  knowledgeBaseId: string
  knowledgeBaseName: string
  chunkId: string
  content: string
  similarity: number
  matchType: 'hybrid' | 'semantic' | 'fulltext'
  sourceQuery: string
}

/**
 * Aggregated KB research results
 */
export interface KBResearchResult {
  queriesExecuted: KBSearchQuery[]
  results: KBSearchResult[]
  totalResults: number
  coverageAnalysis: {
    fieldsWithContent: string[]
    fieldsWithoutContent: string[]
    overallCoverage: number
  }
}

// ============================================
// Draft Generation Types
// ============================================

/**
 * Generated draft
 */
export interface GeneratedDraft {
  content: string
  kbSourcesUsed: Array<{
    documentId: string
    documentTitle: string
    snippetUsed: string
  }>
  metadata: DraftMetadata
}

/**
 * Draft generation metadata
 */
export interface DraftMetadata {
  reasoning: string
  iterations: number
  searchQueries: string[]
  confidence: number
  modelUsed: string
  processingTimeMs: number
  webSourcesSearched: string[]
}

/**
 * Draft critique result
 */
export interface DraftCritique {
  isAcceptable: boolean
  score: number
  issues: string[]
  suggestions: string[]
  shouldRefine: boolean
}

// ============================================
// Sub-Agent Types
// ============================================

/**
 * Sub-agent configuration
 */
export interface SubAgentConfig {
  name: string
  description: string
  systemPrompt: string
  model?: string
}

/**
 * Sub-agent result (generic)
 */
export interface SubAgentResult<T> {
  success: boolean
  data?: T
  error?: string
  reasoning?: string
  processingTimeMs: number
}

// ============================================
// Tool Types
// ============================================

/**
 * Tool execution context
 */
export interface ToolContext {
  userId: string
  agentConfigId: string
  runId: string
}

/**
 * Generic tool result
 */
export interface ToolResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// ============================================
// Database Types
// ============================================

/**
 * Generated draft row for database
 */
export interface GeneratedDraftRow {
  id?: string
  user_id: string
  analyzed_email_id?: string
  agent_configuration_id?: string
  draft_content: string
  kb_sources_used: Array<{
    documentId: string
    documentTitle: string
    snippetUsed: string
  }>
  generation_metadata: DraftMetadata
  created_at?: string
  updated_at?: string
}

// ============================================
// File System Types (for deepagents)
// ============================================

/**
 * File written to deep agent file system
 */
export interface DeepAgentFile {
  path: string
  content: string
  type: 'json' | 'text' | 'markdown'
}

/**
 * Orchestrator state
 */
export interface OrchestratorState {
  email?: ParsedEmail
  emailAnalysis?: EmailAnalysis
  webResearch?: WebResearchResult
  kbResearch?: KBResearchResult
  draft?: GeneratedDraft
  errors: string[]
  currentPhase: 'init' | 'email' | 'web' | 'kb' | 'draft' | 'complete' | 'error'
}

