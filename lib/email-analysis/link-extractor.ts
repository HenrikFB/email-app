/**
 * Extracts links from email HTML
 * Supports filtering by link text or href patterns
 */

import * as cheerio from 'cheerio'
import type { ExtractedLink } from './types'

export interface LinkExtractionOptions {
  linkTextPattern?: string  // e.g., "View Details", "Read More", "Apply"
  hrefPattern?: string      // e.g., "example.com", "site.com"
  maxLinks?: number         // Limit number of links to extract
  buttonTextPattern?: string // Pattern for identifying button links (e.g., "View Details|Apply|Read More")
}

/**
 * Extracts links from HTML content
 * @param html - Email HTML content
 * @param options - Optional filters
 * @returns Array of extracted links
 */
export function extractLinksFromHtml(
  html: string,
  options: LinkExtractionOptions = {}
): ExtractedLink[] {
  const $ = cheerio.load(html)
  const links: ExtractedLink[] = []

  // Extract all <a> tags
  $('a[href]').each((_, element) => {
    const $el = $(element)
    const href = $el.attr('href')
    const text = $el.text().trim()

    if (!href || href.startsWith('mailto:') || href.startsWith('#')) {
      return // Skip mailto links and anchors
    }

    // Check if it matches filters
    if (options.linkTextPattern) {
      const pattern = new RegExp(options.linkTextPattern, 'i')
      if (!pattern.test(text)) {
        return // Skip if text doesn't match
      }
    }

    if (options.hrefPattern) {
      const pattern = new RegExp(options.hrefPattern, 'i')
      if (!pattern.test(href)) {
        return // Skip if href doesn't match
      }
    }

    // Enhanced button detection
    const className = $el.attr('class') || ''
    const role = $el.attr('role') || ''
    const parentClass = $el.parent().attr('class') || ''
    const parentRole = $el.parent().attr('role') || ''
    
    // Check if text matches buttonTextPattern
    let matchesButtonPattern = false
    if (options.buttonTextPattern) {
      const buttonPattern = new RegExp(options.buttonTextPattern, 'i')
      matchesButtonPattern = buttonPattern.test(text)
    }
    
    // Check various button indicators
    const isButton =
      matchesButtonPattern || // Matches user-defined button pattern
      className.includes('button') ||
      className.includes('btn') ||
      className.includes('cta') || // Call-to-action
      className.includes('action') ||
      role === 'button' ||
      parentRole === 'button' ||
      parentClass.includes('button') ||
      parentClass.includes('btn') ||
      $el.closest('button').length > 0 ||
      $el.closest('[role="button"]').length > 0

    links.push({
      url: href,
      text,
      isButton,
    })
  })

  // Also check for <button> elements with onclick links
  $('button[onclick]').each((_, element) => {
    const $el = $(element)
    const onclick = $el.attr('onclick') || ''
    const urlMatch = onclick.match(/(?:window\.)?(?:location|open)\s*\(\s*['"]([^'"]+)['"]/i)

    if (urlMatch && urlMatch[1]) {
      const href = urlMatch[1]
      const text = $el.text().trim()

      links.push({
        url: href,
        text,
        isButton: true,
      })
    }
  })

  // Remove duplicates (same URL)
  const uniqueLinks = links.reduce((acc, link) => {
    if (!acc.find((l) => l.url === link.url)) {
      acc.push(link)
    }
    return acc
  }, [] as ExtractedLink[])

  // Apply max links limit
  if (options.maxLinks && uniqueLinks.length > options.maxLinks) {
    return uniqueLinks.slice(0, options.maxLinks)
  }

  return uniqueLinks
}

