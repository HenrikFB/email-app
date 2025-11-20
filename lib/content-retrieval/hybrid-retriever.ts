/**
 * Hybrid Retriever
 * Implements ContentRetriever for scrape_and_search strategy
 * Tries both Firecrawl scraping AND web search, merges results
 */

import { FirecrawlRetriever } from './firecrawl-retriever'
import { TavilyRetriever } from './tavily-retriever'
import type { ContentRetriever, ContentRetrievalResult, RetrievalContext } from './types'

export class HybridRetriever implements ContentRetriever {
  private firecrawl: FirecrawlRetriever
  private tavily: TavilyRetriever

  constructor() {
    this.firecrawl = new FirecrawlRetriever()
    this.tavily = new TavilyRetriever()
  }

  async retrieve(url: string, context?: RetrievalContext): Promise<ContentRetrievalResult> {
    console.log(`🔀 Hybrid retrieval for: ${url}`)

    // Run both in parallel for speed
    const [scrapedResult, searchResult] = await Promise.allSettled([
      this.firecrawl.retrieve(url, context),
      this.tavily.retrieve(url, context),
    ])

    const scraped = scrapedResult.status === 'fulfilled' ? scrapedResult.value : null
    const searched = searchResult.status === 'fulfilled' ? searchResult.value : null

    // If both failed, return error
    if (!scraped?.success && !searched?.success) {
      return {
        success: false,
        url,
        content: '',
        format: 'markdown',
        source: 'hybrid',
        metadata: {},
        error: 'Both scraping and search failed',
      }
    }

    // If only one succeeded, return that
    if (scraped?.success && !searched?.success) {
      return { ...scraped, source: 'hybrid' as const }
    }
    if (!scraped?.success && searched?.success) {
      return { ...searched, source: 'hybrid' as const }
    }

    // Both succeeded - merge results
    const mergedContent = this.mergeContent(scraped!, searched!)

    return {
      success: true,
      url: scraped!.url,  // Prefer scraped URL
      content: mergedContent,
      format: 'markdown',
      source: 'hybrid',
      metadata: {
        title: scraped!.metadata.title || searched!.metadata.title,
        originalUrl: url,
        confidence: searched!.metadata.confidence,
        searchQuery: searched!.metadata.searchQuery,
      },
    }
  }

  /**
   * Merge scraped and searched content intelligently
   * Prioritizes scraped content but includes search results for completeness
   */
  private mergeContent(
    scraped: ContentRetrievalResult,
    searched: ContentRetrievalResult
  ): string {
    const parts: string[] = []

    // Section 1: Scraped content (primary source)
    if (scraped.success && scraped.content) {
      parts.push(`# Content from ${scraped.url}\n\n${scraped.content}`)
    }

    // Section 2: Additional search results (supplementary)
    if (searched.success && searched.content) {
      parts.push(`\n\n---\n\n# Additional Information from Web Search\n\n${searched.content}`)
    }

    return parts.join('\n\n')
  }
}

