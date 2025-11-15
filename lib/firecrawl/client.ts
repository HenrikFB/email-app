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
  waitFor?: number  // Wait time in ms for redirects/JS (e.g., 3000)
  maxRetries?: number  // Number of retry attempts (default: 3)
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
 * Scrapes a single URL (internal function, use scrapeWithRetry for production)
 */
async function scrapeUrlOnce(
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
      timeout: options.timeout || 45000,  // Increased from 30s to 45s
      waitFor: options.waitFor || 3000,   // Wait 3 seconds by default for redirects/JS
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = `Firecrawl scrape failed for ${options.url}: ${response.statusText}`
    
    try {
      const errorJson = JSON.parse(errorText)
      errorMessage = `Firecrawl scrape failed: ${errorJson.error || errorJson.message || errorText}`
    } catch {
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
 * Scrapes a URL with automatic retry on failure
 * Implements exponential backoff: 2s, 4s, 6s between retries
 * 
 * @param options - Scraping options (url, formats, etc.)
 * @returns Scraped content
 * @throws Error if all retry attempts fail
 */
export async function scrapeUrl(
  options: FirecrawlScrapeOptions
): Promise<FirecrawlScrapeResult> {
  const maxRetries = options.maxRetries ?? 3
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🌐 [${attempt}/${maxRetries}] Scraping: ${options.url}`)
      const result = await scrapeUrlOnce(options)
      console.log(`✅ Successfully scraped: ${options.url}`)
      return result
    } catch (error) {
      lastError = error as Error
      console.log(`⚠️  Attempt ${attempt}/${maxRetries} failed: ${lastError.message}`)
      
      if (attempt < maxRetries) {
        const delay = 2000 * attempt // Exponential backoff: 2s, 4s, 6s
        console.log(`⏳ Waiting ${delay}ms before retry...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  console.log(`❌ Failed to scrape ${options.url} after ${maxRetries} attempts`)
  throw lastError || new Error(`Failed to scrape after ${maxRetries} attempts`)
}

/**
 * Scrapes multiple URLs in parallel with retry logic
 * Returns results with graceful error handling (failed scrapes are logged but don't stop others)
 * 
 * @param urls - Array of URLs to scrape
 * @param options - Scraping options (applied to all URLs)
 * @returns Array of successful scrape results with attempt tracking
 */
export async function scrapeUrls(
  urls: string[],
  options: Omit<FirecrawlScrapeOptions, 'url'> = {}
): Promise<Array<FirecrawlScrapeResult & { url: string }>> {
  console.log(`\n🌐 Starting batch scrape of ${urls.length} URLs...`)
  
  const results = await Promise.allSettled(
    urls.map((url) => scrapeUrl({ ...options, url }))
  )

  const successful = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length
  
  console.log(`\n📊 Batch scrape complete: ${successful} successful, ${failed} failed`)

  return results
    .map((result, index) => {
      if (result.status === 'fulfilled') {
        return { ...result.value, url: urls[index] }
      } else {
        console.error(`❌ Final failure for ${urls[index]}:`, result.reason.message)
        return null
      }
    })
    .filter((result): result is FirecrawlScrapeResult & { url: string } => result !== null)
}

