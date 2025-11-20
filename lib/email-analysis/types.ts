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
    scraping_strategy?: ScrapingStrategy // Optional, defaults to 'two-pass'
  }
}

export interface SourcedData {
  source: string  // 'Email' or URL
  data: Record<string, any>
  reasoning: string
  confidence: number
}

export interface AnalysisJobResult {
  success: boolean
  emailId: string
  matched: boolean
  extractedData: Record<string, any>
  dataBySource?: SourcedData[]  // NEW: Data grouped by source
  scrapedUrls: string[]
  scrapedContent?: Record<string, { markdown: string; title: string; scraped_at: string }>  // NEW: Full scraped markdown content
  allLinksFound: string[]  // All URLs found in email (both scraped and not)
  emailHtmlBody: string    // Original email HTML for debugging
  reasoning: string        // AI explanation (required now, not optional)
  confidence: number       // AI confidence score (required now, not optional)
  error?: string
}

