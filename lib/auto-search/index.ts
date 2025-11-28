/**
 * Auto Search Module
 * 
 * Multi-intent automatic KB search system.
 * Uses Strategy Pattern for flexible query generation.
 * 
 * Usage:
 * ```typescript
 * import { performAutoKBSearch, createSearchStrategy } from '@/lib/auto-search'
 * 
 * // Use the main service
 * const result = await performAutoKBSearch({
 *   userId: '...',
 *   agentConfigId: '...',
 *   extractedData: { technologies: ['Python', '.NET'] },
 *   searchMode: 'multi_intent',
 *   maxQueries: 5,
 *   // ...
 * })
 * 
 * // Or use strategies directly
 * const strategy = createSearchStrategy('ai_powered')
 * const queries = await strategy.generateQueries(context)
 * ```
 */

// Types
export type {
  SearchMode,
  SearchIntent,
  QueryGenerationResult,
  AutoSearchConfig,
  StrategyContext,
  KBSearchHit,
  MultiIntentSearchResult,
  ISearchQueryStrategy,
  IStrategyFactory,
} from './types'

// Factory
export {
  SearchStrategyFactory,
  getStrategyFactory,
  createSearchStrategy,
} from './factory'

// Service
export {
  performAutoKBSearch,
  storeAutoSearchResults,
} from './service'

// Strategies (for advanced usage)
export {
  BaseSearchQueryStrategy,
  SingleQueryStrategy,
  MultiIntentStrategy,
  AIPoweredStrategy,
} from './strategies'

