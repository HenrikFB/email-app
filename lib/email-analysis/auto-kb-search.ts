/**
 * Auto KB Search
 * 
 * Automatically searches knowledge bases when an email matches.
 * Can also auto-save matched emails to a designated KB.
 */

import { createClient } from '@/lib/supabase/server'
import { searchKnowledgeBases } from '@/lib/embeddings/service'
import { getAssignedKBs } from '@/app/dashboard/knowledge-base/actions'
import type { AutoKBSearchResult } from './types'

// ============================================
// Types
// ============================================

interface AutoSearchConfig {
  userId: string
  agentConfigId: string
  extractedData: Record<string, any>
  confidence: number
  autoSearchEnabled: boolean
  autoSaveKBId?: string
  autoSaveThreshold?: number
  queryTemplate?: string
}

interface AutoSearchResponse {
  searchResults?: AutoKBSearchResult
  autoSavedToKB?: string
  error?: string
}

// ============================================
// Main Function
// ============================================

/**
 * Perform automatic KB search when email matches
 * Optionally auto-save to KB if confidence threshold met
 */
export async function performAutoKBSearch(
  config: AutoSearchConfig
): Promise<AutoSearchResponse> {
  console.log('\n' + '─'.repeat(50))
  console.log('🔄 AUTO KB SEARCH STARTING...')
  console.log('─'.repeat(50))
  
  const response: AutoSearchResponse = {}
  
  try {
    // Skip if auto search not enabled
    if (!config.autoSearchEnabled) {
      console.log('   ⏭️  Auto KB search is disabled')
      return response
    }
    
    // Get assigned KBs for this agent
    const kbResult = await getAssignedKBs(config.agentConfigId)
    const assignedKBIds = kbResult.success ? (kbResult.data || []) : []
    
    if (assignedKBIds.length === 0) {
      console.log('   ⏭️  No KBs assigned to this agent')
      return response
    }
    
    console.log(`   📚 Searching ${assignedKBIds.length} assigned KB(s)...`)
    
    // Generate search query from extracted data
    const searchQuery = generateSearchQuery(config.extractedData, config.queryTemplate)
    
    if (!searchQuery || searchQuery.length < 10) {
      console.log('   ⏭️  Could not generate meaningful search query')
      return response
    }
    
    console.log(`   📝 Query: "${searchQuery.substring(0, 100)}${searchQuery.length > 100 ? '...' : ''}"`)
    
    // Perform KB search
    const kbResults = await searchKnowledgeBases(
      searchQuery,
      config.userId,
      assignedKBIds,
      10, // Limit
      0.4 // Threshold
    )
    
    // Format results
    response.searchResults = {
      searchPerformedAt: new Date().toISOString(),
      query: searchQuery,
      results: kbResults.slice(0, 10).map((r: any) => ({
        title: r.document_title || 'Untitled',
        kb_name: r.kb_name || 'Unknown KB',
        similarity: r.similarity || 0,
        preview: r.content?.substring(0, 200) || '',
      })),
      totalResults: kbResults.length,
    }
    
    console.log(`   ✅ Found ${kbResults.length} KB matches`)
    
    // Check auto-save conditions
    if (config.autoSaveKBId && config.confidence >= (config.autoSaveThreshold || 0.8)) {
      console.log(`   📤 Confidence ${(config.confidence * 100).toFixed(0)}% meets threshold, preparing auto-save...`)
      
      // Note: Actual auto-save will be done by the orchestrator after results are stored
      // Just flag that it should be done
      response.autoSavedToKB = config.autoSaveKBId
    }
    
    console.log('─'.repeat(50))
    console.log('✅ AUTO KB SEARCH COMPLETE')
    console.log('─'.repeat(50) + '\n')
    
  } catch (error) {
    console.error('❌ Auto KB search error:', error)
    response.error = error instanceof Error ? error.message : 'Unknown error'
  }
  
  return response
}

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a search query from extracted data
 * Uses template if provided, otherwise builds from key fields
 */
function generateSearchQuery(
  extractedData: Record<string, any>,
  template?: string
): string {
  // If template provided, use it with placeholders
  if (template) {
    let query = template
    
    // Replace {{field}} placeholders
    const placeholders = template.match(/\{\{(\w+)\}\}/g) || []
    for (const placeholder of placeholders) {
      const fieldName = placeholder.replace(/\{\{|\}\}/g, '')
      const value = extractedData[fieldName]
      
      if (value !== undefined) {
        const valueStr = Array.isArray(value) ? value.join(', ') : String(value)
        query = query.replace(placeholder, valueStr)
      } else {
        query = query.replace(placeholder, '')
      }
    }
    
    // Clean up extra spaces
    return query.replace(/\s+/g, ' ').trim()
  }
  
  // Default: build query from common job-related fields
  const queryParts: string[] = []
  
  // Priority fields for job search
  const priorityFields = [
    'job_title', 'title', 'position', 'role',
    'company', 'company_name', 'employer',
    'technologies', 'tech_stack', 'skills',
    'location', 'city', 'work_location',
  ]
  
  for (const field of priorityFields) {
    const value = extractedData[field]
    if (value) {
      if (Array.isArray(value)) {
        queryParts.push(value.slice(0, 3).join(' '))
      } else if (typeof value === 'string' && value.length > 0) {
        queryParts.push(value)
      }
    }
  }
  
  // Fallback: use any string fields
  if (queryParts.length === 0) {
    for (const [key, value] of Object.entries(extractedData)) {
      if (typeof value === 'string' && value.length > 5 && value.length < 100) {
        queryParts.push(value)
        if (queryParts.length >= 3) break
      }
    }
  }
  
  // Build final query (max 200 chars)
  const query = queryParts.join('. ')
  return query.length > 200 ? query.substring(0, 200) : query
}

/**
 * Store KB search results in analyzed_emails table
 */
export async function storeKBSearchResults(
  analyzedEmailId: string,
  results: AutoKBSearchResult
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
      console.error('Error storing KB search results:', error)
      return { success: false, error: error.message }
    }
    
    return { success: true }
  } catch (error) {
    console.error('Error storing KB search results:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

