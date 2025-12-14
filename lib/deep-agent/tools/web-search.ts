/**
 * Web Search Tools
 * 
 * Tools for searching the web using Tavily.
 */

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { LIMITS } from '../config'
import type { WebSearchResult, WebSearchQuery } from '../types'

// ============================================
// Tavily Search Tool
// ============================================

const tavilySearchSchema = z.object({
  query: z.string().describe('The search query'),
  maxResults: z.number().optional().default(5).describe('Maximum number of results'),
  searchDepth: z.enum(['basic', 'advanced']).optional().default('basic').describe('Search depth'),
  includeAnswer: z.boolean().optional().default(false).describe('Include AI-generated answer'),
})

/**
 * Search the web using Tavily API
 */
export const tavilySearchTool = tool(
  async ({ query, maxResults, searchDepth, includeAnswer }): Promise<string> => {
    try {
      const apiKey = process.env.TAVILY_API_KEY
      if (!apiKey) {
        throw new Error('TAVILY_API_KEY not configured')
      }

      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results: Math.min(maxResults || 5, LIMITS.maxWebSearchQueries),
          search_depth: searchDepth || 'basic',
          include_answer: includeAnswer || false,
          include_raw_content: false,
        }),
      })

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      const results: WebSearchResult[] = (data.results || []).map((r: any) => ({
        url: r.url,
        title: r.title,
        content: r.content || r.snippet || '',
        score: r.score || 0,
        publishedDate: r.published_date,
      }))

      return JSON.stringify({
        success: true,
        query,
        answer: data.answer || null,
        results,
        resultCount: results.length,
      })
    } catch (error) {
      return JSON.stringify({
        success: false,
        query,
        error: `Web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        results: [],
      })
    }
  },
  {
    name: 'tavily_search',
    description: 'Search the web for information using Tavily. Returns relevant URLs and content summaries.',
    schema: tavilySearchSchema,
  }
)

// ============================================
// Multi-Query Web Search Tool
// ============================================

const multiQuerySearchSchema = z.object({
  queries: z.array(z.object({
    query: z.string(),
    sourceEntity: z.string().optional(),
    priority: z.number().optional(),
  })).describe('Array of search queries to execute'),
  maxResultsPerQuery: z.number().optional().default(3).describe('Max results per query'),
})

/**
 * Execute multiple web searches in parallel
 */
export const multiQueryWebSearchTool = tool(
  async ({ queries, maxResultsPerQuery }): Promise<string> => {
    try {
      const apiKey = process.env.TAVILY_API_KEY
      if (!apiKey) {
        throw new Error('TAVILY_API_KEY not configured')
      }

      // Limit number of queries
      const limitedQueries = queries.slice(0, LIMITS.maxWebSearchQueries)

      // Execute all searches in parallel
      const searchPromises = limitedQueries.map(async (q) => {
        try {
          const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              api_key: apiKey,
              query: q.query,
              max_results: maxResultsPerQuery || 3,
              search_depth: 'basic',
              include_answer: false,
              include_raw_content: false,
            }),
          })

          if (!response.ok) {
            return { query: q, results: [], error: `HTTP ${response.status}` }
          }

          const data = await response.json()
          return {
            query: q,
            results: (data.results || []).map((r: any) => ({
              url: r.url,
              title: r.title,
              content: r.content || r.snippet || '',
              score: r.score || 0,
            })),
          }
        } catch (error) {
          return { query: q, results: [], error: error instanceof Error ? error.message : 'Unknown error' }
        }
      })

      const searchResults = await Promise.all(searchPromises)

      // Deduplicate results by URL
      const seenUrls = new Set<string>()
      const allResults: WebSearchResult[] = []

      for (const { query, results } of searchResults) {
        for (const result of results) {
          if (!seenUrls.has(result.url)) {
            seenUrls.add(result.url)
            allResults.push(result)
          }
        }
      }

      // Sort by score
      allResults.sort((a, b) => (b.score || 0) - (a.score || 0))

      return JSON.stringify({
        success: true,
        queriesExecuted: limitedQueries.length,
        totalResults: allResults.length,
        results: allResults,
        queryResults: searchResults.map(r => ({
          query: r.query.query,
          resultCount: r.results.length,
          error: r.error,
        })),
      })
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Multi-query search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        results: [],
      })
    }
  },
  {
    name: 'multi_query_web_search',
    description: 'Execute multiple web searches in parallel for comprehensive research',
    schema: multiQuerySearchSchema,
  }
)

// ============================================
// Company Research Tool
// ============================================

const companyResearchSchema = z.object({
  companyName: z.string().describe('Name of the company to research'),
  additionalContext: z.string().optional().describe('Additional context like job title or location'),
})

/**
 * Research a specific company - find careers page, about, etc.
 */
export const companyResearchTool = tool(
  async ({ companyName, additionalContext }): Promise<string> => {
    try {
      const apiKey = process.env.TAVILY_API_KEY
      if (!apiKey) {
        throw new Error('TAVILY_API_KEY not configured')
      }

      // Build targeted queries
      const queries = [
        `${companyName} careers jobs`,
        `${companyName} company about`,
      ]

      if (additionalContext) {
        queries.push(`${companyName} ${additionalContext}`)
      }

      // Execute searches
      const searchPromises = queries.map(async (query) => {
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            api_key: apiKey,
            query,
            max_results: 3,
            search_depth: 'basic',
            include_answer: false,
          }),
        })

        if (!response.ok) {
          return { query, results: [] }
        }

        const data = await response.json()
        return {
          query,
          results: data.results || [],
        }
      })

      const searchResults = await Promise.all(searchPromises)

      // Combine and deduplicate
      const seenUrls = new Set<string>()
      const allResults: WebSearchResult[] = []

      for (const { results } of searchResults) {
        for (const r of results) {
          if (!seenUrls.has(r.url)) {
            seenUrls.add(r.url)
            allResults.push({
              url: r.url,
              title: r.title,
              content: r.content || r.snippet || '',
              score: r.score || 0,
            })
          }
        }
      }

      // Identify key URLs
      const careersUrl = allResults.find(r => 
        r.url.includes('/careers') || 
        r.url.includes('/jobs') || 
        r.title.toLowerCase().includes('career')
      )

      const aboutUrl = allResults.find(r =>
        r.url.includes('/about') ||
        r.title.toLowerCase().includes('about')
      )

      return JSON.stringify({
        success: true,
        companyName,
        careersUrl: careersUrl?.url || null,
        aboutUrl: aboutUrl?.url || null,
        results: allResults.slice(0, 5),
        summary: `Found ${allResults.length} results for ${companyName}. ${careersUrl ? 'Careers page found.' : 'No careers page found.'} ${aboutUrl ? 'About page found.' : ''}`,
      })
    } catch (error) {
      return JSON.stringify({
        success: false,
        companyName,
        error: `Company research failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  },
  {
    name: 'research_company',
    description: 'Research a specific company to find their careers page, about page, and relevant information',
    schema: companyResearchSchema,
  }
)

// ============================================
// Export all web search tools
// ============================================

export const webSearchTools = [
  tavilySearchTool,
  multiQueryWebSearchTool,
  companyResearchTool,
]

