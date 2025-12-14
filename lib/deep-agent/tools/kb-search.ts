/**
 * Knowledge Base Search Tools
 * 
 * Tools for searching the user's knowledge base using hybrid search.
 */

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { LIMITS, MODEL_CONFIG, TEMPERATURE_CONFIG } from '../config'
import type { KBSearchResult, KBSearchQuery } from '../types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// ============================================
// Helper: Create Supabase Client
// ============================================

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!url || !key) {
    throw new Error('Supabase credentials not configured')
  }
  
  return createClient(url, key)
}

// ============================================
// Helper: Generate Embedding
// ============================================

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return response.data[0].embedding
}

// ============================================
// Search Knowledge Base Tool
// ============================================

const searchKBSchema = z.object({
  query: z.string().describe('The search query'),
  userId: z.string().describe('User ID for filtering'),
  knowledgeBaseIds: z.array(z.string()).describe('Knowledge base IDs to search'),
  limit: z.number().optional().default(5).describe('Maximum results to return'),
  minSimilarity: z.number().optional().default(0.25).describe('Minimum similarity threshold'),
})

/**
 * Search knowledge bases using hybrid (semantic + keyword) search
 */
export const searchKnowledgeBaseTool = tool(
  async ({ query, userId, knowledgeBaseIds, limit, minSimilarity }): Promise<string> => {
    try {
      const supabase = getSupabaseClient()

      // Generate embedding for semantic search
      const embedding = await generateEmbedding(query)

      // Call hybrid search RPC function
      const { data, error } = await supabase.rpc('hybrid_search_knowledge_base', {
        p_user_id: userId,
        p_query_text: query,
        p_query_embedding: embedding,
        p_kb_ids: knowledgeBaseIds,
        p_match_count: limit || LIMITS.maxResultsPerKBSearch,
        p_full_text_weight: 0.3,
        p_semantic_weight: 0.7,
        p_rrf_k: 60,
      })

      if (error) {
        throw new Error(`Search failed: ${error.message}`)
      }

      // Filter by minimum similarity
      const filteredResults = (data || []).filter(
        (r: any) => r.similarity >= (minSimilarity || LIMITS.minKBSimilarity)
      )

      const results: KBSearchResult[] = filteredResults.map((r: any) => ({
        documentId: r.document_id,
        documentTitle: r.document_title,
        knowledgeBaseId: r.knowledge_base_id,
        knowledgeBaseName: r.kb_name,
        chunkId: r.chunk_id,
        content: r.snippet || r.content?.substring(0, 500) || '',
        similarity: r.similarity,
        matchType: r.match_type || 'hybrid',
        sourceQuery: query,
      }))

      return JSON.stringify({
        success: true,
        query,
        resultCount: results.length,
        results,
      })
    } catch (error) {
      return JSON.stringify({
        success: false,
        query,
        error: `KB search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        results: [],
      })
    }
  },
  {
    name: 'search_knowledge_base',
    description: 'Search the user\'s knowledge base using hybrid (semantic + keyword) search',
    schema: searchKBSchema,
  }
)

// ============================================
// Multi-Intent KB Search Tool
// ============================================

const multiIntentSearchSchema = z.object({
  intents: z.array(z.object({
    query: z.string(),
    sourceField: z.string().optional(),
    sourceValue: z.string().optional(),
    reasoning: z.string(),
  })).describe('Array of search intents to execute'),
  userId: z.string().describe('User ID for filtering'),
  knowledgeBaseIds: z.array(z.string()).describe('Knowledge base IDs to search'),
  maxResultsPerIntent: z.number().optional().default(3).describe('Max results per intent'),
})

/**
 * Execute multiple KB searches based on different intents
 */
export const multiIntentKBSearchTool = tool(
  async ({ intents, userId, knowledgeBaseIds, maxResultsPerIntent }): Promise<string> => {
    try {
      const supabase = getSupabaseClient()

      // Limit number of intents
      const limitedIntents = intents.slice(0, LIMITS.maxKBSearchQueries)

      // Execute all searches in parallel
      const searchPromises = limitedIntents.map(async (intent) => {
        try {
          const embedding = await generateEmbedding(intent.query)

          const { data, error } = await supabase.rpc('hybrid_search_knowledge_base', {
            p_user_id: userId,
            p_query_text: intent.query,
            p_query_embedding: embedding,
            p_kb_ids: knowledgeBaseIds,
            p_match_count: maxResultsPerIntent || 3,
            p_full_text_weight: 0.3,
            p_semantic_weight: 0.7,
            p_rrf_k: 60,
          })

          if (error) {
            return { intent, results: [], error: error.message }
          }

          const results = (data || [])
            .filter((r: any) => r.similarity >= LIMITS.minKBSimilarity)
            .map((r: any) => ({
              documentId: r.document_id,
              documentTitle: r.document_title,
              knowledgeBaseId: r.knowledge_base_id,
              knowledgeBaseName: r.kb_name,
              chunkId: r.chunk_id,
              content: r.snippet || r.content?.substring(0, 500) || '',
              similarity: r.similarity,
              matchType: r.match_type || 'hybrid',
              sourceQuery: intent.query,
            }))

          return { intent, results }
        } catch (error) {
          return { 
            intent, 
            results: [], 
            error: error instanceof Error ? error.message : 'Unknown error' 
          }
        }
      })

      const searchResults = await Promise.all(searchPromises)

      // Combine and deduplicate by chunk ID
      const seenChunks = new Set<string>()
      const allResults: KBSearchResult[] = []

      for (const { results } of searchResults) {
        for (const result of results) {
          if (!seenChunks.has(result.chunkId)) {
            seenChunks.add(result.chunkId)
            allResults.push(result)
          }
        }
      }

      // Sort by similarity
      allResults.sort((a, b) => b.similarity - a.similarity)

      // Analyze coverage
      const fieldsWithResults = new Set<string>()
      const fieldsWithoutResults = new Set<string>()

      for (const { intent, results } of searchResults) {
        if (intent.sourceField) {
          if (results.length > 0) {
            fieldsWithResults.add(intent.sourceField)
          } else {
            fieldsWithoutResults.add(intent.sourceField)
          }
        }
      }

      return JSON.stringify({
        success: true,
        intentsExecuted: limitedIntents.length,
        totalResults: allResults.length,
        results: allResults,
        coverageAnalysis: {
          fieldsWithContent: Array.from(fieldsWithResults),
          fieldsWithoutContent: Array.from(fieldsWithoutResults).filter(f => !fieldsWithResults.has(f)),
          overallCoverage: fieldsWithResults.size / Math.max(1, fieldsWithResults.size + fieldsWithoutResults.size),
        },
        intentResults: searchResults.map(r => ({
          query: r.intent.query,
          field: r.intent.sourceField,
          resultCount: r.results.length,
          error: r.error,
        })),
      })
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Multi-intent search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        results: [],
      })
    }
  },
  {
    name: 'multi_intent_kb_search',
    description: 'Execute multiple KB searches with different intents (e.g., search for ".NET experience" AND "React projects" separately)',
    schema: multiIntentSearchSchema,
  }
)

// ============================================
// Generate KB Search Queries Tool
// ============================================

const generateSearchQueriesSchema = z.object({
  extractedData: z.record(z.string(), z.unknown()).describe('Extracted data from email analysis'),
  userIntent: z.string().optional().describe('User intent description'),
  maxQueries: z.number().optional().default(5).describe('Maximum queries to generate'),
})

/**
 * Use AI to generate optimal KB search queries from extracted data
 */
export const generateKBSearchQueriesTool = tool(
  async ({ extractedData, userIntent, maxQueries }): Promise<string> => {
    try {
      const systemPrompt = `You are a search query optimizer for a personal knowledge base containing cover letters, job applications, project descriptions, and professional documents.

Given extracted data from an email, generate ${maxQueries || 5} optimal search queries.

IMPORTANT:
- Generate SEPARATE queries for EACH major technology/skill
- Don't combine multiple technologies in one query
- Include context like role type when relevant
- Keep queries concise (5-50 characters)

Example: If data has technologies ["Python", "React", "AWS"], generate:
1. "Python backend development" (not "Python React AWS")
2. "React frontend projects"
3. "AWS cloud experience"

${userIntent ? `User's Intent: ${userIntent}` : ''}

OUTPUT FORMAT (JSON):
{
  "queries": [
    {
      "query": "Python backend development",
      "sourceField": "technologies",
      "sourceValue": "Python",
      "reasoning": "Search for Python experience to highlight in cover letter"
    }
  ]
}`

      const response = await openai.chat.completions.create({
        model: MODEL_CONFIG.kbResearcher,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate search queries for:\n${JSON.stringify(extractedData, null, 2)}` },
        ],
        response_format: { type: 'json_object' },
        temperature: TEMPERATURE_CONFIG.search,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('Empty response from LLM')
      }

      const parsed = JSON.parse(content) as { queries: KBSearchQuery[] }

      return JSON.stringify({
        success: true,
        queries: parsed.queries?.slice(0, maxQueries) || [],
      })
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Query generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        queries: [],
      })
    }
  },
  {
    name: 'generate_kb_search_queries',
    description: 'Generate optimal search queries for the knowledge base based on extracted email data',
    schema: generateSearchQueriesSchema,
  }
)

// ============================================
// Get Full Document Tool
// ============================================

const getDocumentSchema = z.object({
  documentId: z.string().describe('Document ID to retrieve'),
  userId: z.string().describe('User ID for authorization'),
})

/**
 * Get full document content from KB
 */
export const getKBDocumentTool = tool(
  async ({ documentId, userId }): Promise<string> => {
    try {
      const supabase = getSupabaseClient()

      const { data, error } = await supabase
        .from('kb_documents')
        .select('id, title, content, type, knowledge_base_id')
        .eq('id', documentId)
        .eq('user_id', userId)
        .single()

      if (error) {
        throw new Error(`Failed to fetch document: ${error.message}`)
      }

      return JSON.stringify({
        success: true,
        document: {
          id: data.id,
          title: data.title,
          content: data.content,
          type: data.type,
          knowledgeBaseId: data.knowledge_base_id,
        },
      })
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to get document: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  },
  {
    name: 'get_kb_document',
    description: 'Get the full content of a knowledge base document',
    schema: getDocumentSchema,
  }
)

// ============================================
// Export all KB search tools
// ============================================

export const kbSearchTools = [
  searchKnowledgeBaseTool,
  multiIntentKBSearchTool,
  generateKBSearchQueriesTool,
  getKBDocumentTool,
]

