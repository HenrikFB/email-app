/**
 * Firecrawl API client for web scraping
 * Uses stealth mode by default (auto retry)
 */

export interface FirecrawlScrapeOptions {
  url: string
  formats?: ('markdown' | 'html' | 'links')[]
  onlyMainContent?: boolean
  includeTags?: string[]
  excludeTags?: string[]
  timeout?: number
}

export interface FirecrawlScrapeResult {
  success: boolean
  markdown?: string
  html?: string
  metadata?: {
    title?: string
    description?: string
    language?: string
    ogImage?: string
  }
  links?: string[]
}

/**
 * Scrapes a URL using Firecrawl API
 * Automatically uses 'auto' proxy mode (retries with stealth if basic fails)
 * 
 * @param options - Scraping options
 * @returns Scraped content
 * @throws Error if scraping fails
 */
export async function scrapeUrl(
  options: FirecrawlScrapeOptions
): Promise<FirecrawlScrapeResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY

  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY is not set in environment variables')
  }

  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: options.url,
      formats: options.formats || ['markdown'],
      onlyMainContent: options.onlyMainContent ?? true,
      includeTags: options.includeTags,
      excludeTags: options.excludeTags,
      timeout: options.timeout || 30000,
      // Proxy defaults to 'auto' (uses stealth if basic fails)
      // This way we don't need to specify it explicitly
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = `Firecrawl scrape failed for ${options.url}: ${response.statusText}`
    
    try {
      const errorJson = JSON.parse(errorText)
      errorMessage = `Firecrawl scrape failed: ${errorJson.error || errorJson.message || errorText}`
    } catch {
      // If error is not JSON, use the text
      if (errorText) {
        errorMessage = `Firecrawl scrape failed: ${errorText}`
      }
    }
    
    throw new Error(errorMessage)
  }

  const data = await response.json()

  return {
    success: data.success ?? true,
    markdown: data.data?.markdown || data.markdown,
    html: data.data?.html || data.html,
    metadata: data.data?.metadata || data.metadata,
    links: data.data?.links || data.links,
  }
}

/**
 * Scrapes multiple URLs in parallel
 * Returns results with graceful error handling (failed scrapes are logged but don't stop others)
 * 
 * @param urls - Array of URLs to scrape
 * @param options - Scraping options (applied to all URLs)
 * @returns Array of successful scrape results
 */
export async function scrapeUrls(
  urls: string[],
  options: Omit<FirecrawlScrapeOptions, 'url'> = {}
): Promise<Array<FirecrawlScrapeResult & { url: string }>> {
  const results = await Promise.allSettled(
    urls.map((url) => scrapeUrl({ ...options, url }))
  )

  return results
    .map((result, index) => {
      if (result.status === 'fulfilled') {
        return { ...result.value, url: urls[index] }
      } else {
        console.error(`Failed to scrape ${urls[index]}:`, result.reason)
        return null
      }
    })
    .filter((result): result is FirecrawlScrapeResult & { url: string } => result !== null)
}

