/**
 * Content Trimmer Utility
 * 
 * Smart content truncation for managing LLM context limits.
 * Instead of naive truncation (cut at limit), this preserves
 * the most important parts of content.
 * 
 * For job descriptions:
 * - Beginning: Job title, company, overview
 * - End: How to apply, deadline, contact info
 * - Middle: Often repetitive company info (can be trimmed)
 */

// ============================================
// Configuration (centralized, not hardcoded)
// ============================================

export const CONTENT_LIMITS = {
  // Per-extraction limits
  MAX_CONTENT_LENGTH: 8000,        // Max chars per extracted page
  KEEP_START_CHARS: 4000,          // Chars to keep from beginning
  KEEP_END_CHARS: 2000,            // Chars to keep from end
  
  // Context limits
  MAX_CONTEXT_TOKENS: 100000,      // When to start trimming (128k - buffer)
  CHARS_PER_TOKEN: 4,              // Rough estimate: 4 chars ≈ 1 token
  
  // Tool result management
  KEEP_RECENT_TOOL_RESULTS: 3,     // Always keep last N tool results
} as const

// ============================================
// Token Estimation
// ============================================

/**
 * Estimate tokens from text (rough approximation)
 * More accurate than character count, less expensive than tokenizer
 */
export function estimateTokens(text: string): number {
  if (!text) return 0
  
  // Rough heuristic: 4 characters ≈ 1 token for English text
  // Adjust for code/technical content which has more tokens per char
  const baseEstimate = text.length / CONTENT_LIMITS.CHARS_PER_TOKEN
  
  // Technical content (code, URLs) tends to have more tokens
  const hasCode = text.includes('```') || text.includes('function')
  const hasUrls = (text.match(/https?:\/\//g) || []).length
  
  const multiplier = hasCode ? 1.3 : (hasUrls > 5 ? 1.2 : 1.0)
  
  return Math.ceil(baseEstimate * multiplier)
}

/**
 * Estimate tokens for an array of messages
 */
export function estimateMessagesTokens(messages: Array<{ content?: string | unknown }>): number {
  return messages.reduce((sum, msg) => {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || '')
    return sum + estimateTokens(content) + 10 // +10 for message overhead
  }, 0)
}

// ============================================
// Smart Content Truncation
// ============================================

/**
 * Smart truncation that preserves beginning and end
 * 
 * For job descriptions:
 * - Beginning: Job title, requirements, overview
 * - End: How to apply, deadline, contact
 * - Middle: Often company history (less important)
 */
export function smartTruncate(
  content: string,
  options: {
    maxLength?: number
    keepStart?: number
    keepEnd?: number
  } = {}
): { content: string; truncated: boolean; originalLength: number } {
  const maxLength = options.maxLength ?? CONTENT_LIMITS.MAX_CONTENT_LENGTH
  const keepStart = options.keepStart ?? CONTENT_LIMITS.KEEP_START_CHARS
  const keepEnd = options.keepEnd ?? CONTENT_LIMITS.KEEP_END_CHARS
  
  const originalLength = content.length
  
  if (content.length <= maxLength) {
    return { content, truncated: false, originalLength }
  }
  
  // Smart truncation: keep beginning + end, remove middle
  const beginning = content.substring(0, keepStart)
  const ending = content.substring(content.length - keepEnd)
  
  const separator = `\n\n[... ${originalLength - keepStart - keepEnd} characters trimmed to save context ...]\n\n`
  
  const truncatedContent = beginning + separator + ending
  
  return {
    content: truncatedContent,
    truncated: true,
    originalLength,
  }
}

/**
 * Truncate specifically for job description content
 * Tries to preserve key sections
 */
export function truncateJobDescription(
  content: string,
  maxLength: number = CONTENT_LIMITS.MAX_CONTENT_LENGTH
): { content: string; truncated: boolean; originalLength: number } {
  const originalLength = content.length
  
  if (content.length <= maxLength) {
    return { content, truncated: false, originalLength }
  }
  
  // Try to find key sections to preserve
  const contentLower = content.toLowerCase()
  
  // Look for important section markers
  const sectionMarkers = [
    'requirements', 'qualifications', 'experience',
    'technologies', 'skills', 'deadline', 'apply',
    'krav', 'kvalifikationer', 'erfaring', // Danish
    'teknologier', 'ansøgningsfrist', 'ansøg',
  ]
  
  // Find if there's a requirements section we should prioritize
  let requirementsStart = -1
  for (const marker of sectionMarkers) {
    const idx = contentLower.indexOf(marker)
    if (idx > 0 && (requirementsStart === -1 || idx < requirementsStart)) {
      requirementsStart = idx
    }
  }
  
  // If we found requirements section, adjust keepStart to include it
  const keepStart = requirementsStart > 0 && requirementsStart < 6000
    ? Math.max(requirementsStart + 2000, CONTENT_LIMITS.KEEP_START_CHARS)
    : CONTENT_LIMITS.KEEP_START_CHARS
  
  return smartTruncate(content, {
    maxLength,
    keepStart: Math.min(keepStart, maxLength - CONTENT_LIMITS.KEEP_END_CHARS - 100),
    keepEnd: CONTENT_LIMITS.KEEP_END_CHARS,
  })
}

// ============================================
// Message History Trimming
// ============================================

/**
 * Trim old tool messages when approaching context limit
 * Keeps recent tool results but clears older ones
 */
export function trimToolMessages(
  messages: Array<{ _getType?: () => string; content?: string | unknown }>,
  options: {
    maxTokens?: number
    keepRecent?: number
  } = {}
): Array<{ _getType?: () => string; content?: string | unknown }> {
  const maxTokens = options.maxTokens ?? CONTENT_LIMITS.MAX_CONTEXT_TOKENS
  const keepRecent = options.keepRecent ?? CONTENT_LIMITS.KEEP_RECENT_TOOL_RESULTS
  
  let currentTokens = estimateMessagesTokens(messages)
  
  if (currentTokens <= maxTokens) {
    return messages
  }
  
  // Find all tool message indices
  const toolIndices: number[] = []
  messages.forEach((msg, idx) => {
    if (msg._getType && msg._getType() === 'tool') {
      toolIndices.push(idx)
    }
  })
  
  // Keep the last N tool messages
  const indicesToClear = toolIndices.slice(0, -keepRecent)
  
  // Clear old tool messages (replace content with placeholder)
  for (const idx of indicesToClear) {
    if (currentTokens <= maxTokens) break
    
    const msg = messages[idx]
    const oldContent = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || '')
    const tokensReclaimed = estimateTokens(oldContent)
    
    // Replace with placeholder
    msg.content = '[Earlier tool result cleared to manage context size]'
    currentTokens -= tokensReclaimed
    currentTokens += estimateTokens(msg.content as string)
  }
  
  return messages
}

// ============================================
// Exports
// ============================================

export default {
  CONTENT_LIMITS,
  estimateTokens,
  estimateMessagesTokens,
  smartTruncate,
  truncateJobDescription,
  trimToolMessages,
}

