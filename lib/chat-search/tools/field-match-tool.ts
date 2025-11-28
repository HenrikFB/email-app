/**
 * Field Match Tool
 * 
 * Exact field matching via Supabase JSONB queries.
 * Use for queries like "all jobs at Company X" or "positions requiring Python".
 */

import { BaseTool } from './base-tool'
import { createClient } from '@/lib/supabase/server'
import type {
  ToolExecutionContext,
  ToolExecutionResult,
  FieldMatchArgs,
  ChatCompletionTool,
  ToolResultItem,
} from '../types'

export class FieldMatchTool extends BaseTool {
  readonly name = 'find_by_field_value'
  
  getDefinition(): ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: 'Find exact matches by a specific extracted field value. Use when the user wants exact matches for a specific company, technology, location, or other field. Good for queries like "all jobs at Systematic" or "positions requiring Python".',
        parameters: {
          type: 'object',
          properties: {
            field_name: {
              type: 'string',
              description: 'The extraction field name to match (e.g., "technologies", "company", "location", "domain", "work_type")',
            },
            field_value: {
              type: 'string',
              description: 'The exact value to match (case-insensitive)',
            },
            source: {
              type: 'string',
              enum: ['kb', 'emails', 'both'],
              description: 'Where to search: kb (knowledge base), emails (analyzed emails), or both (default)',
            },
            limit: {
              type: 'number',
              description: 'Max results to return (default 10)',
            },
          },
          required: ['field_name', 'field_value'],
        },
      },
    }
  }
  
  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const typedArgs = args as unknown as FieldMatchArgs
    
    this.logExecution('start', { args: typedArgs })
    
    try {
      const supabase = await createClient()
      const limit = typedArgs.limit || 10
      const source = typedArgs.source || 'both'
      
      const results: ToolResultItem[] = []
      
      // Search emails if requested
      if (source === 'emails' || source === 'both') {
        const emailResults = await this.searchEmails(
          supabase,
          context.userId,
          typedArgs.field_name,
          typedArgs.field_value,
          limit
        )
        results.push(...emailResults)
      }
      
      // Search KB if requested
      if (source === 'kb' || source === 'both') {
        const kbResults = await this.searchKB(
          supabase,
          context.userId,
          typedArgs.field_name,
          typedArgs.field_value,
          context.assignedKBIds,
          limit
        )
        results.push(...kbResults)
      }
      
      this.logExecution('complete', { count: results.length })
      
      return this.createSuccessResult('exact_match', results)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logExecution('error', { error: errorMessage })
      return this.createErrorResult(errorMessage, 'exact_match')
    }
  }
  
  /**
   * Search analyzed emails for exact field matches
   */
  private async searchEmails(
    supabase: any,
    userId: string,
    fieldName: string,
    fieldValue: string,
    limit: number
  ): Promise<ToolResultItem[]> {
    // For array fields (technologies, competencies), use contains with array
    // For scalar fields (company, location), use contains with value
    const isArrayField = ['technologies', 'competencies', 'skills'].includes(fieldName.toLowerCase())
    
    let query = supabase
      .from('analyzed_emails')
      .select('id, email_subject, email_from, extracted_data, matched, confidence')
      .eq('user_id', userId)
      .not('extracted_data', 'is', null)
    
    // Use text search for case-insensitive matching
    // We'll filter results in memory for more flexible matching
    const { data, error } = await query.limit(100) // Get more and filter
    
    if (error) {
      console.error('Error searching emails:', error)
      return []
    }
    
    // Filter in memory for case-insensitive partial matching
    const filtered = (data || []).filter((email: any) => {
      const extractedData = email.extracted_data
      if (!extractedData) return false
      
      const fieldData = extractedData[fieldName]
      if (!fieldData) return false
      
      const searchValue = fieldValue.toLowerCase()
      
      if (Array.isArray(fieldData)) {
        return fieldData.some((item: any) => 
          String(item).toLowerCase().includes(searchValue)
        )
      }
      
      return String(fieldData).toLowerCase().includes(searchValue)
    })
    
    return filtered.slice(0, limit).map((email: any) => ({
      id: email.id,
      title: email.email_subject || 'Untitled Email',
      subtitle: email.email_from,
      similarity: 1.0, // Exact match
      preview: `${fieldName}: ${JSON.stringify(email.extracted_data[fieldName])}`,
      metadata: {
        source_type: 'email',
        matched: email.matched,
        confidence: email.confidence,
        extracted_data: email.extracted_data,
      },
    }))
  }
  
  /**
   * Search knowledge base for exact field matches
   */
  private async searchKB(
    supabase: any,
    userId: string,
    fieldName: string,
    fieldValue: string,
    kbIds: string[],
    limit: number
  ): Promise<ToolResultItem[]> {
    let query = supabase
      .from('kb_documents')
      .select(`
        id, 
        title, 
        content, 
        type, 
        context_tags,
        knowledge_bases (name)
      `)
      .eq('user_id', userId)
    
    // Filter by assigned KBs if provided
    if (kbIds.length > 0) {
      query = query.in('knowledge_base_id', kbIds)
    }
    
    const { data, error } = await query.limit(100)
    
    if (error) {
      console.error('Error searching KB:', error)
      return []
    }
    
    // Filter in memory - search in content and context_tags
    const searchValue = fieldValue.toLowerCase()
    
    const filtered = (data || []).filter((doc: any) => {
      // Check context tags first (more reliable)
      if (doc.context_tags?.length) {
        const hasMatchingTag = doc.context_tags.some((tag: string) =>
          tag.toLowerCase().includes(searchValue)
        )
        if (hasMatchingTag) return true
      }
      
      // Check content for field pattern
      const content = doc.content?.toLowerCase() || ''
      
      // Look for patterns like "technologies": ["Python", ...] or "company": "Systematic"
      const fieldPattern = `"${fieldName.toLowerCase()}":`
      if (content.includes(fieldPattern) && content.includes(searchValue)) {
        return true
      }
      
      // Also check for field name and value appearing close together
      return content.includes(fieldName.toLowerCase()) && content.includes(searchValue)
    })
    
    return filtered.slice(0, limit).map((doc: any) => ({
      id: doc.id,
      title: doc.title,
      subtitle: doc.knowledge_bases?.name || 'Unknown KB',
      similarity: 1.0, // Exact match
      preview: doc.content?.substring(0, 200),
      metadata: {
        source_type: 'kb',
        document_type: doc.type,
        context_tags: doc.context_tags,
      },
    }))
  }
}

