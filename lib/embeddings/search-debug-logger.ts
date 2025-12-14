/**
 * Debug Logger for Semantic Search
 * Stores detailed search data in local folders for inspection
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

const DEBUG_ENABLED = process.env.SEARCH_DEBUG === 'true' || process.env.EMAIL_ANALYSIS_DEBUG === 'true'
const DEBUG_DIR = path.join(process.cwd(), 'debug-search-runs')

export interface SearchDebugData {
  runId: string
  query: string
  userId: string
  timestamp: string
  
  // Query details
  originalQuery: string
  processedQuery?: string
  threshold: number
  limit: number
  
  // KB selection
  kbIds?: string[] | null
  kbNames?: string[]
  
  // Database queries
  kbSearch: {
    table: string
    rpcFunction: string
    fields: string[]
    resultsCount: number
    similarityRange?: { min: number; max: number }
  }
  
  emailSearch: {
    table: string
    rpcFunction: string
    fields: string[]
    resultsCount: number
    similarityRange?: { min: number; max: number }
  }
  
  // Results
  kbResults?: any[]
  emailResults?: any[]
  
  // Embedding info
  queryEmbeddingPreview?: number[] // First 10 dimensions
}

/**
 * Initialize debug logger for a new search run
 */
export function initSearchDebugRun(
  query: string,
  userId: string,
  threshold: number,
  limit: number
): string {
  if (!DEBUG_ENABLED) return ''
  
  // Create run ID from timestamp and query hash
  const queryHash = crypto.createHash('md5').update(query).digest('hex').substring(0, 8)
  const runId = `${Date.now()}-${queryHash}`
  const runDir = path.join(DEBUG_DIR, runId)
  
  try {
    // Create debug directory if it doesn't exist
    if (!fs.existsSync(DEBUG_DIR)) {
      fs.mkdirSync(DEBUG_DIR, { recursive: true })
    }
    
    // Create run directory
    fs.mkdirSync(runDir, { recursive: true })
    
    // Create initial metadata file
    fs.writeFileSync(
      path.join(runDir, '00-metadata.json'),
      JSON.stringify({
        runId,
        query,
        userId,
        threshold,
        limit,
        timestamp: new Date().toISOString(),
        startedAt: Date.now()
      }, null, 2)
    )
    
    console.log(`\n📁 Search debug folder created: debug-search-runs/${runId}`)
  } catch (error) {
    console.error('Failed to create search debug folder:', error)
  }
  
  return runId
}

/**
 * Log query details
 */
export function logQueryDetails(
  runId: string,
  originalQuery: string,
  processedQuery?: string
): void {
  if (!DEBUG_ENABLED || !runId) return
  
  try {
    const runDir = path.join(DEBUG_DIR, runId)
    const data = {
      originalQuery,
      processedQuery: processedQuery || originalQuery,
      queryLength: originalQuery.length,
      timestamp: new Date().toISOString()
    }
    
    fs.writeFileSync(
      path.join(runDir, '01-query-details.json'),
      JSON.stringify(data, null, 2)
    )
    
    console.log(`📝 Logged query details: ${originalQuery.substring(0, 50)}...`)
  } catch (error) {
    console.error('Failed to log query details:', error)
  }
}

/**
 * Log KB selection
 */
export function logKBSelection(
  runId: string,
  kbIds: string[] | null | undefined,
  kbNames: string[]
): void {
  if (!DEBUG_ENABLED || !runId) return
  
  try {
    const runDir = path.join(DEBUG_DIR, runId)
    const data = {
      kbIds: kbIds || [],
      kbNames,
      kbCount: kbIds?.length || 0,
      searchAll: !kbIds || kbIds.length === 0,
      timestamp: new Date().toISOString()
    }
    
    fs.writeFileSync(
      path.join(runDir, '02-kb-selection.json'),
      JSON.stringify(data, null, 2)
    )
    
    console.log(`📝 Logged KB selection: ${kbNames.length} KB(s)`)
  } catch (error) {
    console.error('Failed to log KB selection:', error)
  }
}

/**
 * Log database query information
 */
export function logDatabaseQueries(
  runId: string,
  kbSearch: {
    table: string
    rpcFunction: string
    fields: string[]
    kbIds?: string[] | null
  },
  emailSearch: {
    table: string
    rpcFunction: string
    fields: string[]
  }
): void {
  if (!DEBUG_ENABLED || !runId) return
  
  try {
    const runDir = path.join(DEBUG_DIR, runId)
    const data = {
      kbSearch: {
        ...kbSearch,
        description: `Searches ${kbSearch.table} table using ${kbSearch.rpcFunction} RPC function`,
        fieldsDescription: kbSearch.fields.join(', ')
      },
      emailSearch: {
        ...emailSearch,
        description: `Searches ${emailSearch.table} table using ${emailSearch.rpcFunction} RPC function`,
        fieldsDescription: emailSearch.fields.join(', ')
      },
      timestamp: new Date().toISOString()
    }
    
    fs.writeFileSync(
      path.join(runDir, '03-database-queries.json'),
      JSON.stringify(data, null, 2)
    )
    
    console.log(`📝 Logged database queries: ${kbSearch.table}, ${emailSearch.table}`)
  } catch (error) {
    console.error('Failed to log database queries:', error)
  }
}

/**
 * Log embedding generation info
 */
export function logEmbeddingGeneration(
  runId: string,
  embedding: number[]
): void {
  if (!DEBUG_ENABLED || !runId) return
  
  try {
    const runDir = path.join(DEBUG_DIR, runId)
    const data = {
      embeddingDimensions: embedding.length,
      embeddingPreview: embedding.slice(0, 10), // First 10 dimensions
      model: 'text-embedding-3-small',
      timestamp: new Date().toISOString()
    }
    
    fs.writeFileSync(
      path.join(runDir, '04-embedding-generation.json'),
      JSON.stringify(data, null, 2)
    )
    
    console.log(`📝 Logged embedding: ${embedding.length} dimensions`)
  } catch (error) {
    console.error('Failed to log embedding generation:', error)
  }
}

/**
 * Log KB search results
 */
export function logKBResults(
  runId: string,
  results: any[]
): void {
  if (!DEBUG_ENABLED || !runId) return
  
  try {
    const runDir = path.join(DEBUG_DIR, runId)
    const similarityScores = results.map(r => r.similarity || 0)
    const data = {
      resultsCount: results.length,
      results: results.map(r => ({
        documentTitle: r.document_title,
        kbName: r.kb_name,
        similarity: r.similarity,
        contentPreview: r.content?.substring(0, 200),
        chunkIndex: r.chunk_index,
        documentId: r.document_id
      })),
      similarityStats: {
        min: similarityScores.length > 0 ? Math.min(...similarityScores) : 0,
        max: similarityScores.length > 0 ? Math.max(...similarityScores) : 0,
        avg: similarityScores.length > 0 
          ? similarityScores.reduce((a, b) => a + b, 0) / similarityScores.length 
          : 0
      },
      timestamp: new Date().toISOString()
    }
    
    fs.writeFileSync(
      path.join(runDir, '05-kb-results.json'),
      JSON.stringify(data, null, 2)
    )
    
    console.log(`📝 Logged KB results: ${results.length} matches`)
  } catch (error) {
    console.error('Failed to log KB results:', error)
  }
}

/**
 * Log email search results
 */
export function logEmailResults(
  runId: string,
  results: any[]
): void {
  if (!DEBUG_ENABLED || !runId) return
  
  try {
    const runDir = path.join(DEBUG_DIR, runId)
    const similarityScores = results.map(r => r.similarity || 0)
    const data = {
      resultsCount: results.length,
      results: results.map(r => ({
        emailSubject: r.email_subject,
        emailFrom: r.email_from,
        similarity: r.similarity,
        contentType: r.content_type,
        sourceUrl: r.source_url,
        embeddedTextPreview: r.embedded_text?.substring(0, 200),
        matched: r.matched
      })),
      similarityStats: {
        min: similarityScores.length > 0 ? Math.min(...similarityScores) : 0,
        max: similarityScores.length > 0 ? Math.max(...similarityScores) : 0,
        avg: similarityScores.length > 0 
          ? similarityScores.reduce((a, b) => a + b, 0) / similarityScores.length 
          : 0
      },
      timestamp: new Date().toISOString()
    }
    
    fs.writeFileSync(
      path.join(runDir, '06-email-results.json'),
      JSON.stringify(data, null, 2)
    )
    
    console.log(`📝 Logged email results: ${results.length} matches`)
  } catch (error) {
    console.error('Failed to log email results:', error)
  }
}

/**
 * Finalize debug run with summary
 */
export function finalizeSearchDebugRun(
  runId: string,
  debugData: Partial<SearchDebugData>
): void {
  if (!DEBUG_ENABLED || !runId) return
  
  try {
    const runDir = path.join(DEBUG_DIR, runId)
    
    // Write complete debug data
    fs.writeFileSync(
      path.join(runDir, '07-summary.json'),
      JSON.stringify({
        ...debugData,
        completedAt: Date.now(),
        timestamp: new Date().toISOString()
      }, null, 2)
    )
    
    // Write human-readable summary
    const summary = generateSearchSummary(debugData)
    fs.writeFileSync(
      path.join(runDir, 'SUMMARY.md'),
      summary
    )
    
    console.log(`\n✅ Search debug complete: debug-search-runs/${runId}`)
    console.log(`📊 View summary: debug-search-runs/${runId}/SUMMARY.md\n`)
  } catch (error) {
    console.error('Failed to finalize search debug run:', error)
  }
}

/**
 * Generate human-readable summary
 */
function generateSearchSummary(data: Partial<SearchDebugData>): string {
  const kbResults = data.kbResults || []
  const emailResults = data.emailResults || []
  const totalResults = kbResults.length + emailResults.length
  
  const kbSimilarities = kbResults.map(r => r.similarity || 0)
  const emailSimilarities = emailResults.map(r => r.similarity || 0)
  
  return `# Semantic Search Debug Summary

## Search Information
- **Run ID**: ${data.runId}
- **Query**: ${data.query}
- **Timestamp**: ${data.timestamp}
- **Similarity Threshold**: ${data.threshold ?? 0.7} (${((data.threshold ?? 0.7) * 100).toFixed(0)}%)
- **Result Limit**: ${data.limit}

## Knowledge Base Selection
- **KBs Searched**: ${data.kbNames?.length || 0}
${data.kbNames && data.kbNames.length > 0 ? data.kbNames.map(name => `  - ${name}`).join('\n') : '  - All KBs (no filter)'}
- **KB IDs**: ${data.kbIds?.join(', ') || 'All'}

## Database Queries

### Knowledge Base Search
- **Table**: \`${data.kbSearch?.table || 'kb_chunks'}\`
- **RPC Function**: \`${data.kbSearch?.rpcFunction || 'hybrid_search_knowledge_base'}\`
- **Fields Searched**: ${data.kbSearch?.fields?.join(', ') || 'content, embedding, document_id, chunk_index'}
- **Results**: ${data.kbSearch?.resultsCount || 0} matches
${data.kbSearch?.similarityRange ? `- **Similarity Range**: ${(data.kbSearch.similarityRange.min * 100).toFixed(1)}% - ${(data.kbSearch.similarityRange.max * 100).toFixed(1)}%` : ''}

### Email Search
- **Table**: \`${data.emailSearch?.table || 'analyzed_email_embeddings'}\`
- **RPC Function**: \`${data.emailSearch?.rpcFunction || 'search_analyzed_emails'}\`
- **Fields Searched**: ${data.emailSearch?.fields?.join(', ') || 'embedded_text, embedding, content_type, source_url'}
- **Results**: ${data.emailSearch?.resultsCount || 0} matches
${data.emailSearch?.similarityRange ? `- **Similarity Range**: ${(data.emailSearch.similarityRange.min * 100).toFixed(1)}% - ${(data.emailSearch.similarityRange.max * 100).toFixed(1)}%` : ''}

## Results Summary
- **Total Results**: ${totalResults}
  - KB Results: ${kbResults.length}
  - Email Results: ${emailResults.length}

### Knowledge Base Results
${kbResults.length > 0 ? `
- **Average Similarity**: ${kbSimilarities.length > 0 ? ((kbSimilarities.reduce((a, b) => a + b, 0) / kbSimilarities.length) * 100).toFixed(1) : 0}%
- **Top Matches**:
${kbResults.slice(0, 5).map((r, i) => `  ${i + 1}. ${r.document_title || 'Untitled'} (${r.kb_name || 'Unknown KB'}) - ${((r.similarity || 0) * 100).toFixed(1)}%`).join('\n')}
` : '- No KB results found'}

### Email Results
${emailResults.length > 0 ? `
- **Average Similarity**: ${emailSimilarities.length > 0 ? ((emailSimilarities.reduce((a, b) => a + b, 0) / emailSimilarities.length) * 100).toFixed(1) : 0}%
- **Top Matches**:
${emailResults.slice(0, 5).map((r, i) => `  ${i + 1}. ${r.email_subject || 'Untitled'} (${r.email_from || 'Unknown'}) - ${((r.similarity || 0) * 100).toFixed(1)}%`).join('\n')}
` : '- No email results found'}

## Embedding Information
- **Model**: text-embedding-3-small
- **Dimensions**: ${data.queryEmbeddingPreview ? '1536' : 'N/A'}
${data.queryEmbeddingPreview ? `- **Preview (first 10 dims)**: [${data.queryEmbeddingPreview.slice(0, 10).map(n => n.toFixed(4)).join(', ')}]` : ''}

---
*Generated at ${new Date().toISOString()}*
`
}

/**
 * Clean up old debug runs (keep last 10)
 */
export function cleanupOldSearchDebugRuns(): void {
  if (!DEBUG_ENABLED) return
  
  try {
    if (!fs.existsSync(DEBUG_DIR)) return
    
    const runs = fs.readdirSync(DEBUG_DIR)
      .filter(name => fs.statSync(path.join(DEBUG_DIR, name)).isDirectory())
      .sort()
      .reverse() // Newest first
    
    if (runs.length > 10) {
      console.log(`🧹 Cleaning up ${runs.length - 10} old search debug runs...`)
      
      runs.slice(10).forEach(runDir => {
        const runPath = path.join(DEBUG_DIR, runDir)
        fs.rmSync(runPath, { recursive: true, force: true })
      })
    }
  } catch (error) {
    console.error('Failed to cleanup old search debug runs:', error)
  }
}

