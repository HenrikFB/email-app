/**
 * Knowledge Base Search Tool
 * 
 * Wraps existing searchKnowledgeBases function with OpenAI tool interface.
 * Adds filter support for document_type and context_tags.
 * 
 * Uses TRUE hybrid search (keyword + semantic with RRF) for best results.
 * Works with both English and Danish content.
 */

import { BaseTool } from './base-tool'
import { searchKnowledgeBases } from '@/lib/embeddings/service'
import type {
  ToolExecutionContext,
  ToolExecutionResult,
  KBSearchArgs,
  ChatCompletionTool,
} from '../types'

export class KBSearchTool extends BaseTool {
  readonly name = 'search_knowledge_base'
  
  getDefinition(): ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: 'Search across knowledge base documents for similar content using semantic search. Use for finding cover letters, saved job descriptions, uploaded documents, or any saved reference material.',
        parameters: {
          type: 'object',
          properties: {
            semantic_query: {
              type: 'string',
              description: 'A focused natural language query for semantic search. Keep under 200 characters. Focus on the most important concepts (role, technology, location, company).',
            },
            kb_ids: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional: specific knowledge base IDs to search. If empty, searches all assigned KBs.',
            },
            filters: {
              type: 'object',
              properties: {
                document_type: {
                  type: 'string',
                  enum: ['text_note', 'saved_email', 'saved_url', 'uploaded_document'],
                  description: 'Filter by document type',
                },
                context_tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by context tags (e.g., ["fullstack", "python"])',
                },
              },
            },
            limit: {
              type: 'number',
              description: 'Max results to return (default 5, max 10)',
            },
          },
          required: ['semantic_query'],
        },
      },
    }
  }
  
  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const typedArgs = args as unknown as KBSearchArgs
    
    this.logExecution('start', { args: typedArgs })
    
    try {
      // Determine which KBs to search
      const kbIds = typedArgs.kb_ids?.length 
        ? typedArgs.kb_ids 
        : context.assignedKBIds.length 
          ? context.assignedKBIds 
          : null
      
      // Limit query length for better embedding quality
      const query = typedArgs.semantic_query.substring(0, 200)
      const limit = Math.min(typedArgs.limit || 5, 10)
      
      // Lower threshold since we now have true hybrid search (keyword + semantic)
      // The RRF algorithm will properly rank results that match both ways
      const threshold = 0.2
      
      console.log(`🔧 [KB Search] Query: "${query}" (hybrid: keyword + semantic)`)
      
      // Execute TRUE hybrid search (keyword + semantic with RRF)
      const results = await searchKnowledgeBases(
        query,
        context.userId,
        kbIds,
        limit,
        threshold
      )
      
      // Apply post-search filters if specified
      let filteredResults = results || []
      
      if (typedArgs.filters?.document_type) {
        filteredResults = filteredResults.filter(
          (r: any) => r.document_type === typedArgs.filters!.document_type
        )
      }
      
      if (typedArgs.filters?.context_tags?.length) {
        const filterTags = typedArgs.filters.context_tags.map(t => t.toLowerCase())
        filteredResults = filteredResults.filter((r: any) => {
          const docTags = (r.context_tags || []).map((t: string) => t.toLowerCase())
          return filterTags.some(ft => docTags.includes(ft))
        })
      }
      
      // Log match types for debugging
      const matchTypes = filteredResults.reduce((acc: Record<string, number>, r: any) => {
        const type = r.match_type || 'unknown'
        acc[type] = (acc[type] || 0) + 1
        return acc
      }, {})
      console.log(`🔧 [KB Search] Results by match type:`, matchTypes)
      
      // Format results
      const formattedResults = this.formatKBResults(filteredResults)
      
      this.logExecution('complete', { count: formattedResults.length })
      
      return this.createSuccessResult('knowledge_base', formattedResults)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logExecution('error', { error: errorMessage })
      return this.createErrorResult(errorMessage, 'knowledge_base')
    }
  }
}

