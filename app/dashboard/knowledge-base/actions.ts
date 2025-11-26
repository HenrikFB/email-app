'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ProcessingConfig } from '@/lib/document-processing/client'

export interface KnowledgeBase {
  id: string
  user_id: string
  name: string
  description: string | null
  type: 'manual' | 'saved_emails' | 'saved_scraped_urls'
  optimization_context: string | null
  is_dynamic: boolean
  document_count: number
  total_chunks: number
  created_at: string
  updated_at: string
  // New fields for document upload configuration
  default_processing_config: ProcessingConfig | null
  auto_save_uploads: boolean
}

export interface CreateKnowledgeBaseInput {
  name: string
  description?: string
  type: 'manual' | 'saved_emails' | 'saved_scraped_urls'
  optimization_context?: string
  is_dynamic?: boolean
  default_processing_config?: ProcessingConfig
  auto_save_uploads?: boolean
}

/**
 * Create a new knowledge base
 */
export async function createKnowledgeBase(
  input: CreateKnowledgeBaseInput
): Promise<{ success: boolean; data?: KnowledgeBase; error?: string }> {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }
    
    const { data, error } = await supabase
      .from('knowledge_bases')
      .insert({
        user_id: user.id,
        name: input.name,
        description: input.description || null,
        type: input.type,
        optimization_context: input.optimization_context || null,
        is_dynamic: input.is_dynamic || false,
        default_processing_config: input.default_processing_config || null,
        auto_save_uploads: input.auto_save_uploads !== undefined ? input.auto_save_uploads : true,
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error creating knowledge base:', error)
      return { success: false, error: error.message }
    }
    
    revalidatePath('/dashboard/knowledge-base')
    
    return { success: true, data }
  } catch (error) {
    console.error('Error creating knowledge base:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Update a knowledge base
 */
export async function updateKnowledgeBase(
  id: string,
  updates: Partial<Omit<CreateKnowledgeBaseInput, 'type'>>
): Promise<{ success: boolean; data?: KnowledgeBase; error?: string }> {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }
    
    const { data, error } = await supabase
      .from('knowledge_bases')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()
    
    if (error) {
      console.error('Error updating knowledge base:', error)
      return { success: false, error: error.message }
    }
    
    revalidatePath('/dashboard/knowledge-base')
    
    return { success: true, data }
  } catch (error) {
    console.error('Error updating knowledge base:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Delete a knowledge base (cascades to documents and chunks)
 */
export async function deleteKnowledgeBase(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }
    
    const { error } = await supabase
      .from('knowledge_bases')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    
    if (error) {
      console.error('Error deleting knowledge base:', error)
      return { success: false, error: error.message }
    }
    
    revalidatePath('/dashboard/knowledge-base')
    
    return { success: true }
  } catch (error) {
    console.error('Error deleting knowledge base:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * List all knowledge bases for current user
 */
export async function listKnowledgeBases(): Promise<{
  success: boolean
  data?: KnowledgeBase[]
  error?: string
}> {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }
    
    const { data, error } = await supabase
      .from('knowledge_bases')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error listing knowledge bases:', error)
      return { success: false, error: error.message }
    }
    
    return { success: true, data: data || [] }
  } catch (error) {
    console.error('Error listing knowledge bases:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get a single knowledge base by ID
 */
export async function getKnowledgeBase(
  id: string
): Promise<{ success: boolean; data?: KnowledgeBase; error?: string }> {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }
    
    const { data, error } = await supabase
      .from('knowledge_bases')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    
    if (error) {
      console.error('Error getting knowledge base:', error)
      return { success: false, error: error.message }
    }
    
    return { success: true, data }
  } catch (error) {
    console.error('Error getting knowledge base:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Assign knowledge bases to an agent configuration
 */
export async function assignKBsToAgentConfig(
  agentConfigId: string,
  kbIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }
    
    // Verify agent config belongs to user
    const { data: agentConfig } = await supabase
      .from('agent_configurations')
      .select('id')
      .eq('id', agentConfigId)
      .eq('user_id', user.id)
      .single()
    
    if (!agentConfig) {
      return { success: false, error: 'Agent configuration not found' }
    }
    
    // Delete existing assignments
    await supabase
      .from('agent_kb_assignments')
      .delete()
      .eq('agent_configuration_id', agentConfigId)
    
    // Insert new assignments
    if (kbIds.length > 0) {
      const assignments = kbIds.map((kbId) => ({
        agent_configuration_id: agentConfigId,
        knowledge_base_id: kbId,
      }))
      
      const { error } = await supabase
        .from('agent_kb_assignments')
        .insert(assignments)
      
      if (error) {
        console.error('Error assigning KBs:', error)
        return { success: false, error: error.message }
      }
    }
    
    revalidatePath('/dashboard')
    
    return { success: true }
  } catch (error) {
    console.error('Error assigning KBs to agent config:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get KBs assigned to an agent configuration
 */
export async function getAssignedKBs(
  agentConfigId: string
): Promise<{ success: boolean; data?: string[]; error?: string }> {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('agent_kb_assignments')
      .select('knowledge_base_id')
      .eq('agent_configuration_id', agentConfigId)
    
    if (error) {
      console.error('Error getting assigned KBs:', error)
      return { success: false, error: error.message }
    }
    
    const kbIds = data?.map((row) => row.knowledge_base_id) || []
    
    return { success: true, data: kbIds }
  } catch (error) {
    console.error('Error getting assigned KBs:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

