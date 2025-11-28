/**
 * Email Search Tool
 * 
 * Wraps existing searchAnalyzedEmails function with OpenAI tool interface.
 * Adds filter support for matched_only and content_type.
 */

import { BaseTool } from './base-tool'
import { searchAnalyzedEmails } from '@/lib/embeddings/service'
import type {
  ToolExecutionContext,
  ToolExecutionResult,
  EmailSearchArgs,
  ChatCompletionTool,
} from '../types'

export class EmailSearchTool extends BaseTool {
  readonly name = 'search_analyzed_emails'
  
  getDefinition(): ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: 'Search previously analyzed emails and their scraped URLs using semantic search. Use when looking for similar job postings, emails from similar sources, or content that matches certain criteria.',
        parameters: {
          type: 'object',
          properties: {
            semantic_query: {
              type: 'string',
              description: 'A focused natural language query for semantic search. Keep under 200 characters. Focus on role, technology, company, or other key attributes.',
            },
            filters: {
              type: 'object',
              properties: {
                matched_only: {
                  type: 'boolean',
                  description: 'Only return emails that matched the agent criteria (default false)',
                },
                content_type: {
                  type: 'string',
                  enum: ['extracted_data', 'scraped_url'],
                  description: 'Filter by content type - extracted_data for email analysis, scraped_url for web page content',
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
    const typedArgs = args as unknown as EmailSearchArgs
    
    this.logExecution('start', { args: typedArgs })
    
    try {
      // Limit query length for better embedding quality
      const query = typedArgs.semantic_query.substring(0, 200)
      const limit = Math.min(typedArgs.limit || 5, 10)
      
      // Lower threshold since we now have true hybrid search (keyword + semantic)
      const threshold = 0.2
      
      console.log(`🔧 [Email Search] Query: "${query}" (hybrid: keyword + semantic)`)
      
      // Execute TRUE hybrid search (keyword + semantic with RRF)
      const results = await searchAnalyzedEmails(
        query,
        context.userId,
        limit,
        threshold
      )
      
      // Apply post-search filters if specified
      let filteredResults = results || []
      
      if (typedArgs.filters?.matched_only) {
        filteredResults = filteredResults.filter((r: any) => r.matched === true)
      }
      
      if (typedArgs.filters?.content_type) {
        filteredResults = filteredResults.filter(
          (r: any) => r.content_type === typedArgs.filters!.content_type
        )
      }
      
      // Format results
      const formattedResults = this.formatEmailResults(filteredResults)
      
      this.logExecution('complete', { count: formattedResults.length })
      
      return this.createSuccessResult('analyzed_emails', formattedResults)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logExecution('error', { error: errorMessage })
      return this.createErrorResult(errorMessage, 'analyzed_emails')
    }
  }
}

