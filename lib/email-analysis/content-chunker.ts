/**
 * Generic Content Chunking
 * Splits email and scraped content into manageable chunks for AI analysis
 * Works with ANY content type - fully generic
 * 
 * NOTE: As of the full-context-analyzer refactor, chunking is now CONDITIONAL:
 * - Most emails and pages are analyzed in full context (1 API call)
 * - Chunking only happens as a fallback for exceptionally large content
 * - See full-context-analyzer.ts for the new primary analysis flow
 * 
 * This module provides the chunking utilities used as fallback.
 */

import * as cheerio from 'cheerio'
import type { ScrapedPage } from './types'

export interface ContentChunk {
  type: 'email' | 'scraped'
  content: string
  source?: string  // URL for scraped content
  index: number
  charCount: number
}

const CHUNK_SIZE = 3000 // ~750 tokens per chunk (safe margin for any content)

/**
 * Extract plain text from HTML
 * Removes navigation, footer, scripts, styles
 * Keeps only main content text
 */
export function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html)
  
  // Remove elements we don't want
  $('header, footer, nav, style, script, iframe, noscript').remove()
  
  // Extract meaningful text elements
  const textParts: string[] = []
  
  // Headings
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const text = $(el).text().trim()
    if (text.length > 3) {
      textParts.push(`## ${text}`)
    }
  })
  
  // Paragraphs
  $('p').each((_, el) => {
    const text = $(el).text().trim()
    if (text.length > 10) {
      textParts.push(text)
    }
  })
  
  // List items
  $('li').each((_, el) => {
    const text = $(el).text().trim()
    if (text.length > 10) {
      textParts.push(`• ${text}`)
    }
  })
  
  // Table cells (important for job listings)
  $('td, th').each((_, el) => {
    const text = $(el).text().trim()
    if (text.length > 10) {
      textParts.push(text)
    }
  })
  
  return textParts.join('\n\n')
}

/**
 * Split text into chunks at natural boundaries (paragraphs)
 * Tries to keep related content together
 */
export function splitTextIntoChunks(text: string, chunkSize: number = CHUNK_SIZE): string[] {
  const chunks: string[] = []
  const paragraphs = text.split(/\n\n+/)
  
  let currentChunk = ''
  
  for (const paragraph of paragraphs) {
    const trimmedPara = paragraph.trim()
    if (!trimmedPara) continue
    
    // If adding this paragraph would exceed chunk size
    if (currentChunk && (currentChunk + '\n\n' + trimmedPara).length > chunkSize) {
      // Save current chunk and start new one
      chunks.push(currentChunk.trim())
      currentChunk = trimmedPara
    } else {
      // Add to current chunk
      currentChunk += (currentChunk ? '\n\n' : '') + trimmedPara
    }
  }
  
  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }
  
  // If we got no chunks (edge case), split by character limit
  if (chunks.length === 0 && text.length > 0) {
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, i + chunkSize))
    }
  }
  
  return chunks
}

/**
 * Create chunks from email content and scraped pages
 * Returns all chunks ready for recursive analysis
 * 
 * @param emailText - Plain text email content (NOT HTML)
 * @param scrapedPages - Array of scraped pages from Firecrawl
 * @returns Array of content chunks
 */
export function chunkContent(
  emailText: string,
  scrapedPages: ScrapedPage[]
): ContentChunk[] {
  const chunks: ContentChunk[] = []
  let globalIndex = 0
  
  console.log('\n📦 Creating content chunks...')
  
  // STEP 1: Chunk email content
  if (emailText && emailText.length > 0) {
    const emailChunks = splitTextIntoChunks(emailText, CHUNK_SIZE)
    
    console.log(`📧 Email: ${emailChunks.length} chunks (${emailText.length} chars total)`)
    
    emailChunks.forEach((content, i) => {
      chunks.push({
        type: 'email',
        content,
        index: globalIndex++,
        charCount: content.length
      })
    })
  } else {
    console.log('⚠️  Email content is empty')
  }
  
  // STEP 2: Chunk scraped pages
  if (scrapedPages && scrapedPages.length > 0) {
    console.log(`🌐 Scraped pages: ${scrapedPages.length} pages`)
    
    scrapedPages.forEach((page, pageIndex) => {
      if (!page.markdown || page.markdown.length === 0) {
        console.log(`   ⚠️  Page ${pageIndex + 1} (${page.url}): Empty content`)
        return
      }
      
      const pageChunks = splitTextIntoChunks(page.markdown, CHUNK_SIZE)
      console.log(`   📄 Page ${pageIndex + 1} (${page.url}): ${pageChunks.length} chunks`)
      
      pageChunks.forEach((content, chunkIndex) => {
        chunks.push({
          type: 'scraped',
          content,
          source: page.url,
          index: globalIndex++,
          charCount: content.length
        })
      })
    })
  }
  
  console.log(`\n✅ Total chunks created: ${chunks.length}`)
  console.log(`   - Email chunks: ${chunks.filter(c => c.type === 'email').length}`)
  console.log(`   - Scraped chunks: ${chunks.filter(c => c.type === 'scraped').length}`)
  
  return chunks
}

/**
 * Get statistics about chunks (for debugging)
 */
export function getChunkStats(chunks: ContentChunk[]): {
  totalChunks: number
  emailChunks: number
  scrapedChunks: number
  totalChars: number
  avgChunkSize: number
} {
  return {
    totalChunks: chunks.length,
    emailChunks: chunks.filter(c => c.type === 'email').length,
    scrapedChunks: chunks.filter(c => c.type === 'scraped').length,
    totalChars: chunks.reduce((sum, c) => sum + c.charCount, 0),
    avgChunkSize: chunks.length > 0 
      ? Math.round(chunks.reduce((sum, c) => sum + c.charCount, 0) / chunks.length)
      : 0
  }
}

