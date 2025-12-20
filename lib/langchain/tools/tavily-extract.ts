/**
 * Tavily Extract Tool
 * 
 * Content extraction tool using Tavily API for getting full page content
 * from URLs. Essential for retrieving complete job descriptions from
 * career pages and job boards.
 * 
 * Key features:
 * - Advanced extraction for complex pages
 * - Clean, structured content output
 * - Handles dynamic/JavaScript-rendered pages
 */

import { tool } from '@langchain/core/tools'
import { z } from 'zod'

// ============================================
// Tavily Extract Tool
// ============================================

const tavilyExtractSchema = z.object({
  urls: z.array(z.string()).describe(
    'URLs to extract content from. Maximum 5 URLs per request. ' +
    'Example: ["https://company.com/careers/job-123"]'
  ),
  extractDepth: z.enum(['basic', 'advanced']).optional().default('advanced').describe(
    'Extraction depth. Use "advanced" for complex pages with dynamic content or tables.'
  ),
})

/**
 * Extract full content from URLs using Tavily API
 * 
 * This tool is used by the research agent to:
 * - Get complete job descriptions from career pages
 * - Extract requirements, qualifications, and deadlines
 * - Retrieve structured content from job boards
 */
export const tavilyExtractTool = tool(
  async (input): Promise<string> => {
    const { urls, extractDepth } = input
    
    try {
      const apiKey = process.env.TAVILY_API_KEY
      if (!apiKey) {
        return JSON.stringify({
          success: false,
          error: 'TAVILY_API_KEY not configured',
          results: [],
        })
      }

      // Validate URLs
      if (!urls || urls.length === 0) {
        return JSON.stringify({
          success: false,
          error: 'No URLs provided for extraction',
          results: [],
        })
      }

      // Limit to 5 URLs per request (Tavily limit)
      const urlsToExtract = urls.slice(0, 5)
      
      console.log(`📄 [Tavily Extract] Extracting ${urlsToExtract.length} URL(s)`)
      urlsToExtract.forEach((url, i) => {
        console.log(`   ${i + 1}. ${url}`)
      })

      const response = await fetch('https://api.tavily.com/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          urls: urlsToExtract,
          extract_depth: extractDepth || 'advanced',
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ [Tavily Extract] API error: ${response.status}`)
        return JSON.stringify({
          success: false,
          error: `Tavily Extract API error: ${response.status} - ${errorText}`,
          results: [],
        })
      }

      const data = await response.json()

      // Process results - TRUNCATE to prevent rate limits
      const MAX_CONTENT_LENGTH = 15000 // ~4000 tokens
      
      const results = (data.results || []).map((r: {
        url: string
        raw_content?: string
        content?: string
      }) => {
        let content = r.raw_content || r.content || ''
        const originalLength = content.length
        
        // Truncate if too long
        if (content.length > MAX_CONTENT_LENGTH) {
          content = content.substring(0, MAX_CONTENT_LENGTH) + '\n\n[CONTENT TRUNCATED - original was ' + originalLength + ' chars]'
        }
        
        return {
          url: r.url,
          rawContent: content,
          contentLength: originalLength,
          truncated: originalLength > MAX_CONTENT_LENGTH,
          success: !!(r.raw_content || r.content),
        }
      })

      // Track failed URLs
      const failedUrls = urlsToExtract.filter(
        url => !results.find((r: { url: string }) => r.url === url)
      )

      console.log(`✅ [Tavily Extract] Extracted ${results.length} page(s)`)
      results.forEach((r: { url: string; contentLength: number }) => {
        console.log(`   - ${r.url}: ${r.contentLength} chars`)
      })
      if (failedUrls.length > 0) {
        console.log(`   ⚠️ Failed: ${failedUrls.join(', ')}`)
      }

      return JSON.stringify({
        success: true,
        extractedCount: results.length,
        failedCount: failedUrls.length,
        results,
        failedUrls,
      })
    } catch (error) {
      console.error(`❌ [Tavily Extract] Error:`, error)
      return JSON.stringify({
        success: false,
        error: `Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        results: [],
      })
    }
  },
  {
    name: 'tavily_extract',
    description: `Extract full page content from URLs. Use this after search to get complete job descriptions.

USE THIS TOOL TO:
- Get the full job description from a career page or job board
- Extract requirements, qualifications, and technologies
- Retrieve detailed content that wasn't in search snippets

BEST PRACTICES:
- Use after tavily_search or smart_job_search finds promising URLs
- Use extractDepth="advanced" for complex pages with tables or dynamic content
- Maximum 5 URLs per request
- Check rawContent for the full page text

EXAMPLE WORKFLOW:
1. Use smart_job_search to find career page URLs
2. Use tavily_extract on the best URL(s)
3. Analyze the rawContent to extract job details`,
    schema: tavilyExtractSchema,
  }
)

// ============================================
// Job Description Extractor Tool
// ============================================

const extractJobDescriptionSchema = z.object({
  url: z.string().describe('URL of the job posting to extract'),
  company: z.string().describe('Expected company name (for validation)'),
  position: z.string().describe('Expected position (for validation)'),
})

/**
 * Specialized tool for extracting and structuring job descriptions
 * 
 * This tool:
 * 1. Extracts the page content
 * 2. Identifies the job description section
 * 3. Extracts structured data (requirements, technologies, deadline)
 */
export const extractJobDescriptionTool = tool(
  async (input): Promise<string> => {
    const { url, company, position } = input
    
    try {
      const apiKey = process.env.TAVILY_API_KEY
      if (!apiKey) {
        return JSON.stringify({
          success: false,
          error: 'TAVILY_API_KEY not configured',
        })
      }

      console.log(`📋 [Extract Job Description] URL: ${url}`)
      console.log(`   Expected: ${position} at ${company}`)

      // Extract the page content
      const response = await fetch('https://api.tavily.com/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          urls: [url],
          extract_depth: 'advanced',
        }),
      })

      if (!response.ok) {
        return JSON.stringify({
          success: false,
          error: `Extraction failed: HTTP ${response.status}`,
        })
      }

      const data = await response.json()
      const result = data.results?.[0]

      if (!result || !result.raw_content) {
        return JSON.stringify({
          success: false,
          error: 'No content extracted from URL',
          url,
        })
      }

      let content = result.raw_content
      const originalLength = content.length
      const wasTruncated = originalLength > 15000
      
      // Truncate if too long to prevent rate limits
      const MAX_CONTENT_LENGTH = 15000
      if (wasTruncated) {
        content = content.substring(0, MAX_CONTENT_LENGTH) + `\n\n[CONTENT TRUNCATED - original ${originalLength} chars]`
      }

      // Basic content analysis
      const contentLower = content.toLowerCase()
      const hasCompanyMention = contentLower.includes(company.toLowerCase())
      const hasPositionMention = contentLower.includes(position.toLowerCase()) ||
        position.toLowerCase().split(' ').some(word => 
          word.length > 3 && contentLower.includes(word)
        )

      // Look for common job description patterns
      const hasRequirements = /requirements?|qualifications?|we.re looking for|vi søger|krav/i.test(content)
      const hasTechnologies = /technologies?|tech stack|tools?|erfaring med/i.test(content)
      const hasDeadline = /deadline|ansøgningsfrist|apply by|last day/i.test(content)
      const hasApplyButton = /apply now|søg stillingen|ansøg|send application/i.test(content)

      // Extract potential deadline (simple pattern matching)
      const deadlineMatch = content.match(
        /(?:deadline|ansøgningsfrist|apply by)[:\s]*([^.!\n]+)/i
      )

      console.log(`✅ [Extract Job Description] Content: ${content.length} chars`)
      console.log(`   Company match: ${hasCompanyMention}, Position match: ${hasPositionMention}`)
      console.log(`   Has requirements: ${hasRequirements}, Has technologies: ${hasTechnologies}`)

      return JSON.stringify({
        success: true,
        url,
        company,
        position,
        validation: {
          companyMentioned: hasCompanyMention,
          positionMentioned: hasPositionMention,
          looksLikeJobPosting: hasRequirements || hasApplyButton,
        },
        indicators: {
          hasRequirements,
          hasTechnologies,
          hasDeadline,
          hasApplyButton,
        },
        extractedDeadline: deadlineMatch?.[1]?.trim() || null,
        contentLength: content.length,
        contentPreview: content.substring(0, 1000) + (content.length > 1000 ? '...' : ''),
        fullContent: content,
      })
    } catch (error) {
      console.error(`❌ [Extract Job Description] Error:`, error)
      return JSON.stringify({
        success: false,
        error: `Job extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  },
  {
    name: 'extract_job_description',
    description: `Extract and analyze a job description from a URL. 

USE THIS TOOL WHEN:
- You've found a promising job posting URL
- You need to verify it matches the expected company/position
- You want structured analysis of the job content

THIS TOOL PROVIDES:
- Validation that the page matches expected company/position
- Detection of requirements, technologies, deadlines
- Full content for detailed analysis

Use the fullContent field to analyze requirements and technologies in detail.`,
    schema: extractJobDescriptionSchema,
  }
)

// ============================================
// Exports
// ============================================

export const extractTools = [
  tavilyExtractTool,
  extractJobDescriptionTool,
]

