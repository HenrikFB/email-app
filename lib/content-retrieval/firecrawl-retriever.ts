/**
 * Firecrawl Retriever
 * Implements ContentRetriever interface for Firecrawl scraping
 */

import { scrapeUrl, type FirecrawlScrapeOptions } from '@/lib/firecrawl/client'
import type { ContentRetriever, ContentRetrievalResult, RetrievalContext } from './types'

export class FirecrawlRetriever implements ContentRetriever {
  async retrieve(url: string, context?: RetrievalContext): Promise<ContentRetrievalResult> {
    console.log(`🌐 Firecrawl scraping: ${url}`)

    try {
      const options: FirecrawlScrapeOptions = {
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 3000,
        maxRetries: 3,
      }

      const result = await scrapeUrl(options)

      if (!result.success || !result.markdown) {
        return {
          success: false,
          url,
          content: '',
          format: 'markdown',
          source: 'firecrawl',
          metadata: {
            title: result.metadata?.title,
          },
          error: 'Scraping failed or returned no content',
        }
      }

      // Firecrawl might return the actual URL after following redirects
      const actualUrl = result.metadata?.url || result.metadata?.sourceURL || url

      return {
        success: true,
        url: actualUrl,  // The actual URL after redirects
        content: result.markdown,
        format: 'markdown',
        source: 'firecrawl',
        metadata: {
          title: result.metadata?.title,
          originalUrl: url,  // Keep the SafeLinks URL as originalUrl
          actualUrl: actualUrl,  // The real URL after redirect
        },
      }
    } catch (error) {
      console.error(`❌ Firecrawl error for ${url}:`, error)
      
      return {
        success: false,
        url,
        content: '',
        format: 'markdown',
        source: 'firecrawl',
        metadata: {},
        error: error instanceof Error ? error.message : 'Unknown scraping error',
      }
    }
  }
}

