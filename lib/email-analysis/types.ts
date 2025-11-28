/**
 * Shared types for email analysis system
 * All types are generic and user-defined
 */

export interface AnalysisInput {
  emailHtml: string
  emailSubject: string
  emailFrom: string
  emailDate?: string
  scrapedContent?: ScrapedPage[]
  matchCriteria: string      // User-defined: what they're interested in
  extractionFields: string   // User-defined: what to extract if matched
}

export interface ScrapedPage {
  url: string
  markdown: string
  title?: string
}

export interface AnalysisResult {
  matched: boolean
  extractedData: Record<string, any> // Fully flexible - user defines structure
  reasoning: string
  confidence: number // 0-1 score
}

export interface ExtractedLink {
  url: string
  text: string
  isButton: boolean
}

/**
 * Email intent extracted from email content
 * Used to guide link prioritization with context
 */
export interface EmailIntent {
  refinedGoal: string      // More specific goal based on email content
  keyTerms: string[]       // Important keywords/phrases (e.g., [".NET", "JavaScript", "RPA"])
  expectedContent: string  // What kind of content should be in relevant pages
}

/**
 * Scraping strategy for link processing
 * - two-pass: Quick match check, then scrape if matched (saves credits)
 * - single-pass: Always scrape all links (for future use)
 * - smart-select: AI picks most relevant links to scrape (future feature)
 */
export type ScrapingStrategy = 'two-pass' | 'single-pass' | 'smart-select'

export interface AnalysisJobInput {
  emailId: string
  accessToken: string
  userId: string  // For RAG context and embeddings
  agentConfigId: string  // For RAG context (KB assignments)
  agentConfig: {
    match_criteria: string
    extraction_fields: string
    follow_links: boolean
    button_text_pattern?: string  // Optional: boost signal for link ranking (e.g., "Se jobbet|Apply")
    user_intent?: string  // Optional: user's explanation of their goal
    link_selection_guidance?: string  // Optional: guidance for link selection
    max_links_to_scrape?: number  // Optional: maximum links to scrape (default: 10)
    content_retrieval_strategy?: 'scrape_only' | 'scrape_and_search' | 'search_only'  // How to retrieve content
    extraction_examples?: string  // Optional: user-provided examples
    analysis_feedback?: string  // Optional: user feedback/notes
    scraping_strategy?: ScrapingStrategy // Optional, defaults to 'two-pass'
    
    // Automation fields
    auto_search_kb_on_match?: boolean  // When true, automatically search KBs on match
    auto_save_matches_to_kb_id?: string  // KB ID to auto-save matched emails to
    auto_save_confidence_threshold?: number  // Min confidence (0-1) for auto-save
    auto_search_query_template?: string  // Template for generating search query (uses {{field}} placeholders)
  }
}

/**
 * Result from automatic KB search when email matches
 */
export interface AutoKBSearchResult {
  searchPerformedAt: string
  query: string
  results: Array<{
    title: string
    kb_name: string
    similarity: number
    preview: string
  }>
  totalResults: number
}

export interface SourcedData {
  source: string  // 'Email' or URL
  data: Record<string, any>
  reasoning: string
  confidence: number
}

/**
 * Result from analyzing full content (email or scraped page)
 * without chunking
 */
export interface FullContentAnalysisResult {
  source: string  // 'Email' or URL
  sourceType: 'email' | 'scraped'
  matched: boolean
  extractedData: Record<string, any>
  reasoning: string
  confidence: number
  contentLength: number
  usedChunking: boolean  // Whether content was too large and needed chunking
}

export interface AnalysisJobResult {
  success: boolean
  emailId: string
  matched: boolean
  extractedData: Record<string, any>
  dataBySource?: SourcedData[]  // Data grouped by source
  scrapedUrls: string[]
  scrapedContent?: Record<string, { markdown: string; title: string; scraped_at: string }>  // Full scraped markdown content
  originalUrls?: Array<{ original: string; actual: string }>  // SafeLinks → Actual URL mappings
  allLinksFound: string[]  // All URLs found in email (both scraped and not)
  emailHtmlBody: string    // Original email HTML for debugging
  reasoning: string        // AI explanation (required now, not optional)
  confidence: number       // AI confidence score (required now, not optional)
  error?: string
  
  // Auto KB search results (if enabled)
  autoKBSearchResults?: AutoKBSearchResult
  autoSavedToKBId?: string  // KB ID if auto-saved
}

