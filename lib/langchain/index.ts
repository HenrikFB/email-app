/**
 * LangChain Email Workflow
 * 
 * Main exports for the LangChain/LangGraph email analysis system.
 * 
 * Architecture:
 * - StateGraph workflow with conditional edges
 * - ReAct agent for iterative research with tools
 * - Structured LLM calls for email analysis
 * 
 * Usage:
 * ```typescript
 * import { runEmailWorkflow } from '@/lib/langchain'
 * 
 * const result = await runEmailWorkflow({
 *   email: { id, subject, from, to, date, htmlBody },
 *   config: { matchCriteria, extractionFields, ... },
 *   userId: 'user-123',
 * })
 * 
 * console.log(result.jobs) // Jobs found in email
 * console.log(result.hasMatches) // Whether any matched
 * console.log(result.researchResults) // Research for matched jobs
 * ```
 */

// ============================================
// Main Workflow
// ============================================

export { 
  runEmailWorkflow,
  streamEmailWorkflow,
  buildEmailWorkflow,
  getWorkflow,
  EmailWorkflowAnnotation,
} from './email-workflow'

export type {
  RunEmailWorkflowInput,
  EmailWorkflowResult,
  AnnotatedState,
} from './email-workflow'

// ============================================
// Types
// ============================================

export type {
  // Configuration
  AgentConfig,
  
  // Email
  EmailInput,
  CleanedEmail,
  
  // Jobs & Entities
  JobListing,
  ExtractedEntities,
  SearchQuery,
  
  // Research
  WebSource,
  JobResearchResult,
  
  // Tavily
  TavilySearchResult,
  TavilySearchResponse,
  TavilyExtractResult,
  TavilyExtractResponse,
  
  // State
  EmailWorkflowState,
  
  // Debug
  ResearchStepLog,
  ResearchLog,
} from './types'

// ============================================
// Tools
// ============================================

export {
  tavilySearchTool,
  smartJobSearchTool,
  tavilyExtractTool,
  extractJobDescriptionTool,
  allResearchTools,
} from './tools'

// ============================================
// Agents
// ============================================

export {
  createResearchAgent,
  researchJob,
  researchJobsBatch,
} from './agents/research-agent'

// ============================================
// Nodes (for advanced usage)
// ============================================

export {
  cleanEmailNode,
  analyzeEmailNode,
  researchNode,
  aggregateNode,
  // Utilities
  htmlToPlainText,
  extractUrlsFromHtml,
  extractLinksWithText,
  buildSummary,
} from './nodes'

