'use server'

import { createClient } from '@/lib/supabase/server'
import { fetchEmails, getEmailById, type EmailFetchOptions, type Email } from '@/lib/microsoft-graph/client'
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
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Get the email connection
  const { data: connection, error: connError } = await supabase
    .from('email_connections')
    .select('*')
    .eq('id', connectionId)
    .eq('user_id', user.id)
    .single()

  if (connError || !connection) {
    return { success: false, error: 'Email connection not found' }
  }

  // Get the agent configuration
  const { data: agentConfig, error: configError } = await supabase
    .from('agent_configurations')
    .select('*')
    .eq('id', agentConfigId)
    .eq('user_id', user.id)
    .single()

  if (configError || !agentConfig) {
    return { success: false, error: 'Agent configuration not found' }
  }

  try {
    // Fetch full email details for each selected email
    for (const emailId of emailIds) {
      const email = await getEmailById(connection.aurinko_access_token, emailId)

      // Store email for analysis (status: pending)
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
          email_snippet: email.snippet,
          has_attachments: email.hasAttachments,
          analysis_status: 'pending',
        }, {
          onConflict: 'user_id,email_message_id,agent_configuration_id',
        })
    }

    revalidatePath('/dashboard/results')
    
    return { success: true }
  } catch (error) {
    console.error('Error analyzing emails:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to analyze emails' 
    }
  }
}

