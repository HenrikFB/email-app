'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type AgentConfiguration = {
  id: string
  user_id: string
  name: string
  email_address: string
  match_criteria: string | null
  extraction_fields: string | null
  analyze_attachments: boolean
  follow_links: boolean
  button_text_pattern: string | null
  user_intent: string | null
  link_selection_guidance: string | null
  max_links_to_scrape: number | null
  content_retrieval_strategy: 'scrape_only' | 'scrape_and_search' | 'search_only' | null
  extraction_examples: string | null
  analysis_feedback: string | null
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
  name: string
  email_address: string
  match_criteria: string
  extraction_fields: string
  analyze_attachments: boolean
  follow_links: boolean
  button_text_pattern?: string
  user_intent?: string
  link_selection_guidance?: string
  max_links_to_scrape?: number
  content_retrieval_strategy?: 'scrape_only' | 'scrape_and_search' | 'search_only'
  extraction_examples?: string
  analysis_feedback?: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  // Check if name already exists for this user
  const { data: existing } = await supabase
    .from('agent_configurations')
    .select('id')
    .eq('user_id', user.id)
    .eq('name', formData.name)
    .single()

  if (existing) {
    throw new Error('An agent configuration with this name already exists')
  }

  const { data, error} = await supabase
    .from('agent_configurations')
    .insert([
      {
        user_id: user.id,
        name: formData.name,
        email_address: formData.email_address,
        match_criteria: formData.match_criteria,
        extraction_fields: formData.extraction_fields,
        analyze_attachments: formData.analyze_attachments,
        follow_links: formData.follow_links,
        button_text_pattern: formData.button_text_pattern || null,
        user_intent: formData.user_intent || null,
        link_selection_guidance: formData.link_selection_guidance || null,
        max_links_to_scrape: formData.max_links_to_scrape ?? 10,
        content_retrieval_strategy: formData.content_retrieval_strategy || 'scrape_only',
        extraction_examples: formData.extraction_examples || null,
        analysis_feedback: formData.analysis_feedback || null,
      },
    ])
    .select()
    .single()

  if (error) {
    console.error('Error creating configuration:', error)
    // Check for unique constraint violation
    if (error.code === '23505') {
      throw new Error('An agent configuration with this name already exists')
    }
    throw new Error('Failed to create configuration')
  }

  revalidatePath('/dashboard')
  return data as AgentConfiguration
}

export async function updateConfiguration(
  id: string,
  formData: {
    name: string
    email_address: string
    match_criteria: string
    extraction_fields: string
    analyze_attachments: boolean
    follow_links: boolean
    button_text_pattern?: string
    user_intent?: string
    link_selection_guidance?: string
    max_links_to_scrape?: number
    content_retrieval_strategy?: 'scrape_only' | 'scrape_and_search' | 'search_only'
    extraction_examples?: string
    analysis_feedback?: string
  }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  // Check if name already exists for this user (excluding current config)
  const { data: existing } = await supabase
    .from('agent_configurations')
    .select('id')
    .eq('user_id', user.id)
    .eq('name', formData.name)
    .neq('id', id)
    .single()

  if (existing) {
    throw new Error('An agent configuration with this name already exists')
  }

  const { data, error } = await supabase
    .from('agent_configurations')
    .update({
      name: formData.name,
      email_address: formData.email_address,
      match_criteria: formData.match_criteria,
      extraction_fields: formData.extraction_fields,
      analyze_attachments: formData.analyze_attachments,
      follow_links: formData.follow_links,
      button_text_pattern: formData.button_text_pattern || null,
      user_intent: formData.user_intent || null,
      link_selection_guidance: formData.link_selection_guidance || null,
      max_links_to_scrape: formData.max_links_to_scrape ?? 10,
      content_retrieval_strategy: formData.content_retrieval_strategy || 'scrape_only',
      extraction_examples: formData.extraction_examples || null,
      analysis_feedback: formData.analysis_feedback || null,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('Error updating configuration:', error)
    // Check for unique constraint violation
    if (error.code === '23505') {
      throw new Error('An agent configuration with this name already exists')
    }
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

