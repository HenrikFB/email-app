/**
 * Content Retrieval Abstraction
 * 
 * Provides a unified interface for retrieving content from URLs
 * Supports multiple strategies: scraping, web search, or hybrid
 */

export type ContentRetrievalStrategy = 'scrape_only' | 'scrape_and_search' | 'search_only' | 'intelligent_discovery'

export type ContentSource = 'firecrawl' | 'tavily' | 'hybrid' | 'intelligent_discovery'

export interface ContentRetrievalResult {
  success: boolean
  url: string  // Original URL or found URL
  content: string  // Markdown or text content
  format: 'markdown' | 'text' | 'json'
  source: ContentSource
  metadata: {
    title?: string
    originalUrl?: string  // Original URL if search found alternative
    confidence?: number  // For search results, how confident we are
    searchQuery?: string  // Query used if this came from search
  }
  error?: string
}

export interface ContentRetriever {
  /**
   * Retrieve content from a URL
   * Implementation depends on strategy (scrape, search, or both)
   */
  retrieve(url: string, context?: RetrievalContext): Promise<ContentRetrievalResult>
}

export interface RetrievalContext {
  emailSubject?: string
  linkText?: string
  matchCriteria?: string
  extractionFields?: string
  runId?: string  // For debug logging
}

export interface SearchResult {
  url: string
  title: string
  content: string
  score?: number
}

