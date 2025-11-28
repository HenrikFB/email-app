/**
 * Base Tool Abstract Class
 * 
 * Provides shared utilities for all chat search tools.
 * Follows existing patterns from lib/content-retrieval/
 */

import type {
  IChatSearchTool,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolResultItem,
  ChatCompletionTool,
} from '../types'

/**
 * Abstract base class for chat search tools
 * Provides shared logging and result formatting utilities
 */
export abstract class BaseTool implements IChatSearchTool {
  abstract readonly name: string
  
  /**
   * Get OpenAI function definition
   * Must be implemented by subclasses
   */
  abstract getDefinition(): ChatCompletionTool
  
  /**
   * Execute the tool
   * Must be implemented by subclasses
   */
  abstract execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult>
  
  /**
   * Log tool execution for debugging
   */
  protected logExecution(
    action: 'start' | 'complete' | 'error',
    details: Record<string, unknown>
  ): void {
    const prefix = `🔧 [${this.name}]`
    
    switch (action) {
      case 'start':
        console.log(`${prefix} Executing...`)
        console.log(`   Args: ${JSON.stringify(details.args || {}, null, 2).substring(0, 200)}`)
        break
      case 'complete':
        console.log(`${prefix} ✅ Complete`)
        console.log(`   Results: ${details.count || 0} items`)
        break
      case 'error':
        console.error(`${prefix} ❌ Error:`, details.error)
        break
    }
  }
  
  /**
   * Format KB search results to normalized format
   * Includes snippet with highlighted matches and IDs for navigation
   */
  protected formatKBResults(results: any[]): ToolResultItem[] {
    return results.map((r) => ({
      id: r.chunk_id || r.document_id,
      // Include document_id and knowledge_base_id at TOP LEVEL for easy access
      document_id: r.document_id,
      knowledge_base_id: r.knowledge_base_id,
      chunk_id: r.chunk_id,
      title: r.document_title,
      subtitle: r.kb_name,
      similarity: r.similarity,
      // Use snippet (with highlights) if available, otherwise fall back to content preview
      preview: r.snippet || r.content?.substring(0, 200),
      snippet: r.snippet, // Keep snippet separately for highlighting
      fullContent: r.content, // Full content for detail view (chunk content)
      content: r.content, // Also as content for backwards compat
      match_type: r.match_type, // 'hybrid', 'fulltext', or 'semantic' at top level
      metadata: {
        document_id: r.document_id,
        knowledge_base_id: r.knowledge_base_id,
        document_type: r.document_type,
        kb_type: r.kb_type,
        chunk_index: r.chunk_index,
        context_tags: r.context_tags,
        match_type: r.match_type,
      },
    }))
  }
  
  /**
   * Format email search results to normalized format
   * Includes snippet with highlighted matches
   */
  protected formatEmailResults(results: any[]): ToolResultItem[] {
    return results.map((r) => ({
      id: r.email_id,
      // Include email_id at TOP LEVEL for easy access
      email_id: r.email_id,
      title: r.email_subject,
      subtitle: r.email_from,
      similarity: r.similarity,
      // Use snippet (with highlights) if available
      preview: r.snippet || r.embedded_text?.substring(0, 200),
      snippet: r.snippet, // Keep snippet separately for highlighting
      fullContent: r.embedded_text, // Full content for detail view
      embedded_text: r.embedded_text, // Also as embedded_text for backwards compat
      match_type: r.match_type, // At top level for easy access
      source_url: r.source_url, // At top level for easy access
      content_type: r.content_type, // At top level
      metadata: {
        email_id: r.email_id,
        matched: r.matched,
        content_type: r.content_type,
        source_url: r.source_url,
        match_type: r.match_type,
      },
    }))
  }
  
  /**
   * Create error result
   */
  protected createErrorResult(error: string, source: ToolExecutionResult['source']): ToolExecutionResult {
    return {
      success: false,
      source,
      count: 0,
      results: [],
      error,
    }
  }
  
  /**
   * Create success result
   */
  protected createSuccessResult(
    source: ToolExecutionResult['source'],
    results: ToolResultItem[]
  ): ToolExecutionResult {
    return {
      success: true,
      source,
      count: results.length,
      results,
    }
  }
}

