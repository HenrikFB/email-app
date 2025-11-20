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
import { extractTextFromHtml, chunkContent, getChunkStats } from './content-chunker'
import { analyzeChunksRecursively, aggregateResults } from './recursive-analyzer'
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
    debugRunId = initDebugRun(input.emailId, email.subject)
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
    
    // ========== STEP 2: Extract ALL Links from FULL Email HTML ==========
    console.log('\n🔗 STEP 2: Extracting links from FULL email HTML (before truncation)...')
    
    const allLinks = extractLinksFromHtml(emailHtmlBody) // No maxLinks limit!
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
        input.agentConfig.link_selection_guidance
      )
      
      console.log(`✅ Intent extracted:`)
      console.log(`   Refined goal: ${emailIntent.refinedGoal}`)
      console.log(`   Key terms: ${emailIntent.keyTerms.length > 0 ? emailIntent.keyTerms.join(', ') : 'None extracted'}`)
      console.log(`   Expected content: ${emailIntent.expectedContent}`)
      
      debugData.emailIntent = emailIntent
      
      logDebugStep(debugRunId, 2.5, 'intent-extraction', {
        refinedGoal: emailIntent.refinedGoal,
        keyTerms: emailIntent.keyTerms,
        expectedContent: emailIntent.expectedContent
      })
    } else {
      console.log('\n⏭️  STEP 2.5: Skipping intent extraction (follow_links=false or no links found)')
    }
    
    // ========== STEP 3: AI Link Prioritization ==========
    let selectedLinks: string[] = []
    
    if (input.agentConfig.follow_links && allLinks.length > 0) {
      console.log('\n🤖 STEP 3: AI prioritizing links with email context...')
      
      const prioritization = await prioritizeLinksWithAI(
        allLinks,
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
        totalLinks: allLinks.length,
        selectedCount: selectedLinks.length,
        duplicatesRemoved,
        selectedUrls: selectedLinks,
        reasoning: prioritization.reasoning
      })
    } else {
      console.log('\n⏭️  STEP 3: Skipping link scraping (follow_links=false or no links found)')
    }
    
    // ========== STEP 4: Retrieve Content from Selected Links ==========
    let scrapedPages: ScrapedPage[] = []
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
      
      // Convert to ScrapedPage format
      scrapedPages = retrievalResults
        .filter(result => result.success && result.content)
        .map(result => ({
          url: result.url,
          markdown: result.content,
          title: result.metadata.title || result.url
        }))
      
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
    
    // ========== STEP 5: Chunk Content ==========
    console.log('\n📦 STEP 5: Chunking content for recursive analysis...')
    
    const chunks = chunkContent(emailPlainText, scrapedPages)
    const chunkStats = getChunkStats(chunks)
    
    debugData.chunks = chunks.map(c => ({
      type: c.type,
      contentLength: c.charCount,
      source: c.source
    }))
    
    console.log(`✅ Created ${chunks.length} chunks:`)
    console.log(`   - Email chunks: ${chunkStats.emailChunks}`)
    console.log(`   - Scraped chunks: ${chunkStats.scrapedChunks}`)
    console.log(`   - Avg chunk size: ${chunkStats.avgChunkSize} chars`)
    
    logDebugStep(debugRunId, 5, 'chunking-complete', {
      totalChunks: chunks.length,
      emailChunks: chunkStats.emailChunks,
      scrapedChunks: chunkStats.scrapedChunks,
      avgChunkSize: chunkStats.avgChunkSize,
      chunks: debugData.chunks
    })
    
    // ========== STEP 6: Recursive Chunk Analysis (with RAG context) ==========
    console.log('\n🔄 STEP 6: Analyzing chunks recursively...')
    
    const chunkResults = await analyzeChunksRecursively(
      chunks,
      input.agentConfig.match_criteria,
      input.agentConfig.extraction_fields,
      ragContext, // Pass RAG context to analysis
      input.agentConfig.user_intent,
      input.agentConfig.extraction_examples,
      input.agentConfig.analysis_feedback
    )
    
    debugData.chunkAnalysisResults = chunkResults.map(r => ({
      chunkIndex: r.chunkIndex,
      matched: r.matched,
      confidence: r.confidence,
      reasoning: r.reasoning,
      extractedFieldsCount: Object.keys(r.extractedData).length
    }))
    
    logDebugStep(debugRunId, 6, 'chunk-analysis-complete', {
      totalChunks: chunkResults.length,
      matchedChunks: chunkResults.filter(r => r.matched).length,
      results: debugData.chunkAnalysisResults
    })
    
    // ========== STEP 7: Aggregate Results ==========
    console.log('\n🔗 STEP 7: Aggregating results from all chunks...')
    
    const aggregated = aggregateResults(chunkResults)
    
    debugData.finalResult = {
      matched: aggregated.matched,
      totalMatches: aggregated.totalMatches,
      aggregatedData: aggregated.aggregatedData,
      overallConfidence: aggregated.overallConfidence
    }
    
    console.log(`✅ Aggregation complete:`)
    console.log(`   Matched: ${aggregated.matched ? 'YES' : 'NO'}`)
    console.log(`   Chunks matched: ${aggregated.totalMatches}`)
    console.log(`   Sources with data: ${aggregated.dataBySource.length}`)
    console.log(`   Overall confidence: ${(aggregated.overallConfidence * 100).toFixed(0)}%`)
    console.log(`   Fields extracted: ${Object.keys(aggregated.aggregatedData).length}`)
    
    logDebugStep(debugRunId, 7, 'aggregation-complete', {
      matched: aggregated.matched,
      totalMatches: aggregated.totalMatches,
      overallConfidence: aggregated.overallConfidence,
      extractedFieldsCount: Object.keys(aggregated.aggregatedData).length,
      extractedData: aggregated.aggregatedData,
      dataBySource: aggregated.dataBySource
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
      dataBySource: aggregated.dataBySource,  // NEW: Include source-attributed data
      scrapedUrls: scrapedPages.map(p => p.url),
      scrapedContent: Object.keys(scrapedContent).length > 0 ? scrapedContent : undefined,
      allLinksFound,
      emailHtmlBody: emailHtmlBody,
      reasoning: aggregated.totalMatches > 0
        ? `Matched in ${aggregated.totalMatches} chunks. ${debugData.chunkAnalysisResults?.find(r => r.matched)?.reasoning || ''}`
        : 'No matches found in any chunks',
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
