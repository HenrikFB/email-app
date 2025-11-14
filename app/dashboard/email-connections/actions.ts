'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type EmailConnection = {
  id: string
  user_id: string
  email_address: string
  provider: string
  aurinko_account_id: string
  is_active: boolean
  last_sync_at: string | null
  created_at: string
  updated_at: string
}

export async function getEmailConnections(): Promise<EmailConnection[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('email_connections')
    .select('id, user_id, email_address, provider, aurinko_account_id, is_active, last_sync_at, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching email connections:', error)
    throw new Error('Failed to fetch email connections')
  }

  return data as EmailConnection[]
}

export async function disconnectEmailConnection(connectionId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { error } = await supabase
    .from('email_connections')
    .delete()
    .eq('id', connectionId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error disconnecting email connection:', error)
    throw new Error('Failed to disconnect email connection')
  }

  revalidatePath('/dashboard')
}

export async function toggleConnectionStatus(connectionId: string, isActive: boolean) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { error } = await supabase
    .from('email_connections')
    .update({ is_active: isActive })
    .eq('id', connectionId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error toggling connection status:', error)
    throw new Error('Failed to update connection status')
  }

  revalidatePath('/dashboard')
}

