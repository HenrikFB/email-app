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
    if (filters.pageToken) {
      graphFilters.skipToken = filters.pageToken
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
          agentConfig: {
            match_criteria: agentConfig.match_criteria || '',
            extraction_fields: agentConfig.extraction_fields || '',
            follow_links: agentConfig.follow_links,
            button_text_pattern: agentConfig.button_text_pattern || undefined,
            scraping_strategy: 'two-pass', // Use two-pass by default
          },
        })

        // Store the analysis results
        await supabase
          .from('analyzed_emails')
          .upsert({
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
            reasoning: result.reasoning,
            confidence: result.confidence,
            scraped_urls: result.scrapedUrls,
            all_links_found: result.allLinksFound,
            email_html_body: result.emailHtmlBody,
            error_message: result.error || null,
            analyzed_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,email_message_id,agent_configuration_id',
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
            .upsert({
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
              error_message: emailError instanceof Error ? emailError.message : 'Unknown error',
              analyzed_at: new Date().toISOString(),
            }, {
              onConflict: 'user_id,email_message_id,agent_configuration_id',
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

