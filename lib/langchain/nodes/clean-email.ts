/**
 * Clean Email Node
 * 
 * Converts HTML email content to clean plain text.
 * This is a deterministic node (no LLM) that prepares
 * the email for analysis.
 */

import type { EmailWorkflowState, CleanedEmail } from '../types'

// ============================================
// HTML Cleaning Functions
// ============================================

/**
 * Convert HTML to plain text (server-side safe)
 * This handles common email HTML patterns
 */
function htmlToPlainText(html: string): string {
  if (!html) return ''
  
  let text = html
    // Remove script and style content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Replace line breaks and paragraphs with newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    // Replace common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&bull;/g, '•')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    // Remove remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode numeric entities
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([a-f\d]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  
  // Clean up whitespace
  text = text
    // Multiple spaces to single space
    .replace(/[ \t]+/g, ' ')
    // Multiple newlines to double newline
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    // Trim each line
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim()
  
  return text
}

/**
 * Extract URLs from HTML
 */
function extractUrlsFromHtml(html: string): string[] {
  const urls: string[] = []
  const seen = new Set<string>()
  
  // Match href attributes
  const hrefPattern = /href=["']([^"']+)["']/gi
  let match
  while ((match = hrefPattern.exec(html)) !== null) {
    const url = match[1]
    if (url && url.startsWith('http') && !seen.has(url)) {
      seen.add(url)
      urls.push(url)
    }
  }
  
  // Also match plain URLs in text
  const urlPattern = /https?:\/\/[^\s<>"']+/g
  while ((match = urlPattern.exec(html)) !== null) {
    const url = match[0].replace(/[.,;:!?)]+$/, '') // Remove trailing punctuation
    if (!seen.has(url)) {
      seen.add(url)
      urls.push(url)
    }
  }
  
  return urls
}

/**
 * Extract visible link text along with URLs
 */
function extractLinksWithText(html: string): Array<{ url: string; text: string }> {
  const links: Array<{ url: string; text: string }> = []
  const seen = new Set<string>()
  
  // Match anchor tags with href and text
  const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi
  let match
  while ((match = linkPattern.exec(html)) !== null) {
    const url = match[1]
    const text = match[2].trim()
    if (url && url.startsWith('http') && !seen.has(url)) {
      seen.add(url)
      links.push({ url, text })
    }
  }
  
  return links
}

// ============================================
// Clean Email Node
// ============================================

/**
 * Clean email node function
 * Converts HTML email to plain text and extracts metadata
 * 
 * @param state - Current workflow state
 * @returns Updated state with cleaned email
 */
export async function cleanEmailNode(
  state: EmailWorkflowState
): Promise<Partial<EmailWorkflowState>> {
  console.log('\n📧 [Clean Email] Processing email...')
  console.log(`   Subject: ${state.email.subject}`)
  console.log(`   From: ${state.email.from}`)
  
  const startTime = Date.now()
  
  try {
    // Convert HTML to plain text
    const plainText = htmlToPlainText(state.email.htmlBody)
    
    // Extract URLs
    const urls = extractUrlsFromHtml(state.email.htmlBody)
    const linksWithText = extractLinksWithText(state.email.htmlBody)
    
    console.log(`   Plain text: ${plainText.length} characters`)
    console.log(`   URLs found: ${urls.length}`)
    
    // Log some sample URLs for debugging
    if (urls.length > 0) {
      console.log(`   Sample URLs:`)
      urls.slice(0, 3).forEach(url => console.log(`     - ${url.substring(0, 60)}...`))
    }
    
    const cleanedEmail: CleanedEmail = {
      id: state.email.id,
      subject: state.email.subject,
      from: state.email.from,
      to: state.email.to,
      date: state.email.date,
      plainText,
      originalHtml: state.email.htmlBody,
    }
    
    const processingTime = Date.now() - startTime
    console.log(`✅ [Clean Email] Completed in ${processingTime}ms`)
    
    return {
      cleanedEmail,
      currentPhase: 'analyzing',
      // Store entities with URLs for later use
      entities: {
        companies: [],
        technologies: [],
        locations: [],
        positions: [],
        skills: [],
        urls, // URLs extracted from HTML
      },
    }
  } catch (error) {
    console.error('❌ [Clean Email] Error:', error)
    
    return {
      errors: [...state.errors, `Email cleaning failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      currentPhase: 'error',
    }
  }
}

// ============================================
// Exports
// ============================================

export { htmlToPlainText, extractUrlsFromHtml, extractLinksWithText }

