/**
 * Tavily Search Tool
 * 
 * Web search tool using Tavily API for finding job listings,
 * company pages, and other relevant information.
 * 
 * Key features:
 * - Advanced search depth for comprehensive results
 * - Raw content included for detailed analysis
 * - AI-generated answer for quick summaries
 */

import { tool } from '@langchain/core/tools'
import { z } from 'zod'

// ============================================
// Tavily Search Tool
// ============================================

const tavilySearchSchema = z.object({
  query: z.string().describe(
    'The search query. Be specific - include company name, job title, and location. ' +
    'Example: "BD Energy Software Developer careers Aarhus"'
  ),
  maxResults: z.number().optional().default(10).describe(
    'Maximum number of results to return (1-20). Default 10.'
  ),
  searchDepth: z.enum(['basic', 'advanced']).optional().default('advanced').describe(
    'Search depth. Use "advanced" for comprehensive job research.'
  ),
  includeAnswer: z.boolean().optional().default(true).describe(
    'Include AI-generated answer summarizing the results.'
  ),
  topic: z.enum(['general', 'news']).optional().default('general').describe(
    'Topic category. Use "general" for job searches.'
  ),
  excludeDomains: z.array(z.string()).optional().describe(
    'Domains to exclude from results. E.g., ["linkedin.com"] if those require auth.'
  ),
})

/**
 * Search the web using Tavily API
 * 
 * This tool is used by the research agent to find:
 * - Public job listings
 * - Company career pages
 * - Alternative sources when LinkedIn is blocked
 */
export const tavilySearchTool = tool(
  async (input): Promise<string> => {
    const { query, maxResults, searchDepth, includeAnswer, topic, excludeDomains } = input
    
    try {
      const apiKey = process.env.TAVILY_API_KEY
      if (!apiKey) {
        return JSON.stringify({
          success: false,
          error: 'TAVILY_API_KEY not configured',
          results: [],
        })
      }

      console.log(`🔍 [Tavily Search] Query: "${query}"`)
      console.log(`   Depth: ${searchDepth}, Max: ${maxResults}`)

      const requestBody: Record<string, unknown> = {
        api_key: apiKey,
        query,
        max_results: Math.min(maxResults || 10, 20),
        search_depth: searchDepth || 'advanced',
        include_answer: includeAnswer ?? true,
        include_raw_content: true, // Important for detailed analysis
        topic: topic || 'general',
      }

      // Add exclude domains if provided
      if (excludeDomains && excludeDomains.length > 0) {
        requestBody.exclude_domains = excludeDomains
      }

      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ [Tavily Search] API error: ${response.status}`)
        return JSON.stringify({
          success: false,
          error: `Tavily API error: ${response.status} - ${errorText}`,
          results: [],
        })
      }

      const data = await response.json()

      // Transform results
      const results = (data.results || []).map((r: {
        url: string
        title: string
        content?: string
        snippet?: string
        score?: number
        published_date?: string
        raw_content?: string
      }) => ({
        url: r.url,
        title: r.title,
        content: r.content || r.snippet || '',
        score: r.score || 0,
        publishedDate: r.published_date,
        rawContent: r.raw_content || null,
        // Identify source type
        sourceType: identifySourceType(r.url),
      }))

      console.log(`✅ [Tavily Search] Found ${results.length} results`)
      if (data.answer) {
        console.log(`   AI Answer: ${data.answer.substring(0, 100)}...`)
      }

      return JSON.stringify({
        success: true,
        query,
        answer: data.answer || null,
        results,
        resultCount: results.length,
        responseTime: data.response_time || 0,
      })
    } catch (error) {
      console.error(`❌ [Tavily Search] Error:`, error)
      return JSON.stringify({
        success: false,
        error: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        results: [],
      })
    }
  },
  {
    name: 'tavily_search',
    description: `Search the web for job listings, company pages, and career information.

USE THIS TOOL TO:
- Find public job listings when LinkedIn URLs require authentication
- Discover company career pages
- Research companies mentioned in emails
- Find alternative sources for job descriptions

TIPS:
- Be specific with queries: include company name, position, and location
- Use excludeDomains to skip sites that require login (e.g., linkedin.com)
- The "answer" field provides an AI summary of results
- rawContent contains full page text for detailed analysis

EXAMPLE QUERIES:
- "BD Energy Software Developer careers Aarhus"
- "Company X jobs .NET developer Copenhagen"
- "Jobindex Python developer position"`,
    schema: tavilySearchSchema,
  }
)

// ============================================
// Smart Job Search Tool
// ============================================

const smartJobSearchSchema = z.object({
  company: z.string().describe('Company name to search for'),
  position: z.string().describe('Job position/title'),
  location: z.string().optional().describe('Job location (city, country, or remote)'),
  originalUrl: z.string().optional().describe('Original URL from email that might be blocked'),
})

/**
 * Smart job search that tries multiple strategies
 * 
 * This tool:
 * 1. Searches for the job on the company's career page
 * 2. Searches on job boards (Jobindex, etc.)
 * 3. Filters out blocked domains (LinkedIn)
 * 4. Returns the best matches
 */
export const smartJobSearchTool = tool(
  async (input): Promise<string> => {
    const { company, position, location, originalUrl } = input
    
    try {
      const apiKey = process.env.TAVILY_API_KEY
      if (!apiKey) {
        return JSON.stringify({
          success: false,
          error: 'TAVILY_API_KEY not configured',
        })
      }

      console.log(`🎯 [Smart Job Search] Company: ${company}, Position: ${position}`)

      // Build search strategies
      const queries = [
        // Strategy 1: Company careers
        `${company} careers ${position} ${location || ''}`.trim(),
        // Strategy 2: Job boards
        `"${position}" "${company}" site:jobindex.dk`,
        // Strategy 3: Direct search
        `${company} ${position} job description requirements`,
      ]

      // Execute searches in parallel
      const searchPromises = queries.map(async (query, index) => {
        try {
          const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: apiKey,
              query,
              max_results: 5,
              search_depth: 'advanced',
              include_answer: false,
              include_raw_content: true,
              exclude_domains: ['linkedin.com'], // Skip LinkedIn - needs auth
            }),
          })

          if (!response.ok) {
            return { strategy: index, query, results: [], error: `HTTP ${response.status}` }
          }

          const data = await response.json()
          return {
            strategy: index,
            query,
            results: (data.results || []).map((r: {
              url: string
              title: string
              content?: string
              score?: number
              raw_content?: string
            }) => ({
              url: r.url,
              title: r.title,
              content: r.content || '',
              score: r.score || 0,
              rawContent: r.raw_content || null,
              sourceType: identifySourceType(r.url),
            })),
          }
        } catch (error) {
          return { strategy: index, query, results: [], error: String(error) }
        }
      })

      const searchResults = await Promise.all(searchPromises)

      // Combine and deduplicate by URL
      const seenUrls = new Set<string>()
      const allResults: Array<{
        url: string
        title: string
        content: string
        score: number
        rawContent: string | null
        sourceType: string
        strategy: number
      }> = []

      for (const { strategy, results } of searchResults) {
        for (const result of results) {
          if (!seenUrls.has(result.url)) {
            seenUrls.add(result.url)
            allResults.push({ ...result, strategy })
          }
        }
      }

      // Sort by score
      allResults.sort((a, b) => (b.score || 0) - (a.score || 0))

      // Identify best sources
      const careerPages = allResults.filter(r => r.sourceType === 'career_page')
      const jobBoards = allResults.filter(r => r.sourceType === 'job_board')

      console.log(`✅ [Smart Job Search] Found ${allResults.length} unique results`)
      console.log(`   Career pages: ${careerPages.length}, Job boards: ${jobBoards.length}`)

      return JSON.stringify({
        success: true,
        company,
        position,
        location: location || null,
        originalUrlBlocked: originalUrl?.includes('linkedin.com') || false,
        totalResults: allResults.length,
        careerPagesFound: careerPages.length,
        jobBoardsFound: jobBoards.length,
        bestResults: allResults.slice(0, 5),
        strategiesUsed: queries,
        recommendation: careerPages.length > 0 
          ? `Found ${careerPages.length} company career page(s). Try extracting content from: ${careerPages[0]?.url}`
          : jobBoards.length > 0
            ? `Found ${jobBoards.length} job board listing(s). Try extracting: ${jobBoards[0]?.url}`
            : 'No direct career pages or job boards found. Try extracting from top results.',
      })
    } catch (error) {
      console.error(`❌ [Smart Job Search] Error:`, error)
      return JSON.stringify({
        success: false,
        error: `Smart job search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  },
  {
    name: 'smart_job_search',
    description: `Intelligent job search that tries multiple strategies to find public job listings.

USE THIS WHEN:
- You have a company name and position from an email
- The original URL (e.g., LinkedIn) requires authentication
- You need to find the job description on a public source

THIS TOOL WILL:
1. Search for the company's career page
2. Search on job boards (Jobindex, etc.)
3. Automatically skip LinkedIn (requires auth)
4. Return the best matches with recommendations

After using this tool, use tavily_extract on promising URLs to get full job descriptions.`,
    schema: smartJobSearchSchema,
  }
)

// ============================================
// Helper Functions
// ============================================

/**
 * Identify the type of source from URL
 */
function identifySourceType(url: string): string {
  const urlLower = url.toLowerCase()
  
  // Career pages
  if (urlLower.includes('/careers') || 
      urlLower.includes('/jobs') || 
      urlLower.includes('/career') ||
      urlLower.includes('/job') ||
      urlLower.includes('/vacancies') ||
      urlLower.includes('/positions') ||
      urlLower.includes('/arbejde') ||
      urlLower.includes('/stillinger')) {
    return 'career_page'
  }
  
  // Job boards
  const jobBoards = [
    'jobindex.dk', 'linkedin.com', 'indeed.com', 'glassdoor.com',
    'monster.dk', 'stepstone.dk', 'jobnet.dk', 'ofir.dk',
    'karriere.dk', 'it-jobbank.dk'
  ]
  if (jobBoards.some(board => urlLower.includes(board))) {
    return 'job_board'
  }
  
  // Company pages
  if (urlLower.includes('/about') || 
      urlLower.includes('/company') ||
      urlLower.includes('/om-os')) {
    return 'company_page'
  }
  
  return 'other'
}

// ============================================
// Exports
// ============================================

export const searchTools = [
  tavilySearchTool,
  smartJobSearchTool,
]

