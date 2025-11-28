/**
 * Auto Search Types
 * 
 * Type definitions for the multi-intent search system.
 * Follows Strategy Pattern for extensibility.
 */

// ============================================
// Search Mode Types
// ============================================

/**
 * Available search modes
 * - single: One combined query from all data
 * - multi_intent: Split array fields into separate searches
 * - ai_powered: LLM generates optimal queries
 */
export type SearchMode = 'single' | 'multi_intent' | 'ai_powered'

// ============================================
// Search Intent Types
// ============================================

/**
 * Represents a single search intent/query
 */
export interface SearchIntent {
  /** The search query string */
  query: string
  /** Which field this intent originated from */
  sourceField?: string
  /** The original value that generated this intent */
  sourceValue?: string
  /** Priority for result ranking (higher = more important) */
  priority: number
  /** Reasoning for why this query was generated (for AI mode) */
  reasoning?: string
}

/**
 * Result of query generation
 */
export interface QueryGenerationResult {
  /** Generated search intents */
  intents: SearchIntent[]
  /** Total processing time in ms */
  processingTimeMs: number
  /** Any warnings during generation */
  warnings?: string[]
  /** Error if generation failed */
  error?: string
}

// ============================================
// Search Configuration Types
// ============================================

/**
 * Configuration for automatic KB search
 */
export interface AutoSearchConfig {
  /** User ID for filtering */
  userId: string
  /** Agent configuration ID */
  agentConfigId: string
  /** Extracted data from email */
  extractedData: Record<string, unknown>
  /** Confidence score of the match */
  confidence: number
  /** Whether auto search is enabled */
  autoSearchEnabled: boolean
  /** KB ID to auto-save to (optional) */
  autoSaveKBId?: string
  /** Confidence threshold for auto-save */
  autoSaveThreshold?: number
  /** Search mode */
  searchMode: SearchMode
  /** Query template for single mode */
  queryTemplate?: string
  /** Instructions for AI mode */
  searchInstructions?: string
  /** Fields to split for multi_intent mode */
  splitFields?: string[]
  /** Maximum number of queries to run */
  maxQueries: number
  /** User's intent description (from agent config) */
  userIntent?: string
  /** Extraction fields definition (from agent config) */
  extractionFields?: string
}

/**
 * Context passed to strategies
 */
export interface StrategyContext {
  /** Extracted data from email analysis */
  extractedData: Record<string, unknown>
  /** User's intent description */
  userIntent?: string
  /** Extraction field definitions */
  extractionFields?: string
  /** AI instructions for query generation */
  searchInstructions?: string
  /** Template for query generation (single mode) */
  queryTemplate?: string
  /** Fields to split (multi_intent mode) */
  splitFields?: string[]
  /** Maximum queries to generate */
  maxQueries: number
}

// ============================================
// Search Result Types
// ============================================

/**
 * Single search result from KB
 */
export interface KBSearchHit {
  /** Document title */
  title: string
  /** Knowledge base name */
  kbName: string
  /** Similarity score (0-1) */
  similarity: number
  /** Content preview */
  preview: string
  /** Which intent/query found this */
  sourceIntent?: string
  /** Match type (hybrid, fulltext, semantic) */
  matchType?: 'hybrid' | 'fulltext' | 'semantic'
  /** Document ID for navigation */
  documentId?: string
  /** KB ID for navigation */
  knowledgeBaseId?: string
}

/**
 * Combined results from all searches
 */
export interface MultiIntentSearchResult {
  /** When search was performed */
  searchPerformedAt: string
  /** Search mode used */
  searchMode: SearchMode
  /** Queries that were executed */
  queries: Array<{
    query: string
    sourceField?: string
    resultCount: number
  }>
  /** Deduplicated and ranked results */
  results: KBSearchHit[]
  /** Total unique results found */
  totalResults: number
  /** Total processing time */
  processingTimeMs: number
}

// ============================================
// Strategy Interface
// ============================================

/**
 * Interface for search query generation strategies
 * Implementations must generate search intents from extracted data
 */
export interface ISearchQueryStrategy {
  /** Strategy name for logging */
  readonly name: string
  
  /** Strategy mode identifier */
  readonly mode: SearchMode
  
  /**
   * Generate search intents from context
   * @param context - Data and configuration for generation
   * @returns Generated search intents
   */
  generateQueries(context: StrategyContext): Promise<QueryGenerationResult>
}

// ============================================
// Factory Types
// ============================================

/**
 * Factory for creating search query strategies
 */
export interface IStrategyFactory {
  /**
   * Create a strategy based on mode
   * @param mode - Search mode
   * @returns Appropriate strategy instance
   */
  createStrategy(mode: SearchMode): ISearchQueryStrategy
  
  /**
   * Get all available strategies
   */
  getAvailableStrategies(): SearchMode[]
}

