/**
 * Search Query Strategy Factory
 * 
 * Factory pattern implementation for creating search query strategies.
 * Allows easy extension with new strategies without modifying existing code.
 */

import type { ISearchQueryStrategy, IStrategyFactory, SearchMode } from './types'
import {
  SingleQueryStrategy,
  MultiIntentStrategy,
  AIPoweredStrategy,
} from './strategies'

/**
 * Registry of available strategies
 * Add new strategies here to make them available
 */
const strategyRegistry: Record<SearchMode, new () => ISearchQueryStrategy> = {
  single: SingleQueryStrategy,
  multi_intent: MultiIntentStrategy,
  ai_powered: AIPoweredStrategy,
}

/**
 * Factory for creating search query strategies
 * 
 * Usage:
 * ```typescript
 * const factory = new SearchStrategyFactory()
 * const strategy = factory.createStrategy('multi_intent')
 * const result = await strategy.generateQueries(context)
 * ```
 */
export class SearchStrategyFactory implements IStrategyFactory {
  /**
   * Create a strategy instance based on mode
   * @param mode - The search mode
   * @returns Strategy instance
   * @throws Error if mode is not supported
   */
  createStrategy(mode: SearchMode): ISearchQueryStrategy {
    const StrategyClass = strategyRegistry[mode]

    if (!StrategyClass) {
      console.warn(`Unknown search mode: ${mode}, falling back to 'single'`)
      return new SingleQueryStrategy()
    }

    return new StrategyClass()
  }

  /**
   * Get all available strategy modes
   */
  getAvailableStrategies(): SearchMode[] {
    return Object.keys(strategyRegistry) as SearchMode[]
  }

  /**
   * Check if a mode is supported
   */
  isSupported(mode: string): mode is SearchMode {
    return mode in strategyRegistry
  }
}

/**
 * Singleton instance for convenience
 */
let factoryInstance: SearchStrategyFactory | null = null

/**
 * Get the singleton factory instance
 */
export function getStrategyFactory(): SearchStrategyFactory {
  if (!factoryInstance) {
    factoryInstance = new SearchStrategyFactory()
  }
  return factoryInstance
}

/**
 * Convenience function to create a strategy directly
 */
export function createSearchStrategy(mode: SearchMode): ISearchQueryStrategy {
  return getStrategyFactory().createStrategy(mode)
}

