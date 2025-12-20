'use server'

/**
 * LangChain Email Analysis Actions
 * 
 * Server actions for running the LangChain email workflow.
 * Integrates with existing dashboard and database.
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { 
  runEmailWorkflow, 
  type EmailInput, 
  type AgentConfig,
  type EmailWorkflowResult 
} from '@/lib/langchain'

// ============================================
// Types
// ============================================

export interface AnalyzeEmailWithLangChainInput {
  /** Email ID from Microsoft Graph */
  emailId: string
  /** Agent configuration ID */
  agentConfigId: string
  /** Microsoft Graph access token */
  accessToken: string
}

export interface AnalyzeEmailWithLangChainResult {
  success: boolean
  analysisId?: string
  result?: EmailWorkflowResult
  error?: string
}

// ============================================
// Helper: Fetch Email from Graph
// ============================================

async function fetchEmailFromGraph(
  emailId: string,
  accessToken: string
): Promise<EmailInput> {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${emailId}?$select=id,subject,from,toRecipients,sentDateTime,body,bodyPreview`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch email: ${response.status}`)
  }

  const email = await response.json()

  return {
    id: email.id,
    subject: email.subject || '(No subject)',
    from: email.from?.emailAddress?.address || 'unknown@email.com',
    to: (email.toRecipients || []).map((r: { emailAddress?: { address?: string } }) => 
      r.emailAddress?.address || ''
    ).filter(Boolean),
    date: email.sentDateTime || new Date().toISOString(),
    htmlBody: email.body?.content || '',
    snippet: email.bodyPreview,
  }
}

// ============================================
// Helper: Load Agent Config
// ============================================

async function loadAgentConfig(
  configId: string,
  userId: string
): Promise<AgentConfig & { knowledgeBaseIds: string[] }> {
  const supabase = await createClient()

  // Fetch agent configuration
  const { data: config, error } = await supabase
    .from('agent_configurations')
    .select(`
      id,
      match_criteria,
      extraction_fields,
      user_intent,
      draft_generation_enabled,
      draft_instructions
    `)
    .eq('id', configId)
    .eq('user_id', userId)
    .single()

  if (error || !config) {
    throw new Error('Agent configuration not found')
  }

  // Fetch assigned knowledge bases
  const { data: kbAssignments } = await supabase
    .from('agent_kb_assignments')
    .select('knowledge_base_id')
    .eq('agent_configuration_id', configId)

  const knowledgeBaseIds = (kbAssignments || []).map(a => a.knowledge_base_id)

  return {
    id: config.id,
    matchCriteria: config.match_criteria || '',
    extractionFields: config.extraction_fields || '',
    userIntent: config.user_intent || undefined,
    draftGenerationEnabled: config.draft_generation_enabled || false,
    draftInstructions: config.draft_instructions || undefined,
    knowledgeBaseIds,
  }
}

// ============================================
// Main Action: Analyze Email with LangChain
// ============================================

/**
 * Analyze an email using the LangChain workflow
 * 
 * This action:
 * 1. Fetches the email from Microsoft Graph
 * 2. Loads the agent configuration
 * 3. Runs the LangChain workflow
 * 4. Saves results to the analyzed_emails table
 */
export async function analyzeEmailWithLangChain(
  input: AnalyzeEmailWithLangChainInput
): Promise<AnalyzeEmailWithLangChainResult> {
  console.log('\n' + '═'.repeat(70))
  console.log('🚀 LANGCHAIN ANALYSIS - SERVER ACTION')
  console.log('═'.repeat(70))
  console.log(`📧 Email ID: ${input.emailId}`)
  console.log(`🎯 Config ID: ${input.agentConfigId}`)
  console.log('═'.repeat(70))

  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Not authenticated')
    }

    // 1. Fetch email from Microsoft Graph
    console.log('\n📨 Fetching email from Microsoft Graph...')
    const email = await fetchEmailFromGraph(input.emailId, input.accessToken)
    console.log(`   Subject: ${email.subject}`)
    console.log(`   From: ${email.from}`)

    // 2. Load agent configuration
    console.log('\n⚙️ Loading agent configuration...')
    const config = await loadAgentConfig(input.agentConfigId, user.id)
    console.log(`   Match criteria: ${config.matchCriteria.substring(0, 50)}...`)

    // 3. Run the LangChain workflow
    console.log('\n🔄 Running LangChain workflow...')
    const result = await runEmailWorkflow({
      email,
      config,
      userId: user.id,
    })

    console.log('\n📊 Workflow complete:')
    console.log(`   Success: ${result.success}`)
    console.log(`   Jobs found: ${result.jobs.length}`)
    console.log(`   Matches: ${result.jobs.filter(j => j.matched).length}`)

    // 4. Save results to database
    console.log('\n💾 Saving to database...')
    
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

    // Build research data
    const researchData = result.researchResults.length > 0 ? {
      results: result.researchResults.map(r => ({
        jobId: r.jobId,
        company: r.company,
        position: r.position,
        found: r.found,
        primarySource: r.primarySource?.url,
        sourceType: r.primarySource?.sourceType,
        technologies: r.technologies,
        deadline: r.deadline,
        iterations: r.iterations,
      })),
    } : null

    // Insert or update analyzed_emails record
    const { data: analysisRecord, error: insertError } = await supabase
      .from('analyzed_emails')
      .upsert({
        user_id: user.id,
        agent_configuration_id: input.agentConfigId,
        email_message_id: email.id,
        email_subject: email.subject,
        email_from: email.from,
        email_to: email.to,
        email_date: email.date,
        email_html_body: email.htmlBody,
        email_snippet: email.snippet,
        matched: result.hasMatches,
        confidence: matchedJobs.length > 0 
          ? matchedJobs.reduce((sum, j) => sum + j.confidence, 0) / matchedJobs.length 
          : 0,
        reasoning: matchedJobs.length > 0
          ? matchedJobs.map(j => `${j.position} at ${j.company}: ${j.matchReasoning}`).join('\n\n')
          : 'No matching jobs found',
        extracted_data: extractedData,
        data_by_source: researchData,
        analysis_status: result.success ? 'completed' : 'failed',
        analyzed_at: new Date().toISOString(),
        error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
      }, {
        onConflict: 'email_message_id',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Database error:', insertError)
      throw new Error(`Failed to save analysis: ${insertError.message}`)
    }

    console.log(`   Saved as: ${analysisRecord.id}`)

    // Revalidate the results page
    revalidatePath('/dashboard/results')
    revalidatePath('/dashboard/emails')

    console.log('\n' + '═'.repeat(70))
    console.log('✅ LANGCHAIN ANALYSIS - COMPLETE')
    console.log('═'.repeat(70) + '\n')

    return {
      success: true,
      analysisId: analysisRecord.id,
      result,
    }

  } catch (error) {
    console.error('\n❌ LANGCHAIN ANALYSIS - ERROR:', error)
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================
// Action: Re-run Analysis
// ============================================

/**
 * Re-run analysis on an already analyzed email
 */
export async function rerunLangChainAnalysis(
  analysisId: string,
  accessToken: string
): Promise<AnalyzeEmailWithLangChainResult> {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Fetch existing analysis
  const { data: analysis, error } = await supabase
    .from('analyzed_emails')
    .select('email_message_id, agent_configuration_id')
    .eq('id', analysisId)
    .eq('user_id', user.id)
    .single()

  if (error || !analysis) {
    return { success: false, error: 'Analysis not found' }
  }

  // Re-run with same parameters
  return analyzeEmailWithLangChain({
    emailId: analysis.email_message_id,
    agentConfigId: analysis.agent_configuration_id,
    accessToken,
  })
}

