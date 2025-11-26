/**
 * Email Analysis Orchestrator - REFACTORED
 * 
 * New Architecture:
 * 1. Extract ALL links from FULL email HTML (before any truncation)
 * 2. Use AI to prioritize which links to scrape (no hardcoded limits)
 * 3. Use plain text for analysis (not HTML) - much smaller!
 * 4. Chunk content into manageable pieces
 * 5. Analyze each chunk recursively
 * 6. Aggregate results
 * 
 * Features:
 * - Works with emails of ANY size
 * - Fully generic (no hardcoded patterns)
 * - Debug folder system for inspection
 * - Comprehensive logging
 */

import { getEmailById } from '@/lib/microsoft-graph/client'
import { extractLinksFromHtml } from './link-extractor'
import { prioritizeLinksWithAI, extractUserIntentFromEmail } from './link-prioritization'
import { createContentRetriever } from '@/lib/content-retrieval'
import type { RetrievalContext } from '@/lib/content-retrieval'
import { extractTextFromHtml } from './content-chunker'
import { analyzeFullEmail, analyzeScrapedPage } from './full-context-analyzer'
import type { FullContentAnalysisResult } from './types'
import {
  initDebugRun,
  logDebugStep,
  logDebugText,
  finalizeDebugRun,
  cleanupOldDebugRuns,
  type AnalysisDebugData
} from './debug-logger'
import { getKBContextForRAG } from '@/lib/embeddings/service'
import { getAssignedKBs } from '@/app/dashboard/knowledge-base/actions'
import type { AnalysisJobInput, AnalysisJobResult, ScrapedPage } from './types'
import * as cheerio from 'cheerio'

/**
 * Analyzes email HTML structure to identify patterns
 * Generic - works for any content type based on button_text_pattern and match_criteria
 */
async function analyzeHtmlStructure(
  html: string,
  buttonTextPattern: string | null | undefined,
  matchCriteria: string
): Promise<{
  potentialSections: number
  buttonMatches: number
  structureHints: string[]
}> {
  const $ = cheerio.load(html)
  const hints: string[] = []
  
  // Count button pattern matches
  let buttonMatches = 0
  if (buttonTextPattern) {
    const pattern = new RegExp(buttonTextPattern, 'i')
    $('a, button').each((_, el) => {
      const text = $(el).text().trim()
      if (pattern.test(text)) {
        buttonMatches++
      }
    })
  }
  
  // Identify repeated sections (e.g., listings, cards)
  const potentialSections = Math.max(
    $('table tr').length,
    $('li').length,
    $('[class*="card"]').length,
    $('[class*="item"]').length,
    $('[class*="listing"]').length,
    $('[class*="entry"]').length
  )
  
  // Structure hints
  if (buttonMatches > 0) {
    hints.push(`Found ${buttonMatches} button pattern match(es) - strong indicator of primary content`)
  }
  if (potentialSections > 5) {
    hints.push(`Detected ${potentialSections} potential content sections - likely a list format`)
  }
  if ($('table').length > 0) {
    hints.push('Contains table(s) - structured data likely present')
  }
  
  return {
    potentialSections,
    buttonMatches,
    structureHints: hints
  }
}

/**
 * Validates links based on agent configuration
 * Generic validation using link_selection_guidance
 */
function validateLinks(
  links: { url: string; text: string; isButton: boolean }[],
  agentConfig: {
    link_selection_guidance?: string
    button_text_pattern?: string
  }
): { url: string; text: string; isButton: boolean }[] {
  return links.filter(link => {
    const url = link.url.toLowerCase()
    const text = link.text.toLowerCase()
    
    // Always keep button pattern matches unless explicitly guided otherwise
    if (link.isButton && agentConfig.button_text_pattern) {
      return true
    }
    
    // Filter out common non-content patterns (unless link_selection_guidance says otherwise)
    const commonNonContentPatterns = [
      /unsubscribe/i,
      /login|logout|sign[\s-]?in|sign[\s-]?out/i,
      /privacy|terms|cookie[\s-]?policy/i,
      /settings|preferences|account/i,
      /facebook\.com|twitter\.com|linkedin\.com\/company|instagram\.com/i, // Social media (but not linkedin jobs)
      /mailto:/i,
    ]
    
    // Check if link_selection_guidance explicitly says to include these
    const guidanceOverride = agentConfig.link_selection_guidance?.toLowerCase()
    const shouldIncludeAnyway = guidanceOverride && (
      guidanceOverride.includes('include all links') ||
      guidanceOverride.includes('include navigation') ||
      guidanceOverride.includes('include settings')
    )
    
    if (!shouldIncludeAnyway) {
      for (const pattern of commonNonContentPatterns) {
        if (pattern.test(url) || pattern.test(text)) {
          return false
        }
      }
    }
    
    // Filter out very generic single-word navigation
    const veryGenericNavigation = /^(home|about|contact|help|faq|support)$/i
    if (!shouldIncludeAnyway && veryGenericNavigation.test(text.trim())) {
      return false
    }
    
    return true
  })
}

/**
 * Normalize and deduplicate URLs
 * - Removes query parameters that don't affect content (tracking, utm_, etc.)
 * - Normalizes Outlook SafeLinks
 * - Groups similar URLs and keeps only unique ones
 */
function deduplicateUrls(urls: string[]): string[] {
  const seenNormalized = new Set<string>()
  const uniqueUrls: string[] = []
  
  for (const url of urls) {
    // Normalize the URL for comparison
    let normalized = url
    
    try {
      const urlObj = new URL(url)
      
      // For SafeLinks, extract the actual URL
      if (urlObj.hostname.includes('safelinks.protection.outlook.com')) {
        const actualUrl = urlObj.searchParams.get('url')
        if (actualUrl) {
          // Decode and normalize the actual URL
          normalized = decodeURIComponent(actualUrl)
          const actualUrlObj = new URL(normalized)
          
          // Remove tracking params from actual URL
          const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'ttid', 'source', 'uid', 'abtestid']
          paramsToRemove.forEach(param => actualUrlObj.searchParams.delete(param))
          
          normalized = actualUrlObj.toString()
        }
      } else {
        // Remove tracking params from regular URLs
        const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'ttid', 'source', 'uid', 'abtestid']
        paramsToRemove.forEach(param => urlObj.searchParams.delete(param))
        normalized = urlObj.toString()
      }
      
      // Remove trailing slashes for consistency
      normalized = normalized.replace(/\/$/, '')
      
    } catch (e) {
      // If URL parsing fails, use as-is
      console.warn(`⚠️  Could not parse URL for deduplication: ${url}`)
    }
    
    // Only add if we haven't seen this normalized URL
    if (!seenNormalized.has(normalized)) {
      seenNormalized.add(normalized)
      uniqueUrls.push(url) // Keep original URL, not normalized (for scraping)
    }
  }
  
  return uniqueUrls
}

/**
 * Main orchestrator for email analysis
 * Implements new architecture with chunking and recursive analysis
 */
export async function analyzeEmail(
  input: AnalysisJobInput
): Promise<AnalysisJobResult> {
  const startTime = Date.now()
  
  // Cleanup old debug runs first
  cleanupOldDebugRuns()
  
  console.log('\n')
  console.log('═'.repeat(70))
  console.log('🔍 EMAIL ANALYSIS - START')
  console.log('═'.repeat(70))
  console.log(`📧 Email ID: ${input.emailId}`)
  console.log(`🎯 Match Criteria: ${input.agentConfig.match_criteria}`)
  console.log(`📋 Extraction Fields: ${input.agentConfig.extraction_fields}`)
  console.log(`🔗 Follow Links: ${input.agentConfig.follow_links}`)
  console.log(`🔘 Button Pattern: ${input.agentConfig.button_text_pattern || 'None'}`)
  console.log('─'.repeat(70))
  
  let debugRunId = ''
  const debugData: Partial<AnalysisDebugData> = {}
  
  try {
    // ========== STEP 1: Fetch Email ==========
    console.log('\n📥 STEP 1: Fetching email from Microsoft Graph...')
    
    const email = await getEmailById(input.accessToken, input.emailId)
    
    if (!email) {
      throw new Error('Email not found')
    }
    
    // Initialize debug run
    debugRunId = initDebugRun(input.emailId, email.subject, {
      match_criteria: input.agentConfig.match_criteria,
      extraction_fields: input.agentConfig.extraction_fields,
      user_intent: input.agentConfig.user_intent,
      link_selection_guidance: input.agentConfig.link_selection_guidance,
      extraction_examples: input.agentConfig.extraction_examples,
      analysis_feedback: input.agentConfig.analysis_feedback,
      button_text_pattern: input.agentConfig.button_text_pattern,
      follow_links: input.agentConfig.follow_links,
      max_links_to_scrape: input.agentConfig.max_links_to_scrape,
      content_retrieval_strategy: input.agentConfig.content_retrieval_strategy,
    })
    debugData.runId = debugRunId
    debugData.emailId = input.emailId
    debugData.emailSubject = email.subject
    debugData.emailFrom = email.from.address
    debugData.timestamp = new Date().toISOString()
    
    const emailHtmlBody = email.bodyHtml || email.body || email.snippet || ''
    const emailPlainText = email.body || extractTextFromHtml(emailHtmlBody) || email.snippet || ''
    
    debugData.emailBodyLength = emailPlainText.length
    debugData.emailHtmlLength = emailHtmlBody.length
    
    console.log(`✅ Email fetched:`)
    console.log(`   Subject: ${email.subject}`)
    console.log(`   From: ${email.from.address}`)
    console.log(`   Plain text: ${emailPlainText.length} chars`)
    console.log(`   HTML: ${emailHtmlBody.length} chars`)
    
    logDebugStep(debugRunId, 1, 'email-fetched', {
      subject: email.subject,
      from: email.from.address,
      plainTextLength: emailPlainText.length,
      htmlLength: emailHtmlBody.length
    })
    logDebugText(debugRunId, '01-email-plain-text.txt', emailPlainText)
    logDebugText(debugRunId, '01-email-html.html', emailHtmlBody)
    
    // ========== STEP 1.5: Analyze HTML Structure ==========
    console.log('\n🔍 STEP 1.5: Analyzing HTML structure...')
    
    const htmlStructure = await analyzeHtmlStructure(
      emailHtmlBody,
      input.agentConfig.button_text_pattern,
      input.agentConfig.match_criteria
    )
    
    console.log(`✅ HTML structure analysis:`)
    console.log(`   Potential sections: ${htmlStructure.potentialSections}`)
    console.log(`   Button pattern matches: ${htmlStructure.buttonMatches}`)
    if (htmlStructure.structureHints.length > 0) {
      console.log(`   Hints:`)
      htmlStructure.structureHints.forEach(hint => console.log(`     - ${hint}`))
    }
    
    logDebugStep(debugRunId, 1.5, 'html-structure-analysis', {
      potentialSections: htmlStructure.potentialSections,
      buttonMatches: htmlStructure.buttonMatches,
      structureHints: htmlStructure.structureHints
    })
    
    // ========== STEP 2: Extract ALL Links from FULL Email HTML ==========
    console.log('\n🔗 STEP 2: Extracting links from FULL email HTML (before truncation)...')
    
    const allLinks = extractLinksFromHtml(emailHtmlBody, {
      buttonTextPattern: input.agentConfig.button_text_pattern || undefined
    }) // No maxLinks limit, but pass button pattern for detection
    const allLinksFound = allLinks.map(link => link.url)
    
    debugData.allLinksExtracted = allLinks
    
    console.log(`✅ Found ${allLinks.length} links:`)
    console.log(`   - Buttons: ${allLinks.filter(l => l.isButton).length}`)
    console.log(`   - Regular links: ${allLinks.filter(l => !l.isButton).length}`)
    
    logDebugStep(debugRunId, 2, 'links-extracted', {
      totalLinks: allLinks.length,
      buttons: allLinks.filter(l => l.isButton).length,
      regularLinks: allLinks.filter(l => !l.isButton).length,
      allLinks: allLinks.map(l => ({ url: l.url, text: l.text, isButton: l.isButton }))
    })
    
    // ========== STEP 2.5: Extract User Intent from Email ==========
    let emailIntent: { refinedGoal: string; keyTerms: string[]; expectedContent: string } | undefined
    
    if (input.agentConfig.follow_links && allLinks.length > 0) {
      console.log('\n🧠 STEP 2.5: Analyzing email to extract user intent...')
      
      emailIntent = await extractUserIntentFromEmail(
        emailPlainText,
        email.subject,
        input.agentConfig.match_criteria,
        input.agentConfig.extraction_fields,
        input.agentConfig.user_intent,
        input.agentConfig.link_selection_guidance,
        input.agentConfig.extraction_examples,
        input.agentConfig.analysis_feedback
      )
      
      console.log(`✅ Intent extracted:`)
      console.log(`   Refined goal: ${emailIntent.refinedGoal}`)
      console.log(`   Key terms: ${emailIntent.keyTerms.length > 0 ? emailIntent.keyTerms.join(', ') : 'None extracted'}`)
      console.log(`   Expected content: ${emailIntent.expectedContent}`)
      
      debugData.emailIntent = emailIntent
      
      // Save detailed intent extraction with input context
      logDebugStep(debugRunId, 2.5, 'intent-extraction', {
        input_context: {
          emailSubject: email.subject,
          emailContentLength: emailPlainText.length,
          user_intent_provided: !!input.agentConfig.user_intent,
          link_guidance_provided: !!input.agentConfig.link_selection_guidance,
          extraction_examples_provided: !!input.agentConfig.extraction_examples,
          analysis_feedback_provided: !!input.agentConfig.analysis_feedback,
        },
        extracted_intent: {
          refinedGoal: emailIntent.refinedGoal,
          keyTerms: emailIntent.keyTerms,
          expectedContent: emailIntent.expectedContent
        },
        reasoning: 'This intent guides link selection by understanding what the user is actually looking for beyond surface-level keywords'
      })
    } else {
      console.log('\n⏭️  STEP 2.5: Skipping intent extraction (follow_links=false or no links found)')
    }
    
    // ========== STEP 2.8: Link Validation ==========
    let validatedLinks = allLinks
    
    if (input.agentConfig.follow_links && allLinks.length > 0) {
      console.log('\n✅ STEP 2.8: Validating links (filtering obvious non-content)...')
      
      validatedLinks = validateLinks(allLinks, {
        link_selection_guidance: input.agentConfig.link_selection_guidance,
        button_text_pattern: input.agentConfig.button_text_pattern
      })
      
      const filteredCount = allLinks.length - validatedLinks.length
      if (filteredCount > 0) {
        console.log(`   Filtered out ${filteredCount} non-content link(s)`)
        console.log(`   Remaining: ${validatedLinks.length} valid links`)
      } else {
        console.log(`   All ${validatedLinks.length} links passed validation`)
      }
      
      logDebugStep(debugRunId, 2.8, 'link-validation', {
        totalLinks: allLinks.length,
        validLinks: validatedLinks.length,
        filteredCount,
        validatedLinks: validatedLinks.map(l => ({ url: l.url, text: l.text, isButton: l.isButton }))
      })
    }
    
    // ========== STEP 3: AI Link Prioritization ==========
    let selectedLinks: string[] = []
    
    if (input.agentConfig.follow_links && validatedLinks.length > 0) {
      console.log('\n🤖 STEP 3: AI prioritizing links with email context...')
      
      const prioritization = await prioritizeLinksWithAI(
        validatedLinks,
        input.agentConfig.match_criteria,
        input.agentConfig.extraction_fields,
        input.agentConfig.button_text_pattern,
        emailIntent,  // Pass email intent to guide link selection
        input.agentConfig.link_selection_guidance,
        input.agentConfig.extraction_examples,
        input.agentConfig.analysis_feedback
      )
      
      selectedLinks = prioritization.selectedUrls
      
      // Deduplicate URLs (normalize and remove duplicates)
      const uniqueLinks = deduplicateUrls(selectedLinks)
      const duplicatesRemoved = selectedLinks.length - uniqueLinks.length
      
      if (duplicatesRemoved > 0) {
        console.log(`🔄 Removed ${duplicatesRemoved} duplicate URL(s)`)
      }
      
      selectedLinks = uniqueLinks
      
      // Apply user-defined max links limit (take top N most relevant)
      const maxLinks = input.agentConfig.max_links_to_scrape ?? 10
      const originalSelectedCount = selectedLinks.length
      
      if (maxLinks > 0 && selectedLinks.length > maxLinks) {
        console.log(`🎯 Limiting to top ${maxLinks} most relevant links (from ${selectedLinks.length} AI-selected)`)
        selectedLinks = selectedLinks.slice(0, maxLinks)
      }
      
      debugData.aiSelectedLinks = selectedLinks
      
      console.log(`✅ AI selected ${originalSelectedCount}/${allLinks.length} relevant links`)
      if (originalSelectedCount > selectedLinks.length) {
        console.log(`   📊 Scraping top ${selectedLinks.length} (max_links_to_scrape=${maxLinks})`)
      }
      
      logDebugStep(debugRunId, 3, 'ai-link-prioritization', {
        input_to_ai: {
          total_links: allLinks.length,
          email_intent: emailIntent,
          match_criteria: input.agentConfig.match_criteria,
          extraction_fields: input.agentConfig.extraction_fields,
          button_text_pattern: input.agentConfig.button_text_pattern || null,
          link_selection_guidance: input.agentConfig.link_selection_guidance || null,
          extraction_examples_provided: !!input.agentConfig.extraction_examples,
          analysis_feedback_provided: !!input.agentConfig.analysis_feedback,
        },
        ai_output: {
          selected_count_raw: prioritization.selectedUrls.length,
          selected_urls: prioritization.selectedUrls,
          ai_reasoning: prioritization.reasoning,
        },
        post_processing: {
          duplicates_removed: duplicatesRemoved,
          max_links_to_scrape: maxLinks,
          final_count: selectedLinks.length,
          final_urls: selectedLinks,
        },
        reasoning_explanation: 'AI evaluated each link based on email intent, user criteria, and guidance to select most relevant URLs. Then limited to max_links_to_scrape.'
      })
    } else {
      console.log('\n⏭️  STEP 3: Skipping link scraping (follow_links=false or no links found)')
    }
    
    // ========== STEP 4: Retrieve Content from Selected Links ==========
    let scrapedPages: ScrapedPage[] = []
    let urlMappings: Array<{ original: string; actual: string }> = []
    debugData.scrapingAttempts = []
    debugData.scrapedContent = []
    
    if (selectedLinks.length > 0) {
      const strategy = input.agentConfig.content_retrieval_strategy || 'scrape_only'
      console.log(`\n📦 STEP 4: Retrieving content from links (strategy: ${strategy})...`)
      
      // Create retriever based on strategy
      const retriever = createContentRetriever(strategy)
      
      // Build retrieval context
      const context: RetrievalContext = {
        emailSubject: email.subject,
        matchCriteria: input.agentConfig.match_criteria,
        extractionFields: input.agentConfig.extraction_fields,
        runId: debugData.runId,
      }
      
      // Retrieve content from all selected links
      const retrievalResults = await Promise.all(
        selectedLinks.map(async (url) => {
          // Find link text for this URL
          const linkInfo = allLinks.find(l => l.url === url)
          const contextWithLinkText = {
            ...context,
            linkText: linkInfo?.text || '',
          }
          
          return retriever.retrieve(url, contextWithLinkText)
        })
      )
      
      // Convert to ScrapedPage format and track URL mappings
      scrapedPages = retrievalResults
        .filter(result => result.success && result.content)
        .map((result, index) => {
          // Track mapping: original SafeLinks URL → actual redirected URL
          const originalUrl = selectedLinks[retrievalResults.indexOf(result)]
          if (originalUrl !== result.url) {
            urlMappings.push({
              original: originalUrl,
              actual: result.url
            })
          }
          
          return {
            url: result.url,
            markdown: result.content,
            title: result.metadata.title || result.url
          }
        })
      
      // Log URL mappings for debugging
      if (urlMappings.length > 0) {
        console.log(`\n🔗 URL Redirects Resolved:`)
        urlMappings.forEach(mapping => {
          console.log(`   ${mapping.original.substring(0, 50)}... → ${mapping.actual}`)
        })
      }
      
      debugData.scrapingAttempts = retrievalResults.map(result => ({
        url: result.url,
        attempts: 1,
        success: result.success,
        error: result.error,
        source: result.source,  // Track which source (firecrawl/tavily/hybrid)
      }))
      
      debugData.scrapedContent = scrapedPages.map(p => ({
        url: p.url,
        markdownLength: p.markdown.length,
        title: p.title
      }))
      
      console.log(`✅ Successfully retrieved ${scrapedPages.length}/${selectedLinks.length} pages`)
      console.log(`   Strategy: ${strategy}`)
      console.log(`   Sources: ${retrievalResults.map(r => r.source).join(', ')}`)
      
      logDebugStep(debugRunId, 4, 'content-retrieval-complete', {
        strategy,
        urlsToRetrieve: selectedLinks.length,
        successfulRetrievals: scrapedPages.length,
        failedRetrievals: selectedLinks.length - scrapedPages.length,
        sources: retrievalResults.map(r => ({ url: r.url, source: r.source })),
        scrapedContent: debugData.scrapedContent
      })
    } else {
      console.log('\n⏭️  STEP 4: No links to retrieve content from')
    }
    
    // ========== STEP 4.5: Fetch RAG Context from Knowledge Bases (if any assigned) ==========
    let ragContext = ''
    try {
      console.log('\n📚 STEP 4.5: Fetching RAG context from assigned knowledge bases...')
      
      // Get KBs assigned to this agent config
      const kbAssignmentResult = await getAssignedKBs(input.agentConfigId)
      const assignedKBIds = kbAssignmentResult.success ? (kbAssignmentResult.data || []) : []
      
      if (assignedKBIds.length > 0) {
        console.log(`   Found ${assignedKBIds.length} assigned knowledge base(s)`)
        
        // Create search query from email subject and snippet
        const searchQuery = `${email.subject} ${email.snippet || emailPlainText.substring(0, 200)}`
        
        ragContext = await getKBContextForRAG(
          searchQuery,
          input.userId,
          assignedKBIds,
          5 // Get top 5 similar examples
        )
        
        if (ragContext) {
          console.log(`✅ RAG context retrieved (${ragContext.length} chars)`)
          debugData.ragContext = ragContext.substring(0, 500) + '...'
        } else {
          console.log(`   No relevant RAG context found`)
        }
      } else {
        console.log(`   No knowledge bases assigned to this agent config - skipping RAG`)
      }
    } catch (ragError) {
      console.warn(`⚠️  RAG context fetch failed (continuing without RAG):`, ragError)
      ragContext = '' // Fail gracefully
    }
    
    // ========== STEP 5: Analyze Full Email Body ==========
    console.log('\n📧 STEP 5: Analyzing full email body...')
    
    const emailAnalysis = await analyzeFullEmail(
      emailPlainText,
      email.subject,
      {
        match_criteria: input.agentConfig.match_criteria,
        extraction_fields: input.agentConfig.extraction_fields,
        user_intent: input.agentConfig.user_intent,
        extraction_examples: input.agentConfig.extraction_examples,
        analysis_feedback: input.agentConfig.analysis_feedback
      },
      ragContext
    )
    
    console.log(`✅ Email analysis complete:`)
    console.log(`   Matched: ${emailAnalysis.matched ? 'YES' : 'NO'}`)
    console.log(`   Used chunking: ${emailAnalysis.usedChunking ? 'YES' : 'NO'}`)
    console.log(`   Confidence: ${(emailAnalysis.confidence * 100).toFixed(0)}%`)
    console.log(`   Fields extracted: ${Object.keys(emailAnalysis.extractedData).length}`)
    
    logDebugStep(debugRunId, 5, 'email-analysis-complete', {
      input_to_ai: {
        email_length: emailPlainText.length,
        match_criteria: input.agentConfig.match_criteria,
        extraction_fields: input.agentConfig.extraction_fields,
        user_intent: input.agentConfig.user_intent || null,
        extraction_examples: input.agentConfig.extraction_examples || null,
        analysis_feedback: input.agentConfig.analysis_feedback || null,
        rag_context_provided: !!ragContext,
      },
      ai_output: {
        matched: emailAnalysis.matched,
        used_chunking: emailAnalysis.usedChunking,
        confidence: emailAnalysis.confidence,
        extracted_fields: Object.keys(emailAnalysis.extractedData).length,
        extracted_data: emailAnalysis.extractedData,
        reasoning: emailAnalysis.reasoning
      },
      performance: {
        api_calls: emailAnalysis.usedChunking ? 'multiple (chunked)' : '1 (full context)',
        content_length: emailAnalysis.contentLength
      }
    })
    
    // ========== STEP 6: Analyze Scraped Pages ==========
    console.log('\n🌐 STEP 6: Analyzing scraped pages...')
    
    const scrapedAnalyses: FullContentAnalysisResult[] = []
    
    if (scrapedPages.length > 0) {
      console.log(`   Analyzing ${scrapedPages.length} pages in parallel...`)
      
      scrapedAnalyses.push(...await Promise.all(
        scrapedPages.map(page => analyzeScrapedPage(
          page,
          {
            match_criteria: input.agentConfig.match_criteria,
            extraction_fields: input.agentConfig.extraction_fields,
            user_intent: input.agentConfig.user_intent,
            extraction_examples: input.agentConfig.extraction_examples,
            analysis_feedback: input.agentConfig.analysis_feedback
          },
          ragContext
        ))
      ))
      
      console.log(`✅ Scraped page analysis complete:`)
      console.log(`   Pages analyzed: ${scrapedAnalyses.length}`)
      console.log(`   Pages matched: ${scrapedAnalyses.filter(a => a.matched).length}`)
      console.log(`   Pages chunked: ${scrapedAnalyses.filter(a => a.usedChunking).length}`)
      
    logDebugStep(debugRunId, 6, 'scraped-pages-analysis-complete', {
      total_pages: scrapedAnalyses.length,
      matched_pages: scrapedAnalyses.filter(a => a.matched).length,
      pages_requiring_chunking: scrapedAnalyses.filter(a => a.usedChunking).length,
      results: scrapedAnalyses.map(a => {
        const pageInfo = scrapedPages.find(p => p.url === a.source)
        return {
          original_url: a.source,  // SafeLinks URL
          actual_url: pageInfo?.metadata?.actualUrl || a.source,  // Real URL after redirect
          title: pageInfo?.title || 'Unknown',
          matched: a.matched,
          confidence: a.confidence,
          used_chunking: a.usedChunking,
          extracted_fields: Object.keys(a.extractedData).length,
          reasoning: a.reasoning
        }
      })
    })
    } else {
      console.log(`   No scraped pages to analyze`)
    }
    
    // ========== STEP 7: Aggregate Results ==========
    console.log('\n🔗 STEP 7: Aggregating results from email + scraped pages...')
    
    // Combine email analysis with scraped analyses
    const allAnalyses = [emailAnalysis, ...scrapedAnalyses]
    const matchedAnalyses = allAnalyses.filter(a => a.matched)
    
    // Build data by source for source attribution - INCLUDE ALL (matched + non-matched)
    const dataBySource = allAnalyses.map(a => ({
      source: a.source,
      data: a.extractedData,
      reasoning: a.reasoning,
      confidence: a.confidence,
      matched: a.matched  // NEW: Include match status so UI can show all sources
    }))
    
    // Merge all extracted data intelligently
    // Strategy: scraped pages provide detailed info, email provides summary
    const aggregatedData: Record<string, any> = {}
    
    // Start with email data (summary info)
    if (emailAnalysis.matched) {
      Object.assign(aggregatedData, emailAnalysis.extractedData)
    }
    
    // Layer in scraped page data (detailed info)
    // For arrays: merge and dedupe; For objects: merge keys; For primitives: prefer scraped
    for (const analysis of scrapedAnalyses) {
      if (!analysis.matched) continue
      
      for (const [key, value] of Object.entries(analysis.extractedData)) {
        if (aggregatedData[key] === undefined) {
          // New field - add it
          aggregatedData[key] = value
        } else if (Array.isArray(value) && Array.isArray(aggregatedData[key])) {
          // Merge arrays and dedupe
          aggregatedData[key] = [...new Set([...aggregatedData[key], ...value])]
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Merge objects
          aggregatedData[key] = { ...aggregatedData[key], ...value }
        } else {
          // For primitives, prefer scraped data (more detailed)
          aggregatedData[key] = value
        }
      }
    }
    
    // Calculate overall confidence (weighted average by matched content)
    const totalMatches = matchedAnalyses.length
    const overallConfidence = totalMatches > 0
      ? matchedAnalyses.reduce((sum, a) => sum + a.confidence, 0) / totalMatches
      : 0
    
    const aggregated = {
      matched: totalMatches > 0,
      totalMatches,
      aggregatedData,
      dataBySource,
      overallConfidence
    }
    
    debugData.finalResult = {
      matched: aggregated.matched,
      totalMatches: aggregated.totalMatches,
      aggregatedData: aggregated.aggregatedData,
      overallConfidence: aggregated.overallConfidence
    }
    
    console.log(`✅ Aggregation complete:`)
    console.log(`   Matched: ${aggregated.matched ? 'YES' : 'NO'}`)
    console.log(`   Sources matched: ${aggregated.totalMatches} (email + scraped pages)`)
    console.log(`   Sources with data: ${aggregated.dataBySource.length}`)
    console.log(`   Overall confidence: ${(aggregated.overallConfidence * 100).toFixed(0)}%`)
    console.log(`   Fields extracted: ${Object.keys(aggregated.aggregatedData).length}`)
    
    const apiCallsUsed = 
      1 + // intent extraction
      1 + // link prioritization
      (emailAnalysis.usedChunking ? 'multiple' : 1) + // email analysis
      scrapedAnalyses.reduce((sum, a) => sum + (a.usedChunking ? 'multiple' : 1), 0) // scraped analyses
    
    console.log(`   API calls: ~${typeof apiCallsUsed === 'number' ? apiCallsUsed : apiCallsUsed} (vs ${43} in old chunked approach)`)
    
    logDebugStep(debugRunId, 7, 'aggregation-complete', {
      matched: aggregated.matched,
      totalMatches: aggregated.totalMatches,
      overallConfidence: aggregated.overallConfidence,
      extractedFieldsCount: Object.keys(aggregated.aggregatedData).length,
      extractedData: aggregated.aggregatedData,
      dataBySource: aggregated.dataBySource,
      performance_improvement: {
        email_analysis_method: emailAnalysis.usedChunking ? 'chunked (large email)' : 'full context (1 API call)',
        scraped_pages_method: 'individual full-context analysis',
        total_sources_analyzed: allAnalyses.length,
        sources_requiring_chunking: allAnalyses.filter(a => a.usedChunking).length
      }
    })
    
    // ========== Finalize Debug Run ==========
    finalizeDebugRun(debugRunId, debugData)
    
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1)
    
    console.log('\n' + '═'.repeat(70))
    console.log(`✅ EMAIL ANALYSIS COMPLETE (${elapsedTime}s)`)
    console.log('═'.repeat(70))
    console.log(`Result: ${aggregated.matched ? '✓ MATCHED' : '✗ No match'}`)
    console.log(`Confidence: ${(aggregated.overallConfidence * 100).toFixed(0)}%`)
    console.log(`Debug: debug-analysis-runs/${debugRunId}`)
    console.log('═'.repeat(70) + '\n')
    
    // Build scraped_content object for storage
    const scrapedContent: Record<string, { markdown: string; title: string; scraped_at: string }> = {}
    scrapedPages.forEach(page => {
      scrapedContent[page.url] = {
        markdown: page.markdown,
        title: page.title,
        scraped_at: new Date().toISOString()
      }
    })
    
    // Return result
    return {
      success: true,
      emailId: input.emailId,
      matched: aggregated.matched,
      extractedData: aggregated.aggregatedData,
      dataBySource: aggregated.dataBySource,  // Source-attributed data
      scrapedUrls: scrapedPages.map(p => p.url),
      scrapedContent: Object.keys(scrapedContent).length > 0 ? scrapedContent : undefined,
      originalUrls: urlMappings.length > 0 ? urlMappings : undefined,  // SafeLinks → Actual URL mappings
      allLinksFound,
      emailHtmlBody: emailHtmlBody,
      reasoning: aggregated.totalMatches > 0
        ? `Matched in ${aggregated.totalMatches} source(s): ${matchedAnalyses.map(a => a.source).join(', ')}. ${emailAnalysis.matched ? emailAnalysis.reasoning : scrapedAnalyses.find(a => a.matched)?.reasoning || ''}`
        : 'No matches found in email or scraped pages',
      confidence: aggregated.overallConfidence
    }
    
  } catch (error) {
    console.error('\n❌ EMAIL ANALYSIS FAILED:', error)
    
    if (debugRunId) {
      logDebugStep(debugRunId, 99, 'error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      finalizeDebugRun(debugRunId, debugData)
    }
    
    return {
      success: false,
      emailId: input.emailId,
      matched: false,
      extractedData: {},
      dataBySource: [],
      scrapedUrls: [],
      scrapedContent: undefined,
      allLinksFound: [],
      emailHtmlBody: '',
      reasoning: 'Analysis failed',
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
