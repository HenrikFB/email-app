'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Draft type for client-side use
 */
export type GeneratedDraft = {
  id: string
  user_id: string
  analyzed_email_id: string | null
  agent_configuration_id: string | null
  draft_content: string
  kb_sources_used: Array<{
    documentId: string
    documentTitle: string
    snippetUsed: string
  }>
  generation_metadata: {
    reasoning: string
    iterations: number
    searchQueries: string[]
    confidence: number
    modelUsed: string
    processingTimeMs: number
    webSourcesSearched: string[]
  }
  created_at: string
  updated_at: string
  // Joined fields
  email_subject?: string
  agent_name?: string
}

/**
 * Get all drafts for the current user
 */
export async function getDrafts(): Promise<GeneratedDraft[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('generated_drafts')
    .select(`
      *,
      analyzed_emails:analyzed_email_id(email_subject),
      agent_configurations:agent_configuration_id(name)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching drafts:', error)
    throw new Error('Failed to fetch drafts')
  }

  // Transform the data to include joined fields
  return (data || []).map(draft => ({
    id: draft.id,
    user_id: draft.user_id,
    analyzed_email_id: draft.analyzed_email_id,
    agent_configuration_id: draft.agent_configuration_id,
    draft_content: draft.draft_content,
    kb_sources_used: draft.kb_sources_used || [],
    generation_metadata: draft.generation_metadata || {},
    created_at: draft.created_at,
    updated_at: draft.updated_at,
    email_subject: draft.analyzed_emails?.email_subject,
    agent_name: draft.agent_configurations?.name,
  }))
}

/**
 * Get a single draft by ID
 */
export async function getDraft(id: string): Promise<GeneratedDraft | null> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('generated_drafts')
    .select(`
      *,
      analyzed_emails:analyzed_email_id(email_subject),
      agent_configurations:agent_configuration_id(name)
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error fetching draft:', error)
    throw new Error('Failed to fetch draft')
  }

  return {
    id: data.id,
    user_id: data.user_id,
    analyzed_email_id: data.analyzed_email_id,
    agent_configuration_id: data.agent_configuration_id,
    draft_content: data.draft_content,
    kb_sources_used: data.kb_sources_used || [],
    generation_metadata: data.generation_metadata || {},
    created_at: data.created_at,
    updated_at: data.updated_at,
    email_subject: data.analyzed_emails?.email_subject,
    agent_name: data.agent_configurations?.name,
  }
}

/**
 * Get drafts for a specific email
 */
export async function getDraftsForEmail(analyzedEmailId: string): Promise<GeneratedDraft[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('generated_drafts')
    .select(`
      *,
      analyzed_emails:analyzed_email_id(email_subject),
      agent_configurations:agent_configuration_id(name)
    `)
    .eq('user_id', user.id)
    .eq('analyzed_email_id', analyzedEmailId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching drafts for email:', error)
    throw new Error('Failed to fetch drafts')
  }

  return (data || []).map(draft => ({
    id: draft.id,
    user_id: draft.user_id,
    analyzed_email_id: draft.analyzed_email_id,
    agent_configuration_id: draft.agent_configuration_id,
    draft_content: draft.draft_content,
    kb_sources_used: draft.kb_sources_used || [],
    generation_metadata: draft.generation_metadata || {},
    created_at: draft.created_at,
    updated_at: draft.updated_at,
    email_subject: draft.analyzed_emails?.email_subject,
    agent_name: draft.agent_configurations?.name,
  }))
}

/**
 * Save a new draft
 */
export async function saveDraft(draft: {
  analyzed_email_id?: string
  agent_configuration_id?: string
  draft_content: string
  kb_sources_used?: Array<{
    documentId: string
    documentTitle: string
    snippetUsed: string
  }>
  generation_metadata?: {
    reasoning?: string
    iterations?: number
    searchQueries?: string[]
    confidence?: number
    modelUsed?: string
    processingTimeMs?: number
    webSourcesSearched?: string[]
  }
}): Promise<GeneratedDraft> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('generated_drafts')
    .insert({
      user_id: user.id,
      analyzed_email_id: draft.analyzed_email_id || null,
      agent_configuration_id: draft.agent_configuration_id || null,
      draft_content: draft.draft_content,
      kb_sources_used: draft.kb_sources_used || [],
      generation_metadata: draft.generation_metadata || {},
    })
    .select()
    .single()

  if (error) {
    console.error('Error saving draft:', error)
    throw new Error('Failed to save draft')
  }

  revalidatePath('/dashboard/drafts')
  return data as GeneratedDraft
}

/**
 * Update an existing draft
 */
export async function updateDraft(
  id: string,
  updates: {
    draft_content?: string
    kb_sources_used?: Array<{
      documentId: string
      documentTitle: string
      snippetUsed: string
    }>
    generation_metadata?: Record<string, any>
  }
): Promise<GeneratedDraft> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('generated_drafts')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('Error updating draft:', error)
    throw new Error('Failed to update draft')
  }

  revalidatePath('/dashboard/drafts')
  return data as GeneratedDraft
}

/**
 * Delete a draft
 */
export async function deleteDraft(id: string): Promise<void> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { error } = await supabase
    .from('generated_drafts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting draft:', error)
    throw new Error('Failed to delete draft')
  }

  revalidatePath('/dashboard/drafts')
}

/**
 * Copy draft to clipboard
 * (Client-side helper - returns the content to copy)
 */
export async function getDraftContent(id: string): Promise<string> {
  const draft = await getDraft(id)
  if (!draft) {
    throw new Error('Draft not found')
  }
  return draft.draft_content
}

