/**
 * Tavily Retriever
 * Implements ContentRetriever interface for web search
 * Finds alternative public URLs when original is auth-required
 */

import { searchWithTavily, generateSearchQuery } from '@/lib/tavily/client'
import type { ContentRetriever, ContentRetrievalResult, RetrievalContext } from './types'

export class TavilyRetriever implements ContentRetriever {
  async retrieve(url: string, context?: RetrievalContext): Promise<ContentRetrievalResult> {
    console.log(`🔍 Tavily searching for content related to: ${url}`)

    try {
      // Generate search query from context
      const query = generateSearchQuery(
        context?.linkText || url,
        context?.emailSubject,
        context?.matchCriteria
      )

      console.log(`   Search query: "${query}"`)

      // Search with Tavily
      const searchResults = await searchWithTavily({
        query,
        searchDepth: 'basic',
        maxResults: 3,
        includeAnswer: false,
      })

      if (!searchResults.results || searchResults.results.length === 0) {
        return {
          success: false,
          url,
          content: '',
          format: 'text',
          source: 'tavily',
          metadata: {
            searchQuery: query,
          },
          error: 'No search results found',
        }
      }

      // Take the top result (highest score)
      const topResult = searchResults.results[0]

      // Combine top results into markdown content
      const combinedContent = searchResults.results
        .slice(0, 2)  // Take top 2 results
        .map((result, idx) => {
          return `## ${result.title}

**Source**: ${result.url}
**Relevance Score**: ${result.score}

${result.content}

---`
        })
        .join('\n\n')

      return {
        success: true,
        url: topResult.url,  // URL of best result found
        content: combinedContent,
        format: 'markdown',
        source: 'tavily',
        metadata: {
          title: topResult.title,
          originalUrl: url,  // Original URL that couldn't be scraped
          confidence: topResult.score,
          searchQuery: query,
        },
      }
    } catch (error) {
      console.error(`❌ Tavily search error:`, error)
      
      return {
        success: false,
        url,
        content: '',
        format: 'text',
        source: 'tavily',
        metadata: {},
        error: error instanceof Error ? error.message : 'Unknown search error',
      }
    }
  }
}

