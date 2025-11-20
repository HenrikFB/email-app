/**
 * Utility functions for converting HTML to plain text
 * Used for displaying email content in a readable format
 */

/**
 * Converts HTML to plain text by stripping tags and decoding entities
 * @param html - HTML string to convert
 * @returns Plain text version
 */
export function htmlToPlainText(html: string): string {
  if (!html) return ''
  
  // Create a temporary DOM element to parse HTML
  // This handles HTML entities and structure better than regex
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  
  // Get text content (automatically handles nested elements)
  let text = tempDiv.textContent || tempDiv.innerText || ''
  
  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ')  // Multiple spaces to single space
    .replace(/\n\s*\n/g, '\n\n')  // Multiple newlines to double newline
    .trim()
  
  return text
}

/**
 * Extracts plain text from HTML (server-side safe version)
 * Uses regex for server-side environments where DOM is not available
 * @param html - HTML string to convert
 * @returns Plain text version
 */
export function htmlToPlainTextServer(html: string): string {
  if (!html) return ''
  
  let text = html
    // Remove script and style content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Replace common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    // Remove HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode numeric entities (basic)
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([a-f\d]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  
  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim()
  
  return text
}

