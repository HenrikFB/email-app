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

export interface AnalysisJobInput {
  emailId: string
  accessToken: string
  agentConfig: {
    match_criteria: string
    extraction_fields: string
    follow_links: boolean
  }
}

export interface AnalysisJobResult {
  success: boolean
  emailId: string
  matched: boolean
  extractedData: Record<string, any>
  scrapedUrls: string[]
  error?: string
  reasoning?: string
  confidence?: number
}

