'use server'

import { createClient } from '@/lib/supabase/server'
import { fetchEmails, getEmailById, type EmailFetchOptions, type Email } from '@/lib/microsoft-graph/client'
import { analyzeEmail } from '@/lib/email-analysis/orchestrator'
import { revalidatePath } from 'next/cache'

export async function getEmailsFromConnection(
  connectionId: string,
  filters: EmailFetchOptions
): Promise<{ emails: Email[]; nextPageToken?: string; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { emails: [], error: 'Not authenticated' }
  }

  // Get the email connection
  const { data: connection, error: connError } = await supabase
    .from('email_connections')
    .select('*')
    .eq('id', connectionId)
    .eq('user_id', user.id)
    .single()

  if (connError || !connection) {
    return { emails: [], error: 'Email connection not found' }
  }

  try {
    // Convert date filters to ISO format if needed
    const graphFilters: EmailFetchOptions = { ...filters }
    
    // Microsoft Graph expects ISO date strings
    if (filters.after && !filters.after.includes('T')) {
      // Convert YYYY/MM/DD to ISO format
      const [year, month, day] = filters.after.split('/')
      graphFilters.after = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`
    }
    if (filters.before && !filters.before.includes('T')) {
      const [year, month, day] = filters.before.split('/')
      graphFilters.before = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T23:59:59Z`
    }

    // Use skipToken if provided
    if (filters.skipToken) {
      graphFilters.skipToken = filters.skipToken
    }

    // Fetch emails from Microsoft Graph
    const result = await fetchEmails(connection.aurinko_access_token, graphFilters)
    
    return {
      emails: result.records,
      nextPageToken: result.nextPageToken,
    }
  } catch (error) {
    console.error('Error fetching emails:', error)
    return { 
      emails: [], 
      error: error instanceof Error ? error.message : 'Failed to fetch emails' 
    }
  }
}

export async function analyzeSelectedEmails(
  emailIds: string[],
  connectionId: string,
  agentConfigId: string
): Promise<{ success: boolean; analyzed: number; matched: number; failed: number; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, analyzed: 0, matched: 0, failed: 0, error: 'Not authenticated' }
  }

  // Get the email connection
  const { data: connection, error: connError } = await supabase
    .from('email_connections')
    .select('*')
    .eq('id', connectionId)
    .eq('user_id', user.id)
    .single()

  if (connError || !connection) {
    return { success: false, analyzed: 0, matched: 0, failed: 0, error: 'Email connection not found' }
  }

  // Get the agent configuration
  const { data: agentConfig, error: configError } = await supabase
    .from('agent_configurations')
    .select('*')
    .eq('id', agentConfigId)
    .eq('user_id', user.id)
    .single()

  if (configError || !agentConfig) {
    return { success: false, analyzed: 0, matched: 0, failed: 0, error: 'Agent configuration not found' }
  }

  console.log(`\n📊 ========== BATCH ANALYSIS START ==========`)
  console.log(`📧 Analyzing ${emailIds.length} emails`)
  console.log(`🎯 Agent Config: ${agentConfig.email_address}`)
  
  let analyzedCount = 0
  let matchedCount = 0
  let failedCount = 0

  try {
    // Analyze each email immediately
    for (let i = 0; i < emailIds.length; i++) {
      const emailId = emailIds[i]
      console.log(`\n📧 [${i + 1}/${emailIds.length}] Processing email ${emailId}...`)
      
      try {
        // Fetch basic email info first
        const email = await getEmailById(connection.aurinko_access_token, emailId)
        
        // Run analysis immediately
        const result = await analyzeEmail({
          emailId: emailId,
          accessToken: connection.aurinko_access_token,
          userId: user.id,
          agentConfigId: agentConfigId,
          agentConfig: {
            match_criteria: agentConfig.match_criteria || '',
            extraction_fields: agentConfig.extraction_fields || '',
            follow_links: agentConfig.follow_links,
            button_text_pattern: agentConfig.button_text_pattern || undefined,
            user_intent: agentConfig.user_intent || undefined,
            link_selection_guidance: agentConfig.link_selection_guidance || undefined,
            max_links_to_scrape: agentConfig.max_links_to_scrape ?? 10,
            content_retrieval_strategy: agentConfig.content_retrieval_strategy || 'scrape_only',
            extraction_examples: agentConfig.extraction_examples || undefined,
            analysis_feedback: agentConfig.analysis_feedback || undefined,
            scraping_strategy: 'two-pass', // Use two-pass by default
            // Automation fields
            auto_search_kb_on_match: agentConfig.auto_search_kb_on_match ?? false,
            auto_save_matches_to_kb_id: agentConfig.auto_save_matches_to_kb_id || undefined,
            auto_save_confidence_threshold: agentConfig.auto_save_confidence_threshold ?? 0.8,
            auto_search_query_template: agentConfig.auto_search_query_template || undefined,
            // Multi-intent search fields
            auto_search_mode: agentConfig.auto_search_mode || 'single',
            auto_search_instructions: agentConfig.auto_search_instructions || undefined,
            auto_search_split_fields: agentConfig.auto_search_split_fields || undefined,
            auto_search_max_queries: agentConfig.auto_search_max_queries ?? 5,
            // Deep Agent / Draft generation fields
            draft_generation_enabled: agentConfig.draft_generation_enabled ?? false,
            draft_instructions: agentConfig.draft_instructions || undefined,
          },
        })

        // Store the analysis results (no longer using upsert - allow multiple runs)
        await supabase
          .from('analyzed_emails')
          .insert({
            user_id: user.id,
            agent_configuration_id: agentConfigId,
            email_connection_id: connectionId,
            email_subject: email.subject,
            email_from: email.from.address,
            email_to: email.to?.map(t => t.address),
            email_date: email.receivedDateTime,
            email_message_id: email.internetMessageId || email.id,
            graph_message_id: email.id,
            email_snippet: email.snippet,
            has_attachments: email.hasAttachments,
            
            // Analysis results
            analysis_status: result.success ? 'completed' : 'failed',
            matched: result.matched,
            extracted_data: result.extractedData,
            data_by_source: result.dataBySource || [],  // NEW: Store source-attributed data
            reasoning: result.reasoning,
            confidence: result.confidence,
            scraped_urls: result.scrapedUrls,
            scraped_content: result.scrapedContent || null,  // NEW: Store scraped markdown content
            original_urls: result.originalUrls || null,  // NEW: Store SafeLinks → Actual URL mappings
            all_links_found: result.allLinksFound,
            email_html_body: result.emailHtmlBody,
            error_message: result.error || null,
            analyzed_at: new Date().toISOString(),
            
            // Auto KB search results
            kb_search_results: result.autoKBSearchResults || null,
            kb_search_performed_at: result.autoKBSearchResults ? new Date().toISOString() : null,
            auto_saved_to_kb_id: result.autoSavedToKBId || null,
          })

        analyzedCount++
        if (result.matched) {
          matchedCount++
        }
        
        console.log(`✅ [${i + 1}/${emailIds.length}] ${result.matched ? '✓ MATCHED' : '✗ No match'} - ${email.subject}`)
      } catch (emailError) {
        failedCount++
        console.error(`❌ [${i + 1}/${emailIds.length}] Failed:`, emailError)
        
            // Try to store the failure
            try {
              const email = await getEmailById(connection.aurinko_access_token, emailId)
              await supabase
                .from('analyzed_emails')
                .insert({
                  user_id: user.id,
                  agent_configuration_id: agentConfigId,
                  email_connection_id: connectionId,
                  email_subject: email.subject,
                  email_from: email.from.address,
                  email_to: email.to?.map(t => t.address),
                  email_date: email.receivedDateTime,
                  email_message_id: email.internetMessageId || email.id,
                  graph_message_id: email.id,
                  email_snippet: email.snippet,
                  has_attachments: email.hasAttachments,
                  analysis_status: 'failed',
                  matched: false,
                  data_by_source: [],
                  error_message: emailError instanceof Error ? emailError.message : 'Unknown error',
                  analyzed_at: new Date().toISOString(),
                })
            } catch (storeError) {
              console.error('Failed to store error:', storeError)
            }
      }
    }

    console.log(`\n📊 ========== BATCH ANALYSIS COMPLETE ==========`)
    console.log(`✅ Analyzed: ${analyzedCount}/${emailIds.length}`)
    console.log(`✓  Matched: ${matchedCount}`)
    console.log(`❌ Failed: ${failedCount}`)
    console.log(`==============================================\n`)

    revalidatePath('/dashboard/results')
    
    return { 
      success: true, 
      analyzed: analyzedCount,
      matched: matchedCount,
      failed: failedCount,
    }
  } catch (error) {
    console.error('❌ Batch analysis error:', error)
    return { 
      success: false,
      analyzed: analyzedCount,
      matched: matchedCount,
      failed: failedCount,
      error: error instanceof Error ? error.message : 'Failed to analyze emails' 
    }
  }
}

