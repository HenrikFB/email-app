/**
 * Embedding service for semantic search
 * Uses OpenAI text-embedding-3-small (1536 dimensions)
 */

import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/**
 * Generate embedding for text using OpenAI
 * @param text - Text to embed (max 8000 chars)
 * @returns Array of 1536 numbers (embedding vector)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Truncate to 8000 chars (~8k tokens) to stay within limits
    const truncatedText = text.substring(0, 8000)
    
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: truncatedText,
    })
    
    return response.data[0].embedding
  } catch (error) {
    console.error('Error generating embedding:', error)
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Chunk text into smaller pieces for embedding
 * @param text - Text to chunk
 * @param chunkSize - Size of each chunk in characters (default 1000)
 * @returns Array of text chunks
 */
export function chunkText(text: string, chunkSize: number = 1000): string[] {
  if (!text || text.length === 0) {
    return []
  }
  
  const chunks: string[] = []
  
  // Split by paragraphs first
  const paragraphs = text.split(/\n\n+/)
  
  let currentChunk = ''
  
  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed chunk size
    if (currentChunk.length + paragraph.length > chunkSize) {
      // Save current chunk if it has content
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim())
        currentChunk = ''
      }
      
      // If paragraph itself is too long, split it
      if (paragraph.length > chunkSize) {
        for (let i = 0; i < paragraph.length; i += chunkSize) {
          chunks.push(paragraph.substring(i, i + chunkSize).trim())
        }
      } else {
        currentChunk = paragraph
      }
    } else {
      currentChunk += (currentChunk.length > 0 ? '\n\n' : '') + paragraph
    }
  }
  
  // Add remaining chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim())
  }
  
  return chunks.filter(chunk => chunk.length > 0)
}

/**
 * Embed a document by chunking and storing embeddings
 * @param documentId - UUID of the document
 * @param content - Full text content
 * @param kbId - Knowledge base ID
 * @param userId - User ID
 */
export async function embedDocument(
  documentId: string,
  content: string,
  kbId: string,
  userId: string
): Promise<void> {
  const supabase = await createClient()
  
  try {
    console.log(`📝 Embedding document ${documentId}...`)
    
    // Chunk the content
    const chunks = chunkText(content)
    console.log(`   Split into ${chunks.length} chunks`)
    
    // Generate embeddings for each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const embedding = await generateEmbedding(chunk)
      
      // Store chunk with embedding
      const { error } = await supabase
        .from('kb_chunks')
        .insert({
          user_id: userId,
          knowledge_base_id: kbId,
          document_id: documentId,
          content: chunk,
          chunk_index: i,
          char_count: chunk.length,
          embedding: embedding
        })
      
      if (error) {
        console.error(`   ❌ Error storing chunk ${i}:`, error)
        throw error
      }
      
      console.log(`   ✅ Chunk ${i + 1}/${chunks.length} embedded`)
    }
    
    // Update document with chunk count
    await supabase
      .from('kb_documents')
      .update({
        chunk_count: chunks.length,
        char_count: content.length
      })
      .eq('id', documentId)
    
    console.log(`✅ Document embedded successfully: ${chunks.length} chunks`)
  } catch (error) {
    console.error('Error embedding document:', error)
    throw error
  }
}

/**
 * Search knowledge bases using semantic similarity
 * @param query - Search query
 * @param userId - User ID
 * @param kbIds - Optional array of KB IDs to search (null = search all)
 * @param limit - Max results to return (default 10)
 * @param matchThreshold - Similarity threshold (default 0.3)
 * @param debugRunId - Optional debug run ID for logging
 * @returns Array of search results with similarity scores
 */
export async function searchKnowledgeBases(
  query: string,
  userId: string,
  kbIds?: string[] | null,
  limit: number = 10,
  matchThreshold: number = 0.3,
  debugRunId?: string
) {
  const supabase = await createClient()
  
  try {
    console.log('\n' + '═'.repeat(70))
    console.log('🔍 KNOWLEDGE BASE SEARCH')
    console.log('═'.repeat(70))
    console.log(`📝 Query: "${query}"`)
    console.log(`📊 Query length: ${query.length} characters`)
    console.log(`🎯 Similarity threshold: ${matchThreshold} (${(matchThreshold * 100).toFixed(0)}%)`)
    console.log(`📋 Result limit: ${limit}`)
    console.log(`🗂️  KBs to search: ${kbIds && kbIds.length > 0 ? kbIds.length + ' specific KB(s)' : 'All KBs'}`)
    
    // Get KB names if KB IDs provided
    let kbNames: string[] = []
    if (kbIds && kbIds.length > 0) {
      const { data: kbs } = await supabase
        .from('knowledge_bases')
        .select('id, name')
        .in('id', kbIds)
        .eq('user_id', userId)
      
      kbNames = kbs?.map(kb => kb.name) || []
      console.log(`📚 KB Names: ${kbNames.join(', ') || 'N/A'}`)
    }
    
    console.log('─'.repeat(70))
    console.log('🗄️  Database Query:')
    console.log(`   Table: kb_chunks`)
    console.log(`   RPC Function: hybrid_search_knowledge_base`)
    console.log(`   Fields searched: content, embedding, document_id, chunk_index, char_count`)
    console.log(`   Filter: user_id = ${userId}`)
    if (kbIds && kbIds.length > 0) {
      console.log(`   KB filter: ${kbIds.length} KB ID(s)`)
    }
    console.log(`   Similarity filter: > ${matchThreshold}`)
    console.log('─'.repeat(70))
    
    // Generate embedding for query
    console.log('🧮 Generating query embedding...')
    const queryEmbedding = await generateEmbedding(query)
    console.log(`   ✅ Embedding generated: ${queryEmbedding.length} dimensions`)
    
    // Call PostgreSQL function for TRUE hybrid search (keyword + semantic with RRF)
    console.log('🔎 Executing hybrid search RPC (keyword + semantic)...')
    const { data, error } = await supabase.rpc('hybrid_search_knowledge_base', {
      query_embedding: queryEmbedding,
      query_text: query,
      search_user_id: userId,
      kb_ids: kbIds || null,
      match_threshold: matchThreshold,
      match_count: limit,
      full_text_weight: 1.0,  // Equal weight for keyword matches
      semantic_weight: 1.0,   // Equal weight for semantic matches
      rrf_k: 50               // RRF smoothing constant
    })
    
    if (error) {
      console.error('❌ Search error:', error)
      throw error
    }
    
    const results = data || []
    const similarities: number[] = results.map((r: { similarity?: number }) => r.similarity || 0)
    const minSim = similarities.length > 0 ? Math.min(...similarities) : 0
    const maxSim = similarities.length > 0 ? Math.max(...similarities) : 0
    const avgSim = similarities.length > 0 
      ? similarities.reduce((a: number, b: number) => a + b, 0) / similarities.length 
      : 0
    
    console.log('─'.repeat(70))
    console.log(`✅ Search complete: ${results.length} results found`)
    if (results.length > 0) {
      console.log(`   Similarity range: ${(minSim * 100).toFixed(1)}% - ${(maxSim * 100).toFixed(1)}%`)
      console.log(`   Average similarity: ${(avgSim * 100).toFixed(1)}%`)
    }
    console.log('═'.repeat(70) + '\n')
    
    // Log to debug folder if enabled
    if (debugRunId) {
      const { logKBResults, logDatabaseQueries, logKBSelection, logEmbeddingGeneration } = await import('./search-debug-logger')
      
      logKBSelection(debugRunId, kbIds, kbNames)
      logDatabaseQueries(debugRunId, {
        table: 'kb_chunks',
        rpcFunction: 'hybrid_search_knowledge_base',
        fields: ['content', 'embedding', 'document_id', 'chunk_index', 'char_count'],
        kbIds
      }, {
        table: 'analyzed_email_embeddings',
        rpcFunction: 'search_analyzed_emails',
        fields: ['embedded_text', 'embedding', 'content_type', 'source_url']
      })
      logEmbeddingGeneration(debugRunId, queryEmbedding)
      logKBResults(debugRunId, results)
    }
    
    return results
  } catch (error) {
    console.error('❌ Error searching knowledge bases:', error)
    throw error
  }
}

/**
 * Search analyzed emails using semantic similarity
 * @param query - Search query
 * @param userId - User ID
 * @param limit - Max results to return (default 10)
 * @param matchThreshold - Similarity threshold (default 0.3)
 * @param debugRunId - Optional debug run ID for logging
 * @returns Array of similar emails with similarity scores
 */
export async function searchAnalyzedEmails(
  query: string,
  userId: string,
  limit: number = 10,
  matchThreshold: number = 0.3,
  debugRunId?: string
) {
  const supabase = await createClient()
  
  try {
    console.log('\n' + '═'.repeat(70))
    console.log('📧 ANALYZED EMAIL SEARCH')
    console.log('═'.repeat(70))
    console.log(`📝 Query: "${query}"`)
    console.log(`📊 Query length: ${query.length} characters`)
    console.log(`🎯 Similarity threshold: ${matchThreshold} (${(matchThreshold * 100).toFixed(0)}%)`)
    console.log(`📋 Result limit: ${limit}`)
    console.log('─'.repeat(70))
    console.log('🗄️  Database Query:')
    console.log(`   Table: analyzed_email_embeddings`)
    console.log(`   RPC Function: search_analyzed_emails`)
    console.log(`   Fields searched: embedded_text, embedding, content_type, source_url, analyzed_email_id`)
    console.log(`   Filter: user_id = ${userId}`)
    console.log(`   Similarity filter: > ${matchThreshold}`)
    console.log('─'.repeat(70))
    
    // Generate embedding for query
    console.log('🧮 Generating query embedding...')
    const queryEmbedding = await generateEmbedding(query)
    console.log(`   ✅ Embedding generated: ${queryEmbedding.length} dimensions`)
    
    // Call PostgreSQL function for TRUE hybrid search
    console.log('🔎 Executing email search RPC (keyword + semantic)...')
    const { data, error } = await supabase.rpc('search_analyzed_emails', {
      query_embedding: queryEmbedding,
      search_user_id: userId,
      match_threshold: matchThreshold,
      match_count: limit,
      query_text: query,        // Now passed for full-text search
      full_text_weight: 1.0,
      semantic_weight: 1.0,
      rrf_k: 50
    })
    
    if (error) {
      console.error('❌ Search error:', error)
      throw error
    }
    
    const results = data || []
    const similarities: number[] = results.map((r: { similarity?: number }) => r.similarity || 0)
    const minSim = similarities.length > 0 ? Math.min(...similarities) : 0
    const maxSim = similarities.length > 0 ? Math.max(...similarities) : 0
    const avgSim = similarities.length > 0 
      ? similarities.reduce((a: number, b: number) => a + b, 0) / similarities.length 
      : 0
    
    console.log('─'.repeat(70))
    console.log(`✅ Search complete: ${results.length} emails found`)
    if (results.length > 0) {
      console.log(`   Similarity range: ${(minSim * 100).toFixed(1)}% - ${(maxSim * 100).toFixed(1)}%`)
      console.log(`   Average similarity: ${(avgSim * 100).toFixed(1)}%`)
    }
    console.log('═'.repeat(70) + '\n')
    
    // Log to debug folder if enabled
    if (debugRunId) {
      const { logEmailResults } = await import('./search-debug-logger')
      logEmailResults(debugRunId, results)
    }
    
    return results
  } catch (error) {
    console.error('❌ Error searching analyzed emails:', error)
    throw error
  }
}

/**
 * Generate and store embeddings for an analyzed email
 * Called when user saves email from results page
 * @param emailId - Analyzed email ID
 * @param extractedData - The extracted data object
 * @param dataBySource - Array of data by source
 * @param userId - User ID
 */
export async function embedAnalyzedEmail(
  emailId: string,
  extractedData: Record<string, any>,
  dataBySource: Array<{source: string; data: any; reasoning: string; confidence: number}>,
  userId: string
): Promise<void> {
  const supabase = await createClient()
  
  try {
    console.log(`📧 Embedding analyzed email ${emailId}...`)
    
    // 1. Embed extracted data (all fields combined)
    const extractedText = JSON.stringify(extractedData, null, 2)
    const extractedEmbedding = await generateEmbedding(extractedText)
    
    const { error: extractedError } = await supabase
      .from('analyzed_email_embeddings')
      .insert({
        analyzed_email_id: emailId,
        user_id: userId,
        content_type: 'extracted_data',
        embedded_text: extractedText,
        embedding: extractedEmbedding
      })
    
    if (extractedError) {
      console.error('Error storing extracted data embedding:', extractedError)
      throw extractedError
    }
    
    console.log('   ✅ Extracted data embedded')
    
    // 2. Embed each scraped URL's data
    for (let i = 0; i < dataBySource.length; i++) {
      const source = dataBySource[i]
      
      // Skip email itself (only embed scraped URLs)
      if (source.source === 'Email') continue
      
      const sourceText = `${JSON.stringify(source.data, null, 2)}\n\nReasoning: ${source.reasoning}`
      const sourceEmbedding = await generateEmbedding(sourceText)
      
      const { error: sourceError } = await supabase
        .from('analyzed_email_embeddings')
        .insert({
          analyzed_email_id: emailId,
          user_id: userId,
          content_type: 'scraped_url',
          source_url: source.source,
          source_index: i,
          embedded_text: sourceText,
          embedding: sourceEmbedding
        })
      
      if (sourceError) {
        console.error(`Error storing URL embedding ${i}:`, sourceError)
        throw sourceError
      }
      
      console.log(`   ✅ URL ${i + 1} embedded: ${source.source.substring(0, 50)}...`)
    }
    
    console.log(`✅ Email embeddings complete`)
  } catch (error) {
    console.error('Error embedding analyzed email:', error)
    throw error
  }
}

/**
 * Get relevant KB context for RAG
 * Used during email analysis to provide examples to AI
 * @param query - Search query (e.g., email subject + snippet)
 * @param userId - User ID
 * @param kbIds - KB IDs assigned to agent config
 * @param limit - Number of examples to retrieve (default 5)
 * @returns Formatted context string for inclusion in AI prompt
 */
export async function getKBContextForRAG(
  query: string,
  userId: string,
  kbIds: string[],
  limit: number = 5,
  matchThreshold: number = 0.6
): Promise<string> {
  if (!kbIds || kbIds.length === 0) {
    return ''
  }
  
  try {
    const results = await searchKnowledgeBases(query, userId, kbIds, limit, matchThreshold)
    
    if (!results || results.length === 0) {
      return ''
    }
    
    // Format results as context
    let context = '\n\n## Reference Examples (from knowledge base)\n\n'
    context += 'Here are similar examples from your knowledge base that may guide your extraction:\n\n'
    
    results.forEach((result: any, idx: number) => {
      context += `### Example ${idx + 1} (${Math.round(result.similarity * 100)}% similar)\n`
      context += `From: "${result.document_title}" in ${result.kb_name}\n`
      context += `Content:\n${result.content.substring(0, 500)}${result.content.length > 500 ? '...' : ''}\n\n`
    })
    
    return context
  } catch (error) {
    console.error('Error getting KB context for RAG:', error)
    return '' // Fail gracefully
  }
}

