/**
 * Auto Search Service
 * 
 * Main service for performing automatic KB searches when emails match.
 * Uses Strategy Pattern for flexible query generation.
 */

import { createClient } from '@/lib/supabase/server'
import { searchKnowledgeBases } from '@/lib/embeddings/service'
import { getAssignedKBs } from '@/app/dashboard/knowledge-base/actions'
import { createSearchStrategy } from './factory'
import type {
  AutoSearchConfig,
  StrategyContext,
  MultiIntentSearchResult,
  KBSearchHit,
  SearchIntent,
} from './types'

// ============================================
// Types
// ============================================

interface AutoSearchResponse {
  searchResults?: MultiIntentSearchResult
  autoSavedToKB?: string
  error?: string
}

// ============================================
// Main Service
// ============================================

/**
 * Perform automatic KB search when email matches
 * Uses the configured strategy to generate queries
 */
export async function performAutoKBSearch(
  config: AutoSearchConfig
): Promise<AutoSearchResponse> {
  const startTime = Date.now()
  
  console.log('\n' + '═'.repeat(60))
  console.log('🔄 AUTO KB SEARCH - Multi-Intent')
  console.log('═'.repeat(60))
  console.log(`   Mode: ${config.searchMode}`)
  console.log(`   Max Queries: ${config.maxQueries}`)

  const response: AutoSearchResponse = {}

  try {
    // Skip if disabled
    if (!config.autoSearchEnabled) {
      console.log('   ⏭️ Auto KB search is disabled')
      return response
    }

    // Get assigned KBs
    const kbResult = await getAssignedKBs(config.agentConfigId)
    const assignedKBIds = kbResult.success ? (kbResult.data || []) : []

    if (assignedKBIds.length === 0) {
      console.log('   ⏭️ No KBs assigned to this agent')
      return response
    }

    console.log(`   📚 Searching ${assignedKBIds.length} assigned KB(s)`)

    // Create strategy based on mode
    const strategy = createSearchStrategy(config.searchMode)

    // Build strategy context
    const strategyContext: StrategyContext = {
      extractedData: config.extractedData,
      userIntent: config.userIntent,
      extractionFields: config.extractionFields,
      searchInstructions: config.searchInstructions,
      queryTemplate: config.queryTemplate,
      splitFields: config.splitFields,
      maxQueries: config.maxQueries,
    }

    // Generate search queries
    const queryResult = await strategy.generateQueries(strategyContext)

    if (queryResult.error) {
      console.log(`   ⚠️ Query generation error: ${queryResult.error}`)
      return { error: queryResult.error }
    }

    if (queryResult.intents.length === 0) {
      console.log('   ⚠️ No search queries generated')
      return response
    }

    console.log(`   📝 Generated ${queryResult.intents.length} search queries`)

    // Execute searches in parallel
    const searchResults = await executeParallelSearches(
      queryResult.intents,
      config.userId,
      assignedKBIds
    )

    // Build response
    const processingTimeMs = Date.now() - startTime

    response.searchResults = {
      searchPerformedAt: new Date().toISOString(),
      searchMode: config.searchMode,
      queries: queryResult.intents.map((intent) => ({
        query: intent.query,
        sourceField: intent.sourceField,
        resultCount: 0, // Will be updated below
      })),
      results: searchResults,
      totalResults: searchResults.length,
      processingTimeMs,
    }

    console.log(`   ✅ Found ${searchResults.length} unique results`)

    // Check auto-save conditions
    if (
      config.autoSaveKBId &&
      config.confidence >= (config.autoSaveThreshold || 0.8)
    ) {
      console.log(
        `   📤 Confidence ${(config.confidence * 100).toFixed(0)}% meets threshold`
      )
      response.autoSavedToKB = config.autoSaveKBId
    }

    console.log('═'.repeat(60))
    console.log(`✅ AUTO KB SEARCH COMPLETE (${processingTimeMs}ms)`)
    console.log('═'.repeat(60) + '\n')

    return response
  } catch (error) {
    console.error('❌ Auto KB search error:', error)
    return { error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ============================================
// Search Execution
// ============================================

/**
 * Execute multiple searches in parallel and combine results
 */
async function executeParallelSearches(
  intents: SearchIntent[],
  userId: string,
  kbIds: string[]
): Promise<KBSearchHit[]> {
  console.log('\n   🔍 Executing parallel searches...')

  // Execute all searches in parallel
  const searchPromises = intents.map(async (intent) => {
    try {
      console.log(`      → "${intent.query.substring(0, 50)}${intent.query.length > 50 ? '...' : ''}"`)
      
      const results = await searchKnowledgeBases(
        intent.query,
        userId,
        kbIds,
        5, // Limit per query
        0.25 // Lower threshold for broader results
      )

      return {
        intent,
        results: results || [],
      }
    } catch (error) {
      console.error(`      ❌ Search failed for "${intent.query}":`, error)
      return { intent, results: [] }
    }
  })

  const searchResults = await Promise.all(searchPromises)

  // Combine and deduplicate results
  return combineAndDeduplicateResults(searchResults)
}

/**
 * Combine results from multiple searches, deduplicate, and rank
 */
function combineAndDeduplicateResults(
  searchResults: Array<{ intent: SearchIntent; results: any[] }>
): KBSearchHit[] {
  const resultMap = new Map<string, KBSearchHit>()

  for (const { intent, results } of searchResults) {
    for (const result of results) {
      const key = result.chunk_id || result.document_id || result.id

      // If we haven't seen this result, or this one has higher similarity
      const existing = resultMap.get(key)
      if (!existing || (result.similarity || 0) > (existing.similarity || 0)) {
        resultMap.set(key, {
          title: result.document_title || 'Untitled',
          kbName: result.kb_name || 'Unknown KB',
          similarity: result.similarity || 0,
          preview: result.snippet || result.content?.substring(0, 200) || '',
          sourceIntent: intent.query,
          matchType: result.match_type,
          documentId: result.document_id,
          knowledgeBaseId: result.knowledge_base_id,
        })
      }
    }
  }

  // Convert to array and sort by similarity
  const combined = Array.from(resultMap.values())
  combined.sort((a, b) => (b.similarity || 0) - (a.similarity || 0))

  // Limit total results
  return combined.slice(0, 15)
}

// ============================================
// Storage
// ============================================

/**
 * Store search results in analyzed_emails table
 */
export async function storeAutoSearchResults(
  analyzedEmailId: string,
  results: MultiIntentSearchResult
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('analyzed_emails')
      .update({
        kb_search_results: results,
        kb_search_performed_at: results.searchPerformedAt,
      })
      .eq('id', analyzedEmailId)

    if (error) {
      console.error('Error storing search results:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Error storing search results:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

