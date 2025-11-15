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
import { prioritizeLinksWithAI } from './link-prioritization'
import { scrapeUrls } from '@/lib/firecrawl/client'
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
import type { AnalysisJobInput, AnalysisJobResult, ScrapedPage } from './types'

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
    
    // ========== STEP 3: AI Link Prioritization ==========
    let selectedLinks: string[] = []
    
    if (input.agentConfig.follow_links && allLinks.length > 0) {
      console.log('\n🤖 STEP 3: AI prioritizing links (no limit - relevance-based)...')
      
      const prioritization = await prioritizeLinksWithAI(
        allLinks,
        input.agentConfig.match_criteria,
        input.agentConfig.extraction_fields,
        input.agentConfig.button_text_pattern
      )
      
      selectedLinks = prioritization.selectedUrls
      debugData.aiSelectedLinks = selectedLinks
      
      console.log(`✅ AI selected ${selectedLinks.length}/${allLinks.length} relevant links`)
      
      logDebugStep(debugRunId, 3, 'ai-link-prioritization', {
        totalLinks: allLinks.length,
        selectedCount: selectedLinks.length,
        selectedUrls: selectedLinks,
        reasoning: prioritization.reasoning
      })
    } else {
      console.log('\n⏭️  STEP 3: Skipping link scraping (follow_links=false or no links found)')
    }
    
    // ========== STEP 4: Scrape Selected Links ==========
    let scrapedPages: ScrapedPage[] = []
    debugData.scrapingAttempts = []
    debugData.scrapedContent = []
    
    if (selectedLinks.length > 0) {
      console.log('\n🌐 STEP 4: Scraping selected links with retry logic...')
      
      const scrapeResults = await scrapeUrls(selectedLinks, {
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 3000,  // Wait for redirects/JS
        maxRetries: 3,   // Retry on failure
      })
      
      scrapedPages = scrapeResults.map(result => ({
        url: result.url,
        markdown: result.markdown || '',
        title: result.metadata?.title || result.url
      }))
      
      debugData.scrapingAttempts = selectedLinks.map(url => {
        const wasScraped = scrapedPages.some(p => p.url === url)
        return {
          url,
          attempts: 1, // We don't track individual attempts here
          success: wasScraped,
          error: wasScraped ? undefined : 'Scraping failed'
        }
      })
      
      debugData.scrapedContent = scrapedPages.map(p => ({
        url: p.url,
        markdownLength: p.markdown.length,
        title: p.title
      }))
      
      console.log(`✅ Successfully scraped ${scrapedPages.length}/${selectedLinks.length} pages`)
      
      logDebugStep(debugRunId, 4, 'scraping-complete', {
        urlsToScrape: selectedLinks.length,
        successfulScrapes: scrapedPages.length,
        failedScrapes: selectedLinks.length - scrapedPages.length,
        scrapedContent: debugData.scrapedContent
      })
    } else {
      console.log('\n⏭️  STEP 4: No links to scrape')
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
    
    // ========== STEP 6: Recursive Chunk Analysis ==========
    console.log('\n🔄 STEP 6: Analyzing chunks recursively...')
    
    const chunkResults = await analyzeChunksRecursively(
      chunks,
      input.agentConfig.match_criteria,
      input.agentConfig.extraction_fields
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
    console.log(`   Overall confidence: ${(aggregated.overallConfidence * 100).toFixed(0)}%`)
    console.log(`   Fields extracted: ${Object.keys(aggregated.aggregatedData).length}`)
    
    logDebugStep(debugRunId, 7, 'aggregation-complete', {
      matched: aggregated.matched,
      totalMatches: aggregated.totalMatches,
      overallConfidence: aggregated.overallConfidence,
      extractedFieldsCount: Object.keys(aggregated.aggregatedData).length,
      extractedData: aggregated.aggregatedData
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
    
    // Return result
    return {
      success: true,
      emailId: input.emailId,
      matched: aggregated.matched,
      extractedData: aggregated.aggregatedData,
      scrapedUrls: scrapedPages.map(p => p.url),
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
      scrapedUrls: [],
      allLinksFound: [],
      emailHtmlBody: '',
      reasoning: 'Analysis failed',
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
