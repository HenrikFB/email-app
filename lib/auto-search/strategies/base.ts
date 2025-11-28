/**
 * Base Search Query Strategy
 * 
 * Abstract base class providing common utilities for all strategies.
 * Follows Template Method pattern for shared logging and validation.
 */

import type {
  ISearchQueryStrategy,
  SearchMode,
  StrategyContext,
  QueryGenerationResult,
  SearchIntent,
} from '../types'

/**
 * Abstract base class for search query strategies
 * Provides common utilities and enforces interface contract
 */
export abstract class BaseSearchQueryStrategy implements ISearchQueryStrategy {
  abstract readonly name: string
  abstract readonly mode: SearchMode

  /**
   * Template method that wraps the actual generation with logging and timing
   */
  async generateQueries(context: StrategyContext): Promise<QueryGenerationResult> {
    const startTime = Date.now()
    console.log(`🔍 [${this.name}] Generating search queries...`)

    try {
      // Validate context
      const validationError = this.validateContext(context)
      if (validationError) {
        return {
          intents: [],
          processingTimeMs: Date.now() - startTime,
          error: validationError,
        }
      }

      // Generate queries (implemented by subclasses)
      const intents = await this.doGenerateQueries(context)

      // Post-process: dedupe, limit, and validate
      const processedIntents = this.postProcess(intents, context.maxQueries)

      const processingTimeMs = Date.now() - startTime
      console.log(`✅ [${this.name}] Generated ${processedIntents.length} queries in ${processingTimeMs}ms`)

      return {
        intents: processedIntents,
        processingTimeMs,
      }
    } catch (error) {
      const processingTimeMs = Date.now() - startTime
      console.error(`❌ [${this.name}] Error:`, error)

      return {
        intents: [],
        processingTimeMs,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Abstract method to be implemented by subclasses
   * Contains the actual query generation logic
   */
  protected abstract doGenerateQueries(context: StrategyContext): Promise<SearchIntent[]>

  /**
   * Validate the context before processing
   * @returns Error message if invalid, undefined if valid
   */
  protected validateContext(context: StrategyContext): string | undefined {
    if (!context.extractedData || Object.keys(context.extractedData).length === 0) {
      return 'No extracted data provided'
    }
    if (context.maxQueries < 1) {
      return 'maxQueries must be at least 1'
    }
    return undefined
  }

  /**
   * Post-process intents: deduplicate, limit, and sort by priority
   */
  protected postProcess(intents: SearchIntent[], maxQueries: number): SearchIntent[] {
    // Remove empty queries
    let processed = intents.filter((intent) => intent.query && intent.query.trim().length >= 3)

    // Deduplicate by query (case-insensitive)
    const seen = new Set<string>()
    processed = processed.filter((intent) => {
      const normalized = intent.query.toLowerCase().trim()
      if (seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })

    // Sort by priority (higher first)
    processed.sort((a, b) => b.priority - a.priority)

    // Limit to maxQueries
    return processed.slice(0, maxQueries)
  }

  /**
   * Helper: Extract values from a field (handles arrays and strings)
   */
  protected extractFieldValues(data: Record<string, unknown>, field: string): string[] {
    const value = data[field]
    if (!value) return []

    if (Array.isArray(value)) {
      return value.filter((v) => typeof v === 'string' && v.length > 0)
    }

    if (typeof value === 'string' && value.length > 0) {
      // Check if it's a comma-separated list
      if (value.includes(',')) {
        return value.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
      }
      return [value]
    }

    return []
  }

  /**
   * Helper: Get context fields for building queries
   */
  protected getContextFields(data: Record<string, unknown>): {
    title?: string
    company?: string
    location?: string
  } {
    return {
      title: this.getFirstValue(data, ['job_title', 'title', 'position', 'role']),
      company: this.getFirstValue(data, ['company', 'company_name', 'employer', 'organization']),
      location: this.getFirstValue(data, ['location', 'city', 'work_location', 'office_location']),
    }
  }

  /**
   * Helper: Get first non-empty value from multiple field names
   */
  protected getFirstValue(data: Record<string, unknown>, fields: string[]): string | undefined {
    for (const field of fields) {
      const value = data[field]
      if (typeof value === 'string' && value.length > 0) {
        return value
      }
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
        return value[0]
      }
    }
    return undefined
  }

  /**
   * Helper: Build a query string from components
   */
  protected buildQuery(...parts: (string | undefined)[]): string {
    return parts
      .filter((p): p is string => typeof p === 'string' && p.length > 0)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200) // Max 200 chars
  }
}

