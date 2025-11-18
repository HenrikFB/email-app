'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { embedDocument } from '@/lib/embeddings/service'

export interface KBDocument {
  id: string
  user_id: string
  knowledge_base_id: string
  title: string
  type: 'text_note' | 'saved_email' | 'saved_url'
  content: string
  analyzed_email_id: string | null
  source_url: string | null
  notes: string | null
  optimization_hints: string | null
  extraction_guidelines: string | null
  context_tags: string[] | null
  chunk_count: number
  char_count: number
  created_at: string
  updated_at: string
}

export interface CreateTextNoteInput {
  knowledgeBaseId: string
  title: string
  content: string
  notes?: string
  optimization_hints?: string
  extraction_guidelines?: string
  context_tags?: string[]
}

/**
 * Create a text note in a knowledge base
 * Automatically generates embeddings
 */
export async function createTextNote(
  input: CreateTextNoteInput
): Promise<{ success: boolean; data?: KBDocument; error?: string }> {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }
    
    // Verify KB belongs to user
    const { data: kb } = await supabase
      .from('knowledge_bases')
      .select('id')
      .eq('id', input.knowledgeBaseId)
      .eq('user_id', user.id)
      .single()
    
    if (!kb) {
      return { success: false, error: 'Knowledge base not found' }
    }
    
    // Create document
    const { data: document, error: docError } = await supabase
      .from('kb_documents')
      .insert({
        user_id: user.id,
        knowledge_base_id: input.knowledgeBaseId,
        title: input.title,
        type: 'text_note',
        content: input.content,
        notes: input.notes || null,
        optimization_hints: input.optimization_hints || null,
        extraction_guidelines: input.extraction_guidelines || null,
        context_tags: input.context_tags || null,
      })
      .select()
      .single()
    
    if (docError) {
      console.error('Error creating document:', docError)
      return { success: false, error: docError.message }
    }
    
    // Generate embeddings in background
    try {
      await embedDocument(
        document.id,
        input.content,
        input.knowledgeBaseId,
        user.id
      )
    } catch (embedError) {
      console.error('Error generating embeddings:', embedError)
      // Don't fail the request, embeddings can be regenerated
    }
    
    revalidatePath(`/dashboard/knowledge-base/${input.knowledgeBaseId}`)
    
    return { success: true, data: document }
  } catch (error) {
    console.error('Error creating text note:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Update a document
 * Re-generates embeddings if content changed
 */
export async function updateDocument(
  id: string,
  updates: {
    title?: string
    content?: string
    notes?: string
    optimization_hints?: string
    extraction_guidelines?: string
    context_tags?: string[]
  }
): Promise<{ success: boolean; data?: KBDocument; error?: string }> {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }
    
    // Get existing document
    const { data: existingDoc } = await supabase
      .from('kb_documents')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    
    if (!existingDoc) {
      return { success: false, error: 'Document not found' }
    }
    
    // Update document
    const { data: document, error: updateError } = await supabase
      .from('kb_documents')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()
    
    if (updateError) {
      console.error('Error updating document:', updateError)
      return { success: false, error: updateError.message }
    }
    
    // If content changed, regenerate embeddings
    if (updates.content && updates.content !== existingDoc.content) {
      try {
        // Delete old chunks
        await supabase
          .from('kb_chunks')
          .delete()
          .eq('document_id', id)
        
        // Generate new embeddings
        await embedDocument(
          id,
          updates.content,
          existingDoc.knowledge_base_id,
          user.id
        )
      } catch (embedError) {
        console.error('Error regenerating embeddings:', embedError)
      }
    }
    
    revalidatePath(`/dashboard/knowledge-base/${existingDoc.knowledge_base_id}`)
    
    return { success: true, data: document }
  } catch (error) {
    console.error('Error updating document:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Delete a document (cascades to chunks)
 */
export async function deleteDocument(
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
    
    // Get KB ID for revalidation
    const { data: doc } = await supabase
      .from('kb_documents')
      .select('knowledge_base_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    
    if (!doc) {
      return { success: false, error: 'Document not found' }
    }
    
    const { error } = await supabase
      .from('kb_documents')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    
    if (error) {
      console.error('Error deleting document:', error)
      return { success: false, error: error.message }
    }
    
    revalidatePath(`/dashboard/knowledge-base/${doc.knowledge_base_id}`)
    
    return { success: true }
  } catch (error) {
    console.error('Error deleting document:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * List documents in a knowledge base
 */
export async function listDocuments(
  knowledgeBaseId: string
): Promise<{ success: boolean; data?: KBDocument[]; error?: string }> {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }
    
    const { data, error } = await supabase
      .from('kb_documents')
      .select('*')
      .eq('knowledge_base_id', knowledgeBaseId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error listing documents:', error)
      return { success: false, error: error.message }
    }
    
    return { success: true, data: data || [] }
  } catch (error) {
    console.error('Error listing documents:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get a single document by ID
 */
export async function getDocument(
  id: string
): Promise<{ success: boolean; data?: KBDocument; error?: string }> {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }
    
    const { data, error } = await supabase
      .from('kb_documents')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    
    if (error) {
      console.error('Error getting document:', error)
      return { success: false, error: error.message }
    }
    
    return { success: true, data }
  } catch (error) {
    console.error('Error getting document:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

