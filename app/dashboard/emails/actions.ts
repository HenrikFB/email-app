'use server'

import { createClient } from '@/lib/supabase/server'
import { fetchEmails, getEmailById, type EmailFetchOptions, type Email, type MicrosoftEmail } from '@/lib/microsoft-graph/client'
import { revalidatePath } from 'next/cache'
import { getEmailProvider } from '@/lib/email-provider/factory'
import { runEmailWorkflow, type EmailInput, type AgentConfig } from '@/lib/langchain'

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

/**
 * Get full email details with body content (plain text and HTML)
 * Uses provider factory to support both Microsoft Graph and Aurinko
 * Returns both normalized email and raw API response
 */
export async function getFullEmailDetails(
  connectionId: string,
  emailId: string
): Promise<{ email: Email | null; rawResponse?: MicrosoftEmail | null; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { email: null, error: 'Not authenticated' }
  }

  // Get the email connection
  const { data: connection, error: connError } = await supabase
    .from('email_connections')
    .select('*')
    .eq('id', connectionId)
    .eq('user_id', user.id)
    .single()

  if (connError || !connection) {
    return { email: null, error: 'Email connection not found' }
  }

  try {
    console.log('Fetching full email details:', {
      connectionId,
      emailId,
      provider: connection.provider,
      hasToken: !!connection.aurinko_access_token,
    })
    
    // For Microsoft Graph, use getEmailByIdWithRaw to get raw response
    // For other providers, we'll need to implement similar functionality
    if (connection.provider === 'Microsoft') {
      const { getEmailByIdWithRaw } = await import('@/lib/microsoft-graph/client')
      const result = await getEmailByIdWithRaw(
        connection.aurinko_access_token,
        emailId
      )
      
      console.log('Email fetched successfully:', {
        emailId: result.email.id,
        subject: result.email.subject,
        hasBody: !!result.email.body,
        hasBodyHtml: !!result.email.bodyHtml,
        bodyLength: result.email.body?.length || 0,
        bodyHtmlLength: result.email.bodyHtml?.length || 0,
      })
      
      return { 
        email: result.email,
        rawResponse: result.rawResponse,
      }
    } else {
      // For other providers (Aurinko), use the provider factory
      const provider = getEmailProvider(connection.provider)
      const email = await provider.getEmailById(
        connection.aurinko_access_token,
        emailId
      )
      
      console.log('Email fetched successfully:', {
        emailId: email.id,
        subject: email.subject,
        hasBody: !!email.body,
        hasBodyHtml: !!email.bodyHtml,
        bodyLength: email.body?.length || 0,
        bodyHtmlLength: email.bodyHtml?.length || 0,
      })
      
      return { email }
    }
  } catch (error) {
    console.error('Error fetching full email details:', error)
    return {
      email: null,
      error: error instanceof Error ? error.message : 'Failed to fetch email details'
    }
  }
}

// ============================================
// LangChain Email Analysis
// ============================================

/**
 * Analyze emails using the LangChain workflow with ReAct research agent
 * 
 * This workflow:
 * 1. Cleans the email and extracts plain text
 * 2. Uses AI to identify job listings and match against user criteria
 * 3. Uses Tavily web search to find public job descriptions
 * 4. Re-evaluates matches against full job descriptions
 * 5. Stores results to the database
 */
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

  // Get assigned knowledge bases (for Phase 2)
  const { data: kbAssignments } = await supabase
    .from('agent_kb_assignments')
    .select('knowledge_base_id')
    .eq('agent_configuration_id', agentConfigId)

  const knowledgeBaseIds = (kbAssignments || []).map(a => a.knowledge_base_id)

  console.log(`\n📊 ========== LANGCHAIN ANALYSIS START ==========`)
  console.log(`📧 Analyzing ${emailIds.length} emails`)
  console.log(`🎯 Agent Config: ${agentConfig.name || agentConfig.email_address}`)
  console.log(`📚 KBs assigned: ${knowledgeBaseIds.length}`)
  
  let analyzedCount = 0
  let matchedCount = 0
  let failedCount = 0

  try {
    // Build LangChain config from agent_configurations
    const langchainConfig: AgentConfig = {
      id: agentConfig.id,
      matchCriteria: agentConfig.match_criteria || '',
      extractionFields: agentConfig.extraction_fields || '',
      userIntent: agentConfig.user_intent || undefined,
      draftGenerationEnabled: agentConfig.draft_generation_enabled || false,
      draftInstructions: agentConfig.draft_instructions || undefined,
      knowledgeBaseIds,
    }

    // Process each email
    for (let i = 0; i < emailIds.length; i++) {
      const emailId = emailIds[i]
      console.log(`\n📧 [${i + 1}/${emailIds.length}] Processing email ${emailId}...`)
      
      try {
        // Fetch the full email
        const email = await getEmailById(connection.aurinko_access_token, emailId)
        
        // Build EmailInput for LangChain
        const emailInput: EmailInput = {
          id: email.id,
          subject: email.subject || '(No subject)',
          from: email.from?.address || 'unknown@email.com',
          to: email.to?.map(t => t.address) || [],
          date: email.receivedDateTime || new Date().toISOString(),
          htmlBody: email.bodyHtml || email.body || '',
          snippet: email.snippet,
        }

        // Run the LangChain workflow
        const result = await runEmailWorkflow({
          email: emailInput,
          config: langchainConfig,
          userId: user.id,
        })

        // Build extracted_data from matched jobs
        const matchedJobs = result.jobs.filter(j => j.matched)
        const extractedData = matchedJobs.length > 0 ? {
          jobs: matchedJobs.map(job => ({
            company: job.company,
            position: job.position,
            location: job.location,
            technologies: job.technologies,
            confidence: job.confidence,
            ...job.extractedData,
          })),
          totalJobs: result.jobs.length,
          matchedJobs: matchedJobs.length,
        } : null

        // Build research data as array (UI expects array for .filter())
        // Include ALL jobs that were researched
        const researchedJobIds = result.researchResults.map(r => r.jobId)
        const jobsToInclude = result.jobs.filter(job => 
          job.matched ||
          researchedJobIds.includes(job.id) ||
          (job.extractedData as Record<string, unknown>)?._reEvaluated
        )
        
        const researchData = jobsToInclude.map(job => {
          const research = result.researchResults.find(r => r.jobId === job.id)
          const extractedData = (job.extractedData || {}) as Record<string, unknown>
          const wasReEvaluated = extractedData._reEvaluated === true
          const wasRejectedAfterReEval = wasReEvaluated && !job.matched && extractedData._changedReason
          
          return {
            source_name: job.company,
            source_url: research?.primarySource?.url || job.originalUrl || null,
            matched: job.matched,
            company: job.company,
            position: job.position,
            location: job.location,
            confidence: job.confidence,
            matchReasoning: job.matchReasoning,
            technologies: research?.technologies || job.technologies,
            deadline: research?.deadline || (extractedData.deadline as string) || null,
            found: research?.found ?? false,
            sourceType: research?.primarySource?.sourceType || 'email',
            iterations: research?.iterations || 0,
            experience_level: extractedData.experience_level || extractedData.experienceLevel || null,
            competencies: extractedData.competencies || null,
            company_domains: extractedData.company_domains || extractedData.companyDomains || null,
            work_type: extractedData.work_type || extractedData.workType || null,
            raw_content: research?.jobDescription?.substring(0, 1000) || null,
            reEvaluated: wasReEvaluated,
            rejectedAfterReEval: wasRejectedAfterReEval,
            rejectionReason: wasRejectedAfterReEval ? (extractedData._changedReason as string) : null,
          }
        })

        // Store the analysis results
        await supabase
          .from('analyzed_emails')
          .insert({
            user_id: user.id,
            agent_configuration_id: agentConfigId,
            email_connection_id: connectionId,
            email_subject: email.subject,
            email_from: email.from?.address || 'unknown',
            email_to: email.to?.map(t => t.address),
            email_date: email.receivedDateTime,
            email_message_id: email.internetMessageId || email.id,
            graph_message_id: email.id,
            email_snippet: email.snippet,
            has_attachments: email.hasAttachments,
            email_html_body: email.bodyHtml || email.body,
            
            // Analysis results
            analysis_status: result.success ? 'completed' : 'failed',
            matched: result.hasMatches,
            extracted_data: extractedData,
            data_by_source: researchData,
            reasoning: matchedJobs.length > 0
              ? matchedJobs.map(j => `${j.position} at ${j.company}: ${j.matchReasoning}`).join('\n\n')
              : 'No matching jobs found',
            confidence: matchedJobs.length > 0 
              ? matchedJobs.reduce((sum, j) => sum + j.confidence, 0) / matchedJobs.length 
              : 0,
            error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
            analyzed_at: new Date().toISOString(),
          })

        analyzedCount++
        if (result.hasMatches) {
          matchedCount++
        }
        
        console.log(`✅ [${i + 1}/${emailIds.length}] ${result.hasMatches ? '✓ MATCHED' : '✗ No match'} - ${email.subject}`)
        console.log(`   Jobs found: ${result.jobs.length}, Matched: ${matchedJobs.length}`)
        
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
              email_from: email.from?.address || 'unknown',
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

    console.log(`\n📊 ========== ANALYSIS COMPLETE ==========`)
    console.log(`✅ Analyzed: ${analyzedCount}/${emailIds.length}`)
    console.log(`✓  Matched: ${matchedCount}`)
    console.log(`❌ Failed: ${failedCount}`)
    console.log(`==========================================\n`)

    revalidatePath('/dashboard/results')
    
    return { 
      success: true, 
      analyzed: analyzedCount,
      matched: matchedCount,
      failed: failedCount,
    }
  } catch (error) {
    console.error('❌ Analysis error:', error)
    return { 
      success: false,
      analyzed: analyzedCount,
      matched: matchedCount,
      failed: failedCount,
      error: error instanceof Error ? error.message : 'Failed to analyze emails' 
    }
  }
}
