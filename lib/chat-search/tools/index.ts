/**
 * Chat Search Tools Factory
 * 
 * Provides tool definitions and execution routing.
 * Follows factory pattern from lib/content-retrieval/factory.ts
 */

import { KBSearchTool } from './kb-search-tool'
import { EmailSearchTool } from './email-search-tool'
import { FieldMatchTool } from './field-match-tool'
import type {
  IChatSearchTool,
  ToolExecutionContext,
  ToolExecutionResult,
  ChatCompletionTool,
} from '../types'

// ============================================
// Tool Registry
// ============================================

/**
 * All available tools
 */
const toolRegistry: IChatSearchTool[] = [
  new KBSearchTool(),
  new EmailSearchTool(),
  new FieldMatchTool(),
]

/**
 * Tool map for quick lookup by name
 */
const toolMap = new Map<string, IChatSearchTool>(
  toolRegistry.map(tool => [tool.name, tool])
)

// ============================================
// Factory Functions
// ============================================

/**
 * Get all tool definitions for OpenAI API
 * @returns Array of ChatCompletionTool definitions
 */
export function getToolDefinitions(): ChatCompletionTool[] {
  return toolRegistry.map(tool => tool.getDefinition())
}

/**
 * Get a specific tool by name
 * @param name - Tool name
 * @returns Tool instance or undefined
 */
export function getTool(name: string): IChatSearchTool | undefined {
  return toolMap.get(name)
}

/**
 * Execute a tool call by name
 * @param toolName - Name of the tool to execute
 * @param args - Arguments parsed from OpenAI function call
 * @param context - Execution context
 * @returns Tool execution result
 */
export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  console.log(`📦 [Tool Factory] Executing tool: ${toolName}`)
  
  const tool = toolMap.get(toolName)
  
  if (!tool) {
    console.error(`❌ [Tool Factory] Unknown tool: ${toolName}`)
    return {
      success: false,
      source: 'knowledge_base',
      count: 0,
      results: [],
      error: `Unknown tool: ${toolName}`,
    }
  }
  
  return tool.execute(args, context)
}

/**
 * Execute multiple tool calls in parallel
 * @param toolCalls - Array of {name, args} objects
 * @param context - Execution context
 * @returns Array of tool results
 */
export async function executeToolCallsParallel(
  toolCalls: Array<{ name: string; args: Record<string, unknown> }>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult[]> {
  console.log(`📦 [Tool Factory] Executing ${toolCalls.length} tools in parallel`)
  
  const results = await Promise.all(
    toolCalls.map(({ name, args }) => executeToolCall(name, args, context))
  )
  
  const successCount = results.filter(r => r.success).length
  console.log(`📦 [Tool Factory] Completed: ${successCount}/${results.length} successful`)
  
  return results
}

// ============================================
// Exports
// ============================================

export { KBSearchTool } from './kb-search-tool'
export { EmailSearchTool } from './email-search-tool'
export { FieldMatchTool } from './field-match-tool'
export { BaseTool } from './base-tool'

