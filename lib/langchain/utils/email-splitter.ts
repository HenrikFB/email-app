/**
 * Email Splitter Utility
 * 
 * Splits email plain text into processable chunks for LLM analysis.
 * Uses simple character-based chunking at natural break points.
 * 
 * Why character-based instead of pattern-based?
 * - Email formats vary significantly across sources
 * - Plain text doesn't preserve link structure
 * - Simple chunking is more reliable than pattern matching
 * - LLMs can handle partial job info across chunks
 * 
 * URL extraction is separate (from HTML) and happens in clean-email node.
 */

export interface JobChunk {
  index: number
  content: string
  charCount: number
}

export interface EmailSplitResult {
  source: EmailSource
  chunks: JobChunk[]
  totalCharacters: number
  chunkCount: number
}

export type EmailSource = 
  | 'jobindex'
  | 'it-jobbank'
  | 'linkedin'
  | 'jobnet'
  | 'karriere.dk'
  | 'thehub'
  | 'unknown'

// Target chunk size in characters (roughly 10-15 jobs per chunk)
const TARGET_CHUNK_SIZE = 4000

// Minimum chunk size to avoid tiny chunks
const MIN_CHUNK_SIZE = 500

// Threshold for triggering batched processing (roughly 20+ jobs)
const BATCH_THRESHOLD_CHARS = 8000

/**
 * Detect the email source from the sender address
 */
export function detectEmailSource(fromAddress: string): EmailSource {
  const from = fromAddress.toLowerCase()
  
  if (from.includes('jobindex')) return 'jobindex'
  if (from.includes('it-jobbank')) return 'it-jobbank'
  if (from.includes('linkedin')) return 'linkedin'
  if (from.includes('jobnet')) return 'jobnet'
  if (from.includes('karriere.dk')) return 'karriere.dk'
  if (from.includes('thehub')) return 'thehub'
  
  return 'unknown'
}

/**
 * Split text into chunks at natural break points
 * 
 * This is a simple, reliable approach that:
 * 1. Targets ~4000 characters per chunk
 * 2. Splits at double newlines (paragraph breaks)
 * 3. Handles edge cases gracefully
 */
function splitByCharacterCount(
  plainText: string, 
  targetSize: number = TARGET_CHUNK_SIZE
): string[] {
  const chunks: string[] = []
  let start = 0
  
  while (start < plainText.length) {
    // Calculate end position
    let end = Math.min(start + targetSize, plainText.length)
    
    // If we're not at the end, find a natural break point
    if (end < plainText.length) {
      // Look for double newline (paragraph break) near the target
      const searchStart = Math.max(start, end - targetSize * 0.3)
      const searchEnd = Math.min(plainText.length, end + targetSize * 0.2)
      const searchRegion = plainText.slice(searchStart, searchEnd)
      
      // Find the best break point (double newline closest to target)
      let bestBreak = -1
      let breakIndex = 0
      
      while ((breakIndex = searchRegion.indexOf('\n\n', breakIndex)) !== -1) {
        const absolutePos = searchStart + breakIndex
        if (absolutePos > start + MIN_CHUNK_SIZE) {
          // Prefer breaks closer to target size
          if (bestBreak === -1 || Math.abs(absolutePos - (start + targetSize)) < Math.abs(bestBreak - (start + targetSize))) {
            bestBreak = absolutePos
          }
        }
        breakIndex += 2
      }
      
      if (bestBreak > start) {
        end = bestBreak
      }
    }
    
    // Extract and clean the chunk
    const chunk = plainText.slice(start, end).trim()
    
    if (chunk.length >= MIN_CHUNK_SIZE) {
      chunks.push(chunk)
    } else if (chunks.length > 0 && chunk.length > 0) {
      // Append small remainder to previous chunk
      chunks[chunks.length - 1] += '\n\n' + chunk
    } else if (chunk.length > 0) {
      // First chunk, even if small
      chunks.push(chunk)
    }
    
    // Move past any whitespace
    start = end
    while (start < plainText.length && /\s/.test(plainText[start])) {
      start++
    }
  }
  
  return chunks
}

/**
 * Split email plain text into processable chunks
 */
export function splitEmailIntoChunks(
  plainText: string, 
  fromAddress: string
): EmailSplitResult {
  const source = detectEmailSource(fromAddress)
  
  // Split into chunks
  const rawChunks = splitByCharacterCount(plainText, TARGET_CHUNK_SIZE)
  
  // Convert to JobChunk format
  const chunks: JobChunk[] = rawChunks.map((content, index) => ({
    index,
    content,
    charCount: content.length,
  }))
  
  return {
    source,
    chunks,
    totalCharacters: plainText.length,
    chunkCount: chunks.length,
  }
}

/**
 * Check if an email needs batched processing
 * 
 * Returns true if:
 * - Email is large enough to warrant splitting (8000+ chars)
 * - Would result in 2+ chunks
 */
export function needsBatchedProcessing(plainText: string): boolean {
  return plainText.length > BATCH_THRESHOLD_CHARS
}

/**
 * Estimate the number of jobs in plain text
 * Based on average ~300-400 characters per job listing
 */
export function estimateJobCount(plainText: string): number {
  return Math.ceil(plainText.length / 350)
}
