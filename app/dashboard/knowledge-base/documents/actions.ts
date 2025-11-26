'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { embedDocument } from '@/lib/embeddings/service'
import { processDocument as processDocumentFile, downloadFile, deleteFile as deleteStorageFile } from '@/lib/document-processing'
import type { ProcessingConfig } from '@/lib/document-processing/client'

export interface KBDocument {
  id: string
  user_id: string
  knowledge_base_id: string
  title: string
  type: 'text_note' | 'saved_email' | 'saved_url' | 'uploaded_document'
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
  // New fields for uploaded documents
  file_path: string | null
  file_type: string | null
  file_size: number | null
  original_filename: string | null
  processing_config: ProcessingConfig | null
  processing_status: 'pending' | 'processing' | 'completed' | 'failed' | 'ready_for_review' | null
  processing_error: string | null
  processed_at: string | null
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
 * Also deletes file from storage if it's an uploaded document
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
    
    // Get document details including file path
    const { data: doc } = await supabase
      .from('kb_documents')
      .select('knowledge_base_id, file_path')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    
    if (!doc) {
      return { success: false, error: 'Document not found' }
    }
    
    // Delete from database first
    const { error } = await supabase
      .from('kb_documents')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    
    if (error) {
      console.error('Error deleting document:', error)
      return { success: false, error: error.message }
    }
    
    // Delete file from storage if it exists
    if (doc.file_path) {
      try {
        await deleteStorageFile(doc.file_path)
      } catch (storageError) {
        console.error('Error deleting file from storage:', storageError)
        // Don't fail the whole operation if storage delete fails
      }
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

// ============================================
// UPLOADED DOCUMENT ACTIONS
// ============================================

export interface CreatePendingDocumentInput {
  knowledgeBaseId: string
  filename: string
  filePath: string
  fileSize: number
  fileType: string
  processingConfig?: ProcessingConfig
  title?: string
  notes?: string
  context_tags?: string[]
}

/**
 * Create pending documents after upload (batch operation)
 * Documents are created with 'pending' status and will be processed separately
 */
export async function createPendingDocuments(
  inputs: CreatePendingDocumentInput[]
): Promise<{ success: boolean; documents?: KBDocument[]; error?: string }> {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }
    
    if (inputs.length === 0) {
      return { success: false, error: 'No documents provided' }
    }
    
    // Verify KB belongs to user
    const kbId = inputs[0].knowledgeBaseId
    const { data: kb } = await supabase
      .from('knowledge_bases')
      .select('id')
      .eq('id', kbId)
      .eq('user_id', user.id)
      .single()
    
    if (!kb) {
      return { success: false, error: 'Knowledge base not found' }
    }
    
    // Create all documents in batch
    const documentsToInsert = inputs.map(input => ({
      user_id: user.id,
      knowledge_base_id: input.knowledgeBaseId,
      title: input.title || input.filename,
      type: 'uploaded_document' as const,
      content: '', // Will be filled during processing
      file_path: input.filePath,
      file_type: input.fileType,
      file_size: input.fileSize,
      original_filename: input.filename,
      processing_config: input.processingConfig || null,
      processing_status: 'pending' as const,
      notes: input.notes || null,
      context_tags: input.context_tags || null,
    }))
    
    const { data: documents, error: insertError } = await supabase
      .from('kb_documents')
      .insert(documentsToInsert)
      .select()
    
    if (insertError) {
      console.error('Error creating pending documents:', insertError)
      return { success: false, error: insertError.message }
    }
    
    revalidatePath(`/dashboard/knowledge-base/${kbId}`)
    
    return { success: true, documents: documents || [] }
  } catch (error) {
    console.error('Error creating pending documents:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Process a single uploaded document
 * Downloads from storage, extracts content, optionally embeds
 */
export async function processDocument(
  documentId: string,
  autoEmbed: boolean = true
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }
    
    // Get document
    const { data: doc } = await supabase
      .from('kb_documents')
      .select('*, knowledge_bases(default_processing_config)')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()
    
    if (!doc) {
      return { success: false, error: 'Document not found' }
    }
    
    if (!doc.file_path || !doc.file_type) {
      return { success: false, error: 'Document has no file attached' }
    }
    
    // Update status to processing
    await supabase
      .from('kb_documents')
      .update({ processing_status: 'processing' })
      .eq('id', documentId)
    
    try {
      // Download file from storage
      const downloadResult = await downloadFile(doc.file_path)
      
      if (!downloadResult.success || !downloadResult.data) {
        throw new Error(downloadResult.error || 'Failed to download file')
      }
      
      const fileBuffer = downloadResult.data
      
      // Get KB default config
      const kbConfig = (doc.knowledge_bases as any)?.default_processing_config as ProcessingConfig | null
      
      // Process document with merged configuration
      const result = await processDocumentFile({
        fileBuffer,
        mimeType: doc.file_type,
        filename: doc.original_filename || 'document',
        processingConfig: doc.processing_config || undefined,
        kbDefaultConfig: kbConfig || undefined,
      })
      
      // Update document with extracted content
      const updateData: any = {
        content: result.content,
        char_count: result.content.length,
        processing_status: autoEmbed ? 'completed' : 'ready_for_review',
        processed_at: new Date().toISOString(),
        processing_error: null,
      }
      
      await supabase
        .from('kb_documents')
        .update(updateData)
        .eq('id', documentId)
      
      // Generate embeddings if auto-embed is enabled
      if (autoEmbed) {
        try {
          await embedDocument(
            documentId,
            result.content,
            doc.knowledge_base_id,
            user.id
          )
        } catch (embedError) {
          console.error('Error generating embeddings:', embedError)
          // Mark as ready_for_review if embedding fails
          await supabase
            .from('kb_documents')
            .update({ processing_status: 'ready_for_review' })
            .eq('id', documentId)
        }
      }
      
      revalidatePath(`/dashboard/knowledge-base/${doc.knowledge_base_id}`)
      
      return { success: true }
    } catch (processingError) {
      // Update document with error
      await supabase
        .from('kb_documents')
        .update({
          processing_status: 'failed',
          processing_error: processingError instanceof Error ? processingError.message : 'Unknown error',
        })
        .eq('id', documentId)
      
      throw processingError
    }
  } catch (error) {
    console.error('Error processing document:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Process multiple documents in batch
 */
export async function processDocumentBatch(
  documentIds: string[],
  autoSave: boolean
): Promise<{ 
  success: boolean
  results?: Array<{ id: string; success: boolean; error?: string }>
  error?: string 
}> {
  try {
    if (documentIds.length === 0) {
      return { success: false, error: 'No documents provided' }
    }
    
    const results = await Promise.allSettled(
      documentIds.map(id => processDocument(id, autoSave))
    )
    
    const formattedResults = results.map((result, index) => ({
      id: documentIds[index],
      success: result.status === 'fulfilled' && result.value.success,
      error: result.status === 'rejected' 
        ? result.reason?.message 
        : result.status === 'fulfilled' && !result.value.success
          ? result.value.error
          : undefined,
    }))
    
    const allSucceeded = formattedResults.every(r => r.success)
    
    return { 
      success: allSucceeded, 
      results: formattedResults,
      error: allSucceeded ? undefined : 'Some documents failed to process'
    }
  } catch (error) {
    console.error('Error processing document batch:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Reprocess an uploaded document with new configuration
 * Useful when user wants to extract different pages or change settings
 */
export async function reprocessDocument(
  documentId: string,
  newConfig?: ProcessingConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }
    
    // Update config if provided
    if (newConfig) {
      await supabase
        .from('kb_documents')
        .update({ processing_config: newConfig })
        .eq('id', documentId)
        .eq('user_id', user.id)
    }
    
    // Delete existing chunks
    await supabase
      .from('kb_chunks')
      .delete()
      .eq('document_id', documentId)
    
    // Reprocess
    return await processDocument(documentId, true)
  } catch (error) {
    console.error('Error reprocessing document:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Update document content after review
 * Used when user edits extracted content before finalizing
 */
export async function updateDocumentContent(
  documentId: string,
  content: string,
  triggerEmbed: boolean = true
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }
    
    // Get document
    const { data: doc } = await supabase
      .from('kb_documents')
      .select('knowledge_base_id')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()
    
    if (!doc) {
      return { success: false, error: 'Document not found' }
    }
    
    // Update content
    await supabase
      .from('kb_documents')
      .update({
        content,
        char_count: content.length,
        processing_status: triggerEmbed ? 'completed' : 'ready_for_review',
      })
      .eq('id', documentId)
    
    // Regenerate embeddings if requested
    if (triggerEmbed) {
      // Delete old chunks
      await supabase
        .from('kb_chunks')
        .delete()
        .eq('document_id', documentId)
      
      // Generate new embeddings
      await embedDocument(documentId, content, doc.knowledge_base_id, user.id)
    }
    
    revalidatePath(`/dashboard/knowledge-base/${doc.knowledge_base_id}`)
    
    return { success: true }
  } catch (error) {
    console.error('Error updating document content:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

