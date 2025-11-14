'use server'

import { createClient } from '@/lib/supabase/server'
import { fetchEmails, getEmailById, type EmailFetchOptions, type AurinkoEmail } from '@/lib/aurinko/client'
import { revalidatePath } from 'next/cache'

export async function getEmailsFromConnection(
  connectionId: string,
  filters: EmailFetchOptions
): Promise<{ emails: AurinkoEmail[]; nextPageToken?: string; error?: string }> {
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
    // Fetch emails from Aurinko
    const result = await fetchEmails(connection.aurinko_access_token, filters)
    
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

