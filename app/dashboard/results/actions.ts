'use server'

import { createClient } from '@/lib/supabase/server'
import { analyzeEmail } from '@/lib/email-analysis/orchestrator'
import { revalidatePath } from 'next/cache'

/**
 * Runs analysis on a queued email
 * Fetches the email, scrapes links (if enabled), and analyzes with OpenAI
 */
export async function runAnalysis(analyzedEmailId: string): Promise<{
  success: boolean
  error?: string
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  console.log('\n📋 ========== STARTING ANALYSIS ACTION ==========')
  console.log('🆔 Analyzed Email ID:', analyzedEmailId)

  // Get the analyzed email record with related data
  const { data: analyzedEmail, error: fetchError } = await supabase
    .from('analyzed_emails')
    .select(`
      *,
      email_connections:email_connection_id(*),
      agent_configurations:agent_configuration_id(*)
    `)
    .eq('id', analyzedEmailId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !analyzedEmail) {
    console.error('❌ Error fetching analyzed email:', fetchError)
    return { success: false, error: 'Email not found or access denied' }
  }

  console.log('✅ Fetched analyzed email:', {
    subject: analyzedEmail.email_subject,
    from: analyzedEmail.email_from,
    status: analyzedEmail.analysis_status,
    agentConfig: analyzedEmail.agent_configurations?.email_address,
    hasGraphId: !!analyzedEmail.graph_message_id,
    internetMessageId: analyzedEmail.email_message_id
  })

  // Check if we have the Graph ID (required for fetching)
  if (!analyzedEmail.graph_message_id) {
    console.error('❌ No Graph Message ID found. This email was queued before the migration.')
    return { 
      success: false, 
      error: 'Email is missing Graph ID. Please re-queue this email from the Browse Emails page.' 
    }
  }

  // Check if analysis is already running
  if (analyzedEmail.analysis_status === 'analyzing') {
    return { success: false, error: 'Analysis already in progress' }
  }

  // Update status to analyzing
  await supabase
    .from('analyzed_emails')
    .update({ analysis_status: 'analyzing' })
    .eq('id', analyzedEmailId)

  try {
    console.log('\n🚀 Running analysis orchestrator...')
    console.log('Using Graph Message ID:', analyzedEmail.graph_message_id)
    
    // Run the analysis using the orchestrator
    const result = await analyzeEmail({
      emailId: analyzedEmail.graph_message_id, // Use Graph ID instead of Internet Message ID
      accessToken: analyzedEmail.email_connections.aurinko_access_token,
      agentConfig: {
        match_criteria: analyzedEmail.agent_configurations.match_criteria || '',
        extraction_fields: analyzedEmail.agent_configurations.extraction_fields || '',
        follow_links: analyzedEmail.agent_configurations.follow_links,
      },
    })

    console.log('\n💾 Updating database with results...')
    console.log('Result to save:', {
      success: result.success,
      matched: result.matched,
      extractedDataKeys: Object.keys(result.extractedData),
      scrapedUrls: result.scrapedUrls.length,
      hasError: !!result.error
    })

    // Update database with results
    const { error: updateError } = await supabase
      .from('analyzed_emails')
      .update({
        analysis_status: result.success ? 'completed' : 'failed',
        extracted_data: result.extractedData,
        matched: result.matched,
        scraped_urls: result.scrapedUrls,
        error_message: result.error,
        analyzed_at: new Date().toISOString(),
      })
      .eq('id', analyzedEmailId)

    if (updateError) {
      console.error('❌ Error updating analysis results:', updateError)
      return { success: false, error: 'Failed to save analysis results' }
    }

    console.log('✅ Database updated successfully!')
    console.log('========== ANALYSIS ACTION COMPLETE ==========\n')

    revalidatePath('/dashboard/results')

    return { success: true }
  } catch (error) {
    console.error('\n❌ Analysis error:', error)

    // Update status to failed
    await supabase
      .from('analyzed_emails')
      .update({
        analysis_status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', analyzedEmailId)

    revalidatePath('/dashboard/results')

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
    }
  }
}

