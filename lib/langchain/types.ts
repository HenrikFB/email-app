/**
 * LangChain Email Workflow Types
 * 
 * Type definitions for the email analysis workflow using LangGraph.
 * These types define the state schema and data structures used throughout the pipeline.
 */

// ============================================
// Agent Configuration Types
// ============================================

/**
 * Configuration from agent_configurations table
 * Defines what the agent should look for and how to process emails
 */
export interface AgentConfig {
  /** Unique identifier for this configuration */
  id: string
  /** What to look for in emails (user's match criteria) */
  matchCriteria: string
  /** Fields to extract from job listings */
  extractionFields: string
  /** User's overall intent for this agent */
  userIntent?: string
  /** Whether draft generation is enabled */
  draftGenerationEnabled: boolean
  /** Free-form instructions for draft generation */
  draftInstructions?: string
  /** Knowledge base IDs to search for drafting */
  knowledgeBaseIds: string[]
}

// ============================================
// Email Types
// ============================================

/**
 * Raw email input from Microsoft Graph
 */
export interface EmailInput {
  /** Email ID from Microsoft Graph */
  id: string
  /** Email subject */
  subject: string
  /** Sender email address */
  from: string
  /** Recipient email addresses */
  to: string[]
  /** Email date */
  date: string
  /** HTML body content */
  htmlBody: string
  /** Plain text snippet */
  snippet?: string
}

/**
 * Cleaned email after HTML processing
 */
export interface CleanedEmail {
  /** Original email ID */
  id: string
  /** Email subject */
  subject: string
  /** Sender email address */
  from: string
  /** Recipient email addresses */
  to: string[]
  /** Email date */
  date: string
  /** Plain text content (HTML stripped) */
  plainText: string
  /** Original HTML preserved for reference */
  originalHtml: string
}

// ============================================
// Job/Entity Types
// ============================================

/**
 * A job listing found in an email
 */
export interface JobListing {
  /** Unique identifier for this job within the email */
  id: string
  /** Company name */
  company: string
  /** Job position/title */
  position: string
  /** Location (city, country, remote, etc.) */
  location?: string
  /** Technologies mentioned */
  technologies: string[]
  /** Original URL from email (may be LinkedIn, etc.) */
  originalUrl?: string
  /** Whether this job matches user criteria */
  matched: boolean
  /** Match confidence (0-1) */
  confidence: number
  /** Reasoning for match decision */
  matchReasoning: string
  /** Extracted data based on extractionFields */
  extractedData: Record<string, unknown>
}

/**
 * Entities extracted from email analysis
 */
export interface ExtractedEntities {
  /** Company names found */
  companies: string[]
  /** Technologies mentioned */
  technologies: string[]
  /** Locations mentioned */
  locations: string[]
  /** Job titles/positions */
  positions: string[]
  /** Skills required */
  skills: string[]
  /** URLs found in email */
  urls: string[]
}

// ============================================
// Research Types
// ============================================

/**
 * A search query for web research
 */
export interface SearchQuery {
  /** The search query string */
  query: string
  /** Entity this query is for (e.g., company name) */
  entity?: string
  /** Priority (higher = more important) */
  priority: number
  /** Type of search (general, company, job) */
  type: 'general' | 'company' | 'job'
}

/**
 * A web source found during research
 */
export interface WebSource {
  /** URL of the source */
  url: string
  /** Page title */
  title: string
  /** Content snippet or full content */
  content: string
  /** Relevance score (0-1) */
  score: number
  /** Whether this is the primary job description source */
  isPrimarySource: boolean
  /** Source type */
  sourceType: 'career_page' | 'job_board' | 'company_page' | 'other'
}

/**
 * Research result for a single job
 */
export interface JobResearchResult {
  /** Job ID this research is for */
  jobId: string
  /** Company name */
  company: string
  /** Position researched */
  position: string
  /** Whether public job description was found */
  found: boolean
  /** Full job description (if found) */
  jobDescription?: string
  /** All sources searched */
  sourcesSearched: WebSource[]
  /** Primary source (best match) */
  primarySource?: WebSource
  /** Extracted requirements */
  requirements?: string[]
  /** Extracted technologies */
  technologies?: string[]
  /** Application deadline */
  deadline?: string
  /** Additional extracted data */
  extractedData: Record<string, unknown>
  /** Research reasoning/steps taken */
  reasoning: string
  /** Number of search iterations performed */
  iterations: number
}

// ============================================
// Workflow State Types
// ============================================

/**
 * Main workflow state
 * This is the state that flows through the LangGraph pipeline
 */
export interface EmailWorkflowState {
  // ===== INPUT =====
  /** Raw email input */
  email: EmailInput
  /** Agent configuration */
  config: AgentConfig
  /** User ID for database operations */
  userId: string
  
  // ===== PROCESSING =====
  /** Cleaned email content */
  cleanedEmail?: CleanedEmail
  /** Entities extracted from email */
  entities?: ExtractedEntities
  /** Jobs found in email */
  jobs: JobListing[]
  /** Search queries to execute */
  searchQueries: SearchQuery[]
  
  // ===== RESEARCH RESULTS =====
  /** Research results per job */
  researchResults: JobResearchResult[]
  
  // ===== OUTPUT =====
  /** Whether any jobs matched */
  hasMatches: boolean
  /** Total processing time in ms */
  processingTimeMs: number
  /** Any errors encountered */
  errors: string[]
  /** Current workflow phase */
  currentPhase: 'init' | 'cleaning' | 'analyzing' | 'researching' | 'aggregating' | 'complete' | 'error'
}

// ============================================
// Tool Types
// ============================================

/**
 * Tavily search result
 */
export interface TavilySearchResult {
  url: string
  title: string
  content: string
  score: number
  publishedDate?: string
  rawContent?: string
}

/**
 * Tavily search response
 */
export interface TavilySearchResponse {
  query: string
  answer?: string
  results: TavilySearchResult[]
  responseTime: number
}

/**
 * Tavily extract result
 */
export interface TavilyExtractResult {
  url: string
  rawContent: string
  extractedContent?: string
  error?: string
}

/**
 * Tavily extract response
 */
export interface TavilyExtractResponse {
  results: TavilyExtractResult[]
  failedUrls: string[]
}

// ============================================
// Debug/Logging Types
// ============================================

/**
 * Research step log entry
 */
export interface ResearchStepLog {
  step: number
  action: string
  tool: string
  input: Record<string, unknown>
  output: string
  reasoning: string
  timestamp: string
}

/**
 * Complete research log for a job
 */
export interface ResearchLog {
  jobId: string
  startTime: string
  endTime: string
  steps: ResearchStepLog[]
  finalResult: 'success' | 'partial' | 'failed'
  totalIterations: number
}

