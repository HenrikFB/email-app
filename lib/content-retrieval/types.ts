/**
 * Content Retrieval Abstraction
 * 
 * Provides a unified interface for retrieving content from URLs
 * Supports multiple strategies: scraping, web search, or hybrid
 */

export type ContentRetrievalStrategy = 'scrape_only' | 'scrape_and_search' | 'search_only'

export type ContentSource = 'firecrawl' | 'tavily' | 'hybrid'

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
}

export interface SearchResult {
  url: string
  title: string
  content: string
  score?: number
}

