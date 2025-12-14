/**
 * Deep Agent Module
 * 
 * Main exports for the Deep Agent email analysis pipeline.
 * 
 * This module provides an alternative to the traditional scraping-based
 * email analysis pipeline. It uses:
 * - Web search (Tavily) instead of scraping
 * - Multi-intent KB search
 * - AI-driven draft generation with self-critique
 * - Sub-agents for specialized tasks
 */

// Main orchestrator
export { 
  runDeepAgentPipeline, 
  createEmailDeepAgent,
} from './orchestrator'

// Types
export type {
  DeepAgentInput,
  DeepAgentConfig,
  DeepAgentResult,
  ParsedEmail,
  EmailAnalysis,
  ExtractedEntities,
  WebSearchQuery,
  WebSearchResult,
  WebResearchResult,
  KBSearchQuery,
  KBSearchResult,
  KBResearchResult,
  GeneratedDraft,
  DraftMetadata,
  DraftCritique,
  SubAgentConfig,
  OrchestratorState,
  GeneratedDraftRow,
} from './types'

// Configuration
export {
  MODEL_CONFIG,
  TEMPERATURE_CONFIG,
  SYSTEM_PROMPTS,
  TOOL_DESCRIPTIONS,
  LIMITS,
  DRAFT_INSTRUCTIONS_EXAMPLES,
  LOG_CONFIG,
} from './config'

// Tools (for direct use if needed)
export { emailAnalyzerTools } from './tools/email-analyzer'
export { webSearchTools } from './tools/web-search'
export { kbSearchTools } from './tools/kb-search'
export { draftGeneratorTools } from './tools/draft-generator'

// Sub-agents (for customization)
export { 
  emailAnalyzerSubAgent,
  webResearcherSubAgent,
  kbResearcherSubAgent,
  draftWriterSubAgent,
  allSubAgents,
} from './subagents'

// Task creators (for custom workflows)
export { createEmailAnalysisTask } from './subagents/email-analyzer'
export { createWebResearchTask } from './subagents/web-researcher'
export { createKBResearchTask } from './subagents/kb-researcher'
export { createDraftTask } from './subagents/draft-writer'

