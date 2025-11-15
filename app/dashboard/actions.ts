'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type AgentConfiguration = {
  id: string
  user_id: string
  email_address: string
  match_criteria: string | null
  extraction_fields: string | null
  analyze_attachments: boolean
  follow_links: boolean
  created_at: string
  updated_at: string
}

export async function getConfigurations(): Promise<AgentConfiguration[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('agent_configurations')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching configurations:', error)
    throw new Error('Failed to fetch configurations')
  }

  return data as AgentConfiguration[]
}

export async function createConfiguration(formData: {
  email_address: string
  match_criteria: string
  extraction_fields: string
  analyze_attachments: boolean
  follow_links: boolean
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('agent_configurations')
    .insert([
      {
        user_id: user.id,
        email_address: formData.email_address,
        match_criteria: formData.match_criteria,
        extraction_fields: formData.extraction_fields,
        analyze_attachments: formData.analyze_attachments,
        follow_links: formData.follow_links,
      },
    ])
    .select()
    .single()

  if (error) {
    console.error('Error creating configuration:', error)
    throw new Error('Failed to create configuration')
  }

  revalidatePath('/dashboard')
  return data as AgentConfiguration
}

export async function updateConfiguration(
  id: string,
  formData: {
    email_address: string
    match_criteria: string
    extraction_fields: string
    analyze_attachments: boolean
    follow_links: boolean
  }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('agent_configurations')
    .update({
      email_address: formData.email_address,
      match_criteria: formData.match_criteria,
      extraction_fields: formData.extraction_fields,
      analyze_attachments: formData.analyze_attachments,
      follow_links: formData.follow_links,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('Error updating configuration:', error)
    throw new Error('Failed to update configuration')
  }

  revalidatePath('/dashboard')
  return data as AgentConfiguration
}

export async function deleteConfiguration(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { error } = await supabase
    .from('agent_configurations')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting configuration:', error)
    throw new Error('Failed to delete configuration')
  }

  revalidatePath('/dashboard')
}

