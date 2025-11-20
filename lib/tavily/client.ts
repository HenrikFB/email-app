/**
 * Tavily API Client
 * AI-optimized web search for finding alternative public URLs and content
 */

export interface TavilySearchOptions {
  query: string
  searchDepth?: 'basic' | 'advanced'  // basic is faster/cheaper, advanced is more thorough
  maxResults?: number
  includeAnswer?: boolean
  includeImages?: boolean
  includeDomains?: string[]  // Whitelist domains
  excludeDomains?: string[]  // Blacklist domains
}

export interface TavilySearchResult {
  title: string
  url: string
  content: string
  score: number
  publishedDate?: string
}

export interface TavilyResponse {
  query: string
  answer?: string
  results: TavilySearchResult[]
  images?: string[]
  responseTime: number
}

/**
 * Search with Tavily API
 * @param options - Search options
 * @returns Search results with content
 */
export async function searchWithTavily(
  options: TavilySearchOptions
): Promise<TavilyResponse> {
  const apiKey = process.env.TAVILY_API_KEY

  if (!apiKey) {
    throw new Error('TAVILY_API_KEY is not set in environment variables')
  }

  console.log(`🔍 Tavily search: "${options.query}"`)

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: options.query,
        search_depth: options.searchDepth || 'basic',
        max_results: options.maxResults || 5,
        include_answer: options.includeAnswer ?? false,
        include_images: options.includeImages ?? false,
        include_domains: options.includeDomains,
        exclude_domains: options.excludeDomains,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Tavily search failed: ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()

    console.log(`✅ Tavily found ${data.results?.length || 0} results`)

    return {
      query: data.query || options.query,
      answer: data.answer,
      results: data.results || [],
      images: data.images,
      responseTime: data.response_time || 0,
    }
  } catch (error) {
    console.error('❌ Tavily search error:', error)
    throw error
  }
}

/**
 * Generate a search query from link context
 * @param linkText - Text of the link
 * @param emailSubject - Email subject for context
 * @param additionalContext - Additional context from email
 * @returns Optimized search query
 */
export function generateSearchQuery(
  linkText: string,
  emailSubject?: string,
  additionalContext?: string
): string {
  // Clean up link text (remove generic words)
  const genericWords = ['click here', 'read more', 'view', 'see', 'apply', 'learn more', 'details']
  let cleanedLinkText = linkText.toLowerCase()
  
  genericWords.forEach(word => {
    cleanedLinkText = cleanedLinkText.replace(word, '')
  })
  
  cleanedLinkText = cleanedLinkText.trim()
  
  // Build query from available context
  const parts: string[] = []
  
  if (cleanedLinkText && cleanedLinkText.length > 5) {
    parts.push(cleanedLinkText)
  }
  
  if (emailSubject) {
    // Extract meaningful parts from subject (remove "fwd:", "re:", etc.)
    const cleanSubject = emailSubject
      .replace(/^(re|fwd|fw):\s*/i, '')
      .trim()
    if (cleanSubject.length > 10) {
      parts.push(cleanSubject)
    }
  }
  
  if (additionalContext && additionalContext.length > 10) {
    // Extract key terms (first 100 chars)
    parts.push(additionalContext.substring(0, 100))
  }
  
  // Combine and clean up
  let query = parts.join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  
  // Limit query length (Tavily recommends < 400 chars)
  if (query.length > 300) {
    query = query.substring(0, 300)
  }
  
  return query
}

