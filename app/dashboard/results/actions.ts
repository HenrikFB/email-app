'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { embedAnalyzedEmail } from '@/lib/embeddings/service'
import { searchKnowledgeBases, searchAnalyzedEmails } from '@/lib/embeddings/service'

/**
 * Deletes an analyzed email record
 * @param id - The UUID of the analyzed email to delete
 * @returns Success status and optional error message
 */
export async function deleteAnalyzedEmail(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('analyzed_emails')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting analyzed email:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/results')
  return { success: true }
}

/**
 * Save an analyzed email to a knowledge base
 * Creates embeddings for semantic search
 */
export async function saveEmailToKB(
  analyzedEmailId: string,
  knowledgeBaseId?: string,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }
    
    // Get the analyzed email with agent configuration
    const { data: email, error: emailError } = await supabase
      .from('analyzed_emails')
      .select(`
        *,
        agent_configurations (
          id,
          name,
          email_address,
          match_criteria,
          extraction_fields,
          analyze_attachments,
          follow_links,
          button_text_pattern
        )
      `)
      .eq('id', analyzedEmailId)
      .eq('user_id', user.id)
      .single()
    
    if (emailError || !email) {
      return { success: false, error: 'Email not found' }
    }
    
    // If no KB specified, create a dynamic one
    let kbId = knowledgeBaseId
    if (!kbId) {
      const { data: newKB, error: kbError } = await supabase
        .from('knowledge_bases')
        .insert({
          user_id: user.id,
          name: 'Saved Emails',
          type: 'saved_emails',
          is_dynamic: true,
        })
        .select()
        .single()
      
      if (kbError) {
        return { success: false, error: kbError.message }
      }
      
      kbId = newKB.id
    }
    
    // Create agent config snapshot if available
    const agentConfig = email.agent_configurations
    const agentConfigSnapshot = agentConfig ? {
      name: agentConfig.name,
      email_address: agentConfig.email_address,
      match_criteria: agentConfig.match_criteria,
      extraction_fields: agentConfig.extraction_fields,
      analyze_attachments: agentConfig.analyze_attachments,
      follow_links: agentConfig.follow_links,
      button_text_pattern: agentConfig.button_text_pattern,
    } : null
    
    // Create analyzed email snapshot
    const analyzedEmailSnapshot = {
      email_subject: email.email_subject,
      email_from: email.email_from,
      email_date: email.email_date,
      reasoning: email.reasoning,
      confidence: email.confidence,
      matched: email.matched,
      extracted_data: email.extracted_data,
      data_by_source: email.data_by_source,
      scraped_urls: email.scraped_urls,
    }
    
    // Create document from email
    const content = JSON.stringify(email.extracted_data, null, 2)
    const { data: document, error: docError } = await supabase
      .from('kb_documents')
      .insert({
        user_id: user.id,
        knowledge_base_id: kbId,
        title: email.email_subject || 'Untitled Email',
        type: 'saved_email',
        content: content,
        analyzed_email_id: analyzedEmailId,
        source_agent_config_id: agentConfig?.id || null,
        agent_config_snapshot: agentConfigSnapshot,
        analyzed_email_snapshot: analyzedEmailSnapshot,
        notes: note || null,
      })
      .select()
      .single()
    
    if (docError) {
      return { success: false, error: docError.message }
    }
    
    // Generate embeddings
    await embedAnalyzedEmail(
      analyzedEmailId,
      email.extracted_data || {},
      email.data_by_source || [],
      user.id
    )
    
    revalidatePath('/dashboard/results')
    revalidatePath(`/dashboard/knowledge-base/${kbId}`)
    
    return { success: true }
  } catch (error) {
    console.error('Error saving email to KB:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Save a scraped URL from an analyzed email to a knowledge base
 */
export async function saveScrapedUrlToKB(
  analyzedEmailId: string,
  sourceUrl: string,
  knowledgeBaseId?: string,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }
    
    // Get the analyzed email with agent configuration
    const { data: email, error: emailError } = await supabase
      .from('analyzed_emails')
      .select(`
        *,
        agent_configurations (
          id,
          name,
          email_address,
          match_criteria,
          extraction_fields,
          analyze_attachments,
          follow_links,
          button_text_pattern
        )
      `)
      .eq('id', analyzedEmailId)
      .eq('user_id', user.id)
      .single()
    
    if (emailError || !email) {
      return { success: false, error: 'Email not found' }
    }
    
    // Find the source data
    const sourceData = email.data_by_source?.find((s: any) => s.source === sourceUrl)
    if (!sourceData) {
      return { success: false, error: 'Source URL not found in email data' }
    }
    
    // If no KB specified, create a dynamic one
    let kbId = knowledgeBaseId
    if (!kbId) {
      const { data: newKB, error: kbError } = await supabase
        .from('knowledge_bases')
        .insert({
          user_id: user.id,
          name: 'Saved URLs',
          type: 'saved_scraped_urls',
          is_dynamic: true,
        })
        .select()
        .single()
      
      if (kbError) {
        return { success: false, error: kbError.message }
      }
      
      kbId = newKB.id
    }
    
    // Create agent config snapshot if available
    const agentConfig = email.agent_configurations
    const agentConfigSnapshot = agentConfig ? {
      name: agentConfig.name,
      email_address: agentConfig.email_address,
      match_criteria: agentConfig.match_criteria,
      extraction_fields: agentConfig.extraction_fields,
      analyze_attachments: agentConfig.analyze_attachments,
      follow_links: agentConfig.follow_links,
      button_text_pattern: agentConfig.button_text_pattern,
    } : null
    
    // Create analyzed email snapshot
    const analyzedEmailSnapshot = {
      email_subject: email.email_subject,
      email_from: email.email_from,
      email_date: email.email_date,
      reasoning: email.reasoning,
      confidence: email.confidence,
      matched: email.matched,
      extracted_data: email.extracted_data,
      data_by_source: email.data_by_source,
      scraped_urls: email.scraped_urls,
    }
    
    // Create document from scraped URL data
    const content = `${JSON.stringify(sourceData.data, null, 2)}\n\nReasoning: ${sourceData.reasoning}`
    const { data: document, error: docError } = await supabase
      .from('kb_documents')
      .insert({
        user_id: user.id,
        knowledge_base_id: kbId,
        title: `Data from ${new URL(sourceUrl).hostname}`,
        type: 'saved_url',
        content: content,
        analyzed_email_id: analyzedEmailId,
        source_url: sourceUrl,
        source_agent_config_id: agentConfig?.id || null,
        agent_config_snapshot: agentConfigSnapshot,
        analyzed_email_snapshot: analyzedEmailSnapshot,
        notes: note || null,
      })
      .select()
      .single()
    
    if (docError) {
      return { success: false, error: docError.message }
    }
    
    revalidatePath('/dashboard/results')
    revalidatePath(`/dashboard/knowledge-base/${kbId}`)
    
    return { success: true }
  } catch (error) {
    console.error('Error saving URL to KB:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Search for similar content across KBs and saved emails
 */
export async function searchSimilar(
  query: string,
  kbIds: string[],
  includeEmails: boolean = true,
  includeKBs: boolean = true,
  limit: number = 10,
  matchThreshold: number = 0.3
): Promise<{
  success: boolean
  kbResults?: any[]
  emailResults?: any[]
  error?: string
  debugRunId?: string
}> {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }
    
    // Initialize debug logging
    const { 
      initSearchDebugRun, 
      logQueryDetails, 
      finalizeSearchDebugRun,
      cleanupOldSearchDebugRuns 
    } = await import('@/lib/embeddings/search-debug-logger')
    
    cleanupOldSearchDebugRuns()
    const debugRunId = initSearchDebugRun(query, user.id, matchThreshold, limit)
    logQueryDetails(debugRunId, query)
    
    console.log('\n' + '═'.repeat(70))
    console.log('🔍 SEMANTIC SEARCH INITIATED')
    console.log('═'.repeat(70))
    console.log(`📝 Query: "${query}"`)
    console.log(`👤 User ID: ${user.id}`)
    console.log(`🎯 Threshold: ${matchThreshold} (${(matchThreshold * 100).toFixed(0)}%)`)
    console.log(`📋 Limit: ${limit} results per source`)
    console.log(`🔎 Search KBs: ${includeKBs ? 'Yes' : 'No'}`)
    console.log(`📧 Search Emails: ${includeEmails ? 'Yes' : 'No'}`)
    if (includeKBs) {
      console.log(`🗂️  KB IDs: ${kbIds.length > 0 ? kbIds.join(', ') : 'All KBs (no filter)'}`)
    }
    console.log('═'.repeat(70) + '\n')
    
    const results: any = { success: true, debugRunId }
    
    // Get KB names for debug logging
    let kbNames: string[] = []
    if (includeKBs && kbIds.length > 0) {
      const { data: kbs } = await supabase
        .from('knowledge_bases')
        .select('id, name')
        .in('id', kbIds)
        .eq('user_id', user.id)
      
      kbNames = kbs?.map(kb => kb.name) || []
    }
    
    // Search KBs if requested
    if (includeKBs) {
      // Pass null if empty array to search all KBs
      const kbIdsToSearch = kbIds.length > 0 ? kbIds : null
      results.kbResults = await searchKnowledgeBases(
        query, 
        user.id, 
        kbIdsToSearch, 
        limit, 
        matchThreshold,
        debugRunId
      )
    }
    
    // Search saved emails if requested
    if (includeEmails) {
      results.emailResults = await searchAnalyzedEmails(
        query, 
        user.id, 
        limit, 
        matchThreshold,
        debugRunId
      )
    }
    
    // Finalize debug run
    if (debugRunId) {
      const { logKBSelection } = await import('@/lib/embeddings/search-debug-logger')
      logKBSelection(debugRunId, kbIds.length > 0 ? kbIds : null, kbNames)
      
      finalizeSearchDebugRun(debugRunId, {
        runId: debugRunId,
        query,
        userId: user.id,
        timestamp: new Date().toISOString(),
        originalQuery: query,
        threshold: matchThreshold,
        limit,
        kbIds: kbIds.length > 0 ? kbIds : null,
        kbNames,
        kbSearch: {
          table: 'kb_chunks',
          rpcFunction: 'hybrid_search_knowledge_base',
          fields: ['content', 'embedding', 'document_id', 'chunk_index', 'char_count'],
          resultsCount: results.kbResults?.length || 0,
          similarityRange: results.kbResults && results.kbResults.length > 0
            ? {
                min: Math.min(...results.kbResults.map((r: any) => r.similarity || 0)),
                max: Math.max(...results.kbResults.map((r: any) => r.similarity || 0))
              }
            : undefined
        },
        emailSearch: {
          table: 'analyzed_email_embeddings',
          rpcFunction: 'search_analyzed_emails',
          fields: ['embedded_text', 'embedding', 'content_type', 'source_url', 'analyzed_email_id'],
          resultsCount: results.emailResults?.length || 0,
          similarityRange: results.emailResults && results.emailResults.length > 0
            ? {
                min: Math.min(...results.emailResults.map((r: any) => r.similarity || 0)),
                max: Math.max(...results.emailResults.map((r: any) => r.similarity || 0))
              }
            : undefined
        },
        kbResults: results.kbResults,
        emailResults: results.emailResults
      })
    }
    
    console.log('\n' + '═'.repeat(70))
    console.log('✅ SEARCH COMPLETE')
    console.log('═'.repeat(70))
    console.log(`📊 KB Results: ${results.kbResults?.length || 0}`)
    console.log(`📧 Email Results: ${results.emailResults?.length || 0}`)
    console.log(`📁 Debug folder: debug-search-runs/${debugRunId}`)
    console.log('═'.repeat(70) + '\n')
    
    return results
  } catch (error) {
    console.error('❌ Error searching:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Chat-based search using AI tool calling
 * Provides intelligent query understanding and multi-intent detection
 */
export async function handleChatSearch(
  query: string,
  agentConfigId?: string,
  currentEmailId?: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<{
  success: boolean
  response?: string
  kbResults?: any[]
  emailResults?: any[]
  toolsUsed?: string[]
  error?: string
}> {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }
    
    // Import chat search service
    const { chatSearch } = await import('@/lib/chat-search')
    
    // Execute chat search
    const result = await chatSearch(query, {
      userId: user.id,
      agentConfigId,
      currentEmailId,
      conversationHistory: conversationHistory?.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    })
    
    return {
      success: result.success,
      response: result.response,
      kbResults: result.kbResults,
      emailResults: result.emailResults,
      toolsUsed: result.toolsUsed,
      error: result.error,
    }
  } catch (error) {
    console.error('❌ Error in chat search:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

