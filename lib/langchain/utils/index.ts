/**
 * Utility exports for LangChain workflow
 */

export { debugLog } from './debug-logger'
export type { DebugSession, DebugStep } from './debug-logger'

// Content management utilities
export {
  CONTENT_LIMITS,
  estimateTokens,
  estimateMessagesTokens,
  smartTruncate,
  truncateJobDescription,
  trimToolMessages,
} from './content-trimmer'

// Email splitting utilities
export {
  splitEmailIntoChunks,
  needsBatchedProcessing,
  detectEmailSource,
  estimateJobCount,
} from './email-splitter'
export type { JobChunk, EmailSplitResult, EmailSource } from './email-splitter'
