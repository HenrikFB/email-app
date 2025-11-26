/**
 * Intelligent Discovery Retriever
 * 
 * Generic web discovery strategy:
 * 1. Extract context from link/email (job title, company, location, etc.)
 * 2. Search web for alternative public sources
 * 3. Find multiple URLs with same content
 * 4. Scrape the FOUND URLs (not the original)
 * 5. Let AI decide if content is useful (no hardcoding!)
 * 
 * Use cases:
 * - Expired LinkedIn tokens
 * - Auth-required content
 * - Paywalled articles
 * - Finding same job on multiple sites
 */

import { searchWithTavily } from '@/lib/tavily/client'
import { FirecrawlRetriever } from './firecrawl-retriever'
import type { ContentRetriever, ContentRetrievalResult, RetrievalContext } from './types'

export class IntelligentDiscoveryRetriever implements ContentRetriever {
  private firecrawl: FirecrawlRetriever

  constructor() {
    this.firecrawl = new FirecrawlRetriever()
  }

  async retrieve(url: string, context?: RetrievalContext): Promise<ContentRetrievalResult> {
    console.log(`🔍 Intelligent discovery for: ${url}`)

    // Step 1: Extract context intelligently
    const searchContext = this.extractSearchContext(url, context)
    console.log(`   Context: ${searchContext.query}`)

    // Step 2: Search web for alternative sources
    const searchResults = await searchWithTavily({
      query: searchContext.query,
      searchDepth: 'advanced', // More thorough for discovery
      maxResults: 5,
      excludeDomains: searchContext.excludeDomains, // Don't return original domain if auth-required
    })

    if (!searchResults.results || searchResults.results.length === 0) {
      return {
        success: false,
        url,
        content: '',
        format: 'markdown',
        source: 'intelligent_discovery',
        metadata: { searchQuery: searchContext.query },
        error: 'No alternative sources found',
      }
    }

    console.log(`   Found ${searchResults.results.length} alternative sources`)

    // Log Tavily search results to debug file
    if (context?.runId) {
      const { logDebugStep } = await import('@/lib/email-analysis/debug-logger')
      logDebugStep(context.runId, 4.1, 'tavily-search-results', {
        originalUrl: url,
        searchQuery: searchContext.query,
        excludeDomains: searchContext.excludeDomains,
        tavilyResults: searchResults.results.map(r => ({
          title: r.title,
          url: r.url,
          score: r.score,
          snippet: r.content, // Full snippet from Tavily
        })),
        totalResults: searchResults.results.length,
      })
    }

    // Step 3: Rank results by relevance to the search query
    // Use smart heuristics: URL path depth, title similarity, content preview
    const rankedResults = searchResults.results
      .map(result => {
        let score = result.score || 0 // Tavily's relevance score
        
        try {
          const resultUrl = new URL(result.url)
          
          // Penalize very generic URLs (homepage, search pages, listing pages)
          const pathDepth = resultUrl.pathname.split('/').filter(p => p.length > 0).length
          if (pathDepth === 0) score -= 2 // Homepage
          if (resultUrl.pathname.includes('/search') || resultUrl.pathname.includes('/jobs?')) score -= 3
          if (resultUrl.search.length > 50) score -= 2 // Long query string = search/filter page
          
          // Boost if URL path contains specific identifiers (e.g., job ID, company name from query)
          if (context?.linkText) {
            const linkWords = context.linkText.toLowerCase().split(/\s+/).filter(w => w.length > 3)
            const urlLower = result.url.toLowerCase()
            const matchingWords = linkWords.filter(word => urlLower.includes(word)).length
            score += matchingWords * 0.5
          }
          
        } catch {
          // Invalid URL, ignore scoring
        }
        
        return { ...result, relevanceScore: score }
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 3) // Top 3 most relevant

    console.log(`   🎯 Top sources (by relevance):`)
    rankedResults.forEach((r, i) => {
      const domain = new URL(r.url).hostname.replace('www.', '')
      console.log(`      ${i + 1}. ${domain} (score: ${r.relevanceScore.toFixed(1)})`)
    })

    // Step 4: Try scraping top results in parallel
    const scrapingPromises = rankedResults.map(result => 
      this.firecrawl.retrieve(result.url, context)
        .catch(err => ({
          success: false,
          url: result.url,
          content: result.content, // Fallback to snippet
          format: 'text' as const,
          source: 'intelligent_discovery' as const,
          metadata: { 
            title: result.title,
            searchSnippet: true,
            error: err.message 
          }
        }))
    )

    const scrapedResults = await Promise.allSettled(scrapingPromises)

    // Step 5: Find best result - prefer substantive content
    const bestResult = scrapedResults
      .map(r => r.status === 'fulfilled' ? r.value : null)
      .filter(r => r !== null)
      .find(r => {
        if (!r.success || !r.content) return false
        
        // Reasonable content bounds (not tiny snippet, not massive aggregator)
        const contentLength = r.content.length
        if (contentLength < 1000 || contentLength > 150000) {
          console.log(`   ⏭️  Skipping ${new URL(r.url).hostname}: ${contentLength} chars`)
          return false
        }
        
        return true
      })

    if (bestResult) {
      console.log(`   ✅ Scraped alternative: ${bestResult.url}`)
      return {
        ...bestResult,
        source: 'intelligent_discovery',
        metadata: {
          ...bestResult.metadata,
          originalUrl: url,
          discoveryMethod: 'web_search_then_scrape',
          searchQuery: searchContext.query,
        },
      }
    }

    // Step 6: Fallback - use search snippets if scraping failed
    console.log(`   ⚠️  All scraping attempts failed, using search snippets as fallback`)
    const combinedContent = rankedResults
      .map((result) => `## ${result.title}\n\n**Source**: ${result.url}\n\n${result.content}\n\n---`)
      .join('\n\n')

    return {
      success: true,
      url: rankedResults[0].url, // Best ranked URL
      content: combinedContent,
      format: 'markdown',
      source: 'intelligent_discovery',
      metadata: {
        originalUrl: url,
        discoveryMethod: 'web_search_snippets',
        searchQuery: searchContext.query,
        alternativeSources: rankedResults.map(r => r.url),
      },
    }
  }

  /**
   * Extract intelligent search context from URL and email context
   * GENERIC - no hardcoding, uses AI and context to guide search
   */
  private extractSearchContext(
    url: string, 
    context?: RetrievalContext
  ): { query: string; excludeDomains?: string[] } {
    const excludeDomains: string[] = []

    // Only exclude the ORIGINAL domain (if it's inaccessible, that's why we're searching)
    try {
      const urlObj = new URL(url)
      const domain = urlObj.hostname.replace('www.', '')
      excludeDomains.push(domain)
      console.log(`   🚫 Excluding original domain: ${domain}`)
    } catch {
      // Invalid URL, ignore
    }

    // Extract clean search query from link text ONLY
    // This contains the most specific info: "Software Developer BD Energy · Aarhus"
    let query = ''
    if (context?.linkText && context.linkText.length > 5) {
      // Minimal cleanup - preserve company name, job title, location
      const cleaned = context.linkText
        .replace(/\s+/g, ' ')
        .replace(/\d+\s+(tidlige medarbejdere|skole alumner|early employees|school alumni)/gi, '')
        .replace(/\(på arbejdesstedet\)|\(hybridarbejde\)|\(remote\)/gi, '')
        .replace(/vær den første.*til at ansøge/gi, '')
        .replace(/easy apply|view|see more|read more|apply now/gi, '')
        .replace(/·/g, ' ') // Convert separator to space
        .trim()
      
      if (cleaned.length > 5) {
        query = cleaned
      }
    }

    // Fallback: use email subject (less specific but better than nothing)
    if (!query && context?.emailSubject) {
      query = context.emailSubject
        .replace(/^(re|fwd|fw):\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim()
    }

    // Last resort fallback
    if (!query) {
      query = 'content'
    }

    // Limit length (Tavily has query limits)
    if (query.length > 250) {
      query = query.substring(0, 250).trim()
    }

    console.log(`   🔍 Search query: "${query}"`)
    console.log(`   🚫 Excluding: ${excludeDomains.join(', ') || 'none'}`)

    return { query, excludeDomains: excludeDomains.length > 0 ? excludeDomains : undefined }
  }
}

