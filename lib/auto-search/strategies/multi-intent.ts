/**
 * Multi-Intent Query Strategy
 * 
 * Splits array fields (like technologies, skills) into separate search queries.
 * Each value becomes its own search with context from other fields.
 */

import type { SearchMode, StrategyContext, SearchIntent } from '../types'
import { BaseSearchQueryStrategy } from './base'

/**
 * Default fields to split if none specified
 */
const DEFAULT_SPLIT_FIELDS = [
  'technologies',
  'tech_stack',
  'skills',
  'programming_languages',
  'frameworks',
  'tools',
]

/**
 * Strategy that creates separate searches for each value in array fields
 */
export class MultiIntentStrategy extends BaseSearchQueryStrategy {
  readonly name = 'MultiIntentStrategy'
  readonly mode: SearchMode = 'multi_intent'

  protected async doGenerateQueries(context: StrategyContext): Promise<SearchIntent[]> {
    const { extractedData, splitFields, maxQueries } = context
    const intents: SearchIntent[] = []

    // Determine which fields to split
    const fieldsToSplit = splitFields && splitFields.length > 0 
      ? splitFields 
      : DEFAULT_SPLIT_FIELDS

    // Get context for building queries
    const ctx = this.getContextFields(extractedData)

    console.log(`   📋 Splitting fields: ${fieldsToSplit.join(', ')}`)

    // Process each split field
    for (const field of fieldsToSplit) {
      const values = this.extractFieldValues(extractedData, field)

      if (values.length === 0) continue

      console.log(`   📂 Field "${field}": ${values.length} values`)

      // Create intent for each value
      for (const value of values) {
        // Skip very short or very long values
        if (value.length < 2 || value.length > 50) continue

        // Build contextual query: "Python Developer Copenhagen" or ".NET Senior Developer"
        const query = this.buildContextualQuery(value, ctx)

        if (query.length >= 5) {
          intents.push({
            query,
            sourceField: field,
            sourceValue: value,
            priority: this.calculatePriority(field, value),
            reasoning: `Split from ${field}: "${value}"`,
          })
        }

        // Stop if we have enough intents
        if (intents.length >= maxQueries * 2) break
      }

      if (intents.length >= maxQueries * 2) break
    }

    // If no intents from split fields, fall back to combined query
    if (intents.length === 0) {
      console.log('   ℹ️ No split field values found, creating combined query')
      const fallbackQuery = this.createFallbackQuery(extractedData, ctx)
      if (fallbackQuery) {
        intents.push({
          query: fallbackQuery,
          sourceField: 'combined',
          priority: 1,
          reasoning: 'Fallback combined query',
        })
      }
    }

    return intents
  }

  /**
   * Build a contextual query combining the value with context
   * Example: "Python" + {title: "Senior Developer", location: "Copenhagen"}
   *       -> "Python Senior Developer Copenhagen"
   */
  private buildContextualQuery(
    value: string,
    context: { title?: string; company?: string; location?: string }
  ): string {
    // Build query with value as primary focus
    const parts: string[] = [value]

    // Add title if available and not too long
    if (context.title && context.title.length < 50) {
      parts.push(context.title)
    }

    // Add location if available
    if (context.location && context.location.length < 30) {
      parts.push(context.location)
    }

    return this.buildQuery(...parts)
  }

  /**
   * Calculate priority based on field and value
   */
  private calculatePriority(field: string, value: string): number {
    // Higher priority for primary tech fields
    const highPriorityFields = ['technologies', 'tech_stack', 'programming_languages']
    const mediumPriorityFields = ['skills', 'frameworks', 'tools']

    let priority = 0.5

    if (highPriorityFields.includes(field)) {
      priority = 1.0
    } else if (mediumPriorityFields.includes(field)) {
      priority = 0.8
    }

    // Boost for common/important technologies
    const importantTech = [
      'python', 'java', 'javascript', 'typescript', 'react', 'node',
      '.net', 'c#', 'go', 'rust', 'kubernetes', 'docker', 'aws', 'azure',
    ]
    if (importantTech.some((tech) => value.toLowerCase().includes(tech))) {
      priority += 0.2
    }

    return Math.min(priority, 1.0)
  }

  /**
   * Create fallback combined query if no split values found
   */
  private createFallbackQuery(
    data: Record<string, unknown>,
    context: { title?: string; company?: string; location?: string }
  ): string | undefined {
    const parts: string[] = []

    if (context.title) parts.push(context.title)
    if (context.company) parts.push(context.company)
    if (context.location) parts.push(context.location)

    // Try to get any string value
    if (parts.length === 0) {
      for (const value of Object.values(data)) {
        if (typeof value === 'string' && value.length > 5 && value.length < 100) {
          parts.push(value)
          break
        }
      }
    }

    return parts.length > 0 ? this.buildQuery(...parts) : undefined
  }
}

