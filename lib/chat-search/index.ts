/**
 * Chat Search Module
 * 
 * AI-powered chat search using OpenAI tool calling.
 * Provides intelligent query understanding, multi-intent detection,
 * and parallel searches across knowledge bases and analyzed emails.
 * 
 * @example
 * ```typescript
 * import { chatSearch, generateSuggestedQueries } from '@/lib/chat-search'
 * 
 * const result = await chatSearch('Find Python jobs in Aarhus', {
 *   userId: 'user-123',
 *   agentConfigId: 'agent-456',
 * })
 * 
 * console.log(result.response)
 * console.log(result.kbResults)
 * console.log(result.emailResults)
 * ```
 */

// Main service
export { chatSearch, generateSuggestedQueries } from './service'

// Prompt builder
export { buildSystemPrompt, formatExtractedData } from './prompt-builder'

// Tools
export {
  getToolDefinitions,
  getTool,
  executeToolCall,
  executeToolCallsParallel,
  KBSearchTool,
  EmailSearchTool,
  FieldMatchTool,
  BaseTool,
} from './tools'

// Context hook (client-side)
export { useChatContext, buildEmailContext, buildKBContext } from './use-chat-context'

// Types
export type {
  // Tool interfaces
  IChatSearchTool,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolResultItem,
  
  // Chat types
  ChatMessage,
  ChatSearchOptions,
  ChatSearchResult,
  
  // Context types
  AgentContext,
  EmailContext,
  SearchContext,
  
  // Result types
  KBSearchResult,
  EmailSearchResult,
  DataBySourceItem,
  
  // Tool argument types
  KBSearchArgs,
  EmailSearchArgs,
  FieldMatchArgs,
  ClarificationArgs,
  
  // OpenAI types
  ChatCompletionTool,
  ChatCompletionMessageParam,
} from './types'

