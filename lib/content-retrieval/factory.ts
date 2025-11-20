/**
 * Content Retrieval Factory
 * Creates appropriate retriever based on strategy
 */

import { FirecrawlRetriever } from './firecrawl-retriever'
import { TavilyRetriever } from './tavily-retriever'
import { HybridRetriever } from './hybrid-retriever'
import type { ContentRetriever, ContentRetrievalStrategy } from './types'

/**
 * Create a content retriever based on strategy
 * @param strategy - Content retrieval strategy
 * @returns ContentRetriever instance
 */
export function createContentRetriever(
  strategy: ContentRetrievalStrategy = 'scrape_only'
): ContentRetriever {
  console.log(`📦 Creating content retriever: ${strategy}`)

  switch (strategy) {
    case 'scrape_only':
      return new FirecrawlRetriever()
    
    case 'search_only':
      return new TavilyRetriever()
    
    case 'scrape_and_search':
      return new HybridRetriever()
    
    default:
      console.warn(`Unknown strategy "${strategy}", defaulting to scrape_only`)
      return new FirecrawlRetriever()
  }
}

