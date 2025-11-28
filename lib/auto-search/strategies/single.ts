/**
 * Single Query Strategy
 * 
 * Generates one combined search query from all extracted data.
 * This is the original/default behavior.
 */

import type { SearchMode, StrategyContext, SearchIntent } from '../types'
import { BaseSearchQueryStrategy } from './base'

/**
 * Strategy that creates a single combined search query
 * Supports template placeholders: {{field_name}}
 */
export class SingleQueryStrategy extends BaseSearchQueryStrategy {
  readonly name = 'SingleQueryStrategy'
  readonly mode: SearchMode = 'single'

  protected async doGenerateQueries(context: StrategyContext): Promise<SearchIntent[]> {
    const { extractedData, queryTemplate } = context

    let query: string

    if (queryTemplate) {
      // Use template with placeholder replacement
      query = this.processTemplate(queryTemplate, extractedData)
    } else {
      // Build from priority fields
      query = this.buildFromPriorityFields(extractedData)
    }

    if (!query || query.length < 5) {
      console.log('   ⚠️ Could not generate meaningful query')
      return []
    }

    return [
      {
        query,
        priority: 1,
        sourceField: 'combined',
        reasoning: queryTemplate ? 'Generated from template' : 'Generated from priority fields',
      },
    ]
  }

  /**
   * Process a template string, replacing {{field}} placeholders
   */
  private processTemplate(template: string, data: Record<string, unknown>): string {
    let query = template

    // Find all {{field}} placeholders
    const placeholders = template.match(/\{\{(\w+)\}\}/g) || []

    for (const placeholder of placeholders) {
      const fieldName = placeholder.replace(/\{\{|\}\}/g, '')
      const value = data[fieldName]

      if (value !== undefined && value !== null) {
        const valueStr = Array.isArray(value) ? value.slice(0, 5).join(', ') : String(value)
        query = query.replace(placeholder, valueStr)
      } else {
        // Remove placeholder if field not found
        query = query.replace(placeholder, '')
      }
    }

    // Clean up extra spaces and trim
    return query.replace(/\s+/g, ' ').trim()
  }

  /**
   * Build query from priority fields (original behavior)
   */
  private buildFromPriorityFields(data: Record<string, unknown>): string {
    const queryParts: string[] = []

    // Priority fields for search
    const priorityFields = [
      'job_title',
      'title',
      'position',
      'role',
      'company',
      'company_name',
      'employer',
      'technologies',
      'tech_stack',
      'skills',
      'location',
      'city',
      'work_location',
    ]

    for (const field of priorityFields) {
      const value = data[field]
      if (value) {
        if (Array.isArray(value)) {
          // Take first 3 items from arrays
          queryParts.push(value.slice(0, 3).join(' '))
        } else if (typeof value === 'string' && value.length > 0) {
          queryParts.push(value)
        }
      }
    }

    // Fallback: use any string fields if no priority fields found
    if (queryParts.length === 0) {
      for (const [_key, value] of Object.entries(data)) {
        if (typeof value === 'string' && value.length > 5 && value.length < 100) {
          queryParts.push(value)
          if (queryParts.length >= 3) break
        }
      }
    }

    // Build final query (max 200 chars)
    const query = queryParts.join('. ')
    return query.length > 200 ? query.substring(0, 200) : query
  }
}

