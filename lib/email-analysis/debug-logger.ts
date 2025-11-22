/**
 * Debug Logger for Email Analysis
 * Stores detailed run data in local folders for inspection
 */

import * as fs from 'fs'
import * as path from 'path'

const DEBUG_ENABLED = process.env.EMAIL_ANALYSIS_DEBUG === 'true'
const DEBUG_DIR = path.join(process.cwd(), 'debug-analysis-runs')

export interface AnalysisDebugData {
  runId: string
  emailId: string
  timestamp: string
  
  // Agent Configuration (ALL fields for debugging)
  agentConfig: {
    match_criteria: string
    extraction_fields: string
    user_intent?: string
    link_selection_guidance?: string
    extraction_examples?: string
    analysis_feedback?: string
    button_text_pattern?: string
    follow_links: boolean
    max_links_to_scrape?: number
    content_retrieval_strategy?: string
  }
  
  // Step 1: Email fetching
  emailSubject: string
  emailFrom: string
  emailBodyLength: number
  emailHtmlLength: number
  
  // Step 2: Link extraction
  allLinksExtracted: Array<{ url: string; text: string; isButton: boolean }>
  
  // Step 2.5: Email intent extraction (NEW!)
  emailIntent?: {
    refinedGoal: string
    keyTerms: string[]
    expectedContent: string
  }
  
  // Step 3: AI link prioritization
  aiPrioritizationPrompt?: string
  aiPrioritizationResponse?: string
  aiSelectedLinks?: string[]
  
  // Step 4: Content retrieval
  contentRetrievalStrategy?: string
  scrapingAttempts: Array<{
    url: string
    attempts: number
    success: boolean
    error?: string
    source?: string  // firecrawl/tavily/hybrid
  }>
  scrapedContent: Array<{
    url: string
    markdownLength: number
    title?: string
  }>
  
  // Step 4.5: RAG context
  ragContext?: string
  
  // Step 5: Email Analysis (NEW - full context)
  emailAnalysis?: {
    matched: boolean
    usedChunking: boolean
    confidence: number
    extractedData: Record<string, unknown>
    reasoning: string
    contentLength: number
  }
  
  // Step 6: Scraped Pages Analysis (NEW - parallel full-context)
  scrapedPagesAnalysis?: {
    totalPages: number
    matchedPages: number
    pagesRequiringChunking: number
    results: Array<{
      source: string
      matched: boolean
      confidence: number
      used_chunking: boolean
      extracted_fields: number
      reasoning: string
    }>
  }
  
  // Step 7: Final aggregation
  finalResult: {
    matched: boolean
    totalMatches: number
    aggregatedData: Record<string, unknown>
    overallConfidence: number
    dataBySource?: Array<{
      source: string
      data: Record<string, unknown>
      confidence: number
    }>
  }
}

/**
 * Initialize debug logger for a new analysis run
 */
export function initDebugRun(
  emailId: string, 
  emailSubject: string,
  agentConfig: {
    match_criteria: string
    extraction_fields: string
    user_intent?: string
    link_selection_guidance?: string
    extraction_examples?: string
    analysis_feedback?: string
    button_text_pattern?: string
    follow_links: boolean
    max_links_to_scrape?: number
    content_retrieval_strategy?: string
  }
): string {
  if (!DEBUG_ENABLED) return ''
  
  const runId = `${Date.now()}-${emailId.substring(0, 8)}`
  const runDir = path.join(DEBUG_DIR, runId)
  
  try {
    // Create debug directory if it doesn't exist
    if (!fs.existsSync(DEBUG_DIR)) {
      fs.mkdirSync(DEBUG_DIR, { recursive: true })
    }
    
    // Create run directory
    fs.mkdirSync(runDir, { recursive: true })
    
    // Create comprehensive metadata file with ALL agent configuration fields
    const metadata = {
      runId,
      emailId,
      emailSubject,
      timestamp: new Date().toISOString(),
      startedAt: Date.now(),
      
      // Store ALL agent configuration fields for debugging
      agentConfig: {
        match_criteria: agentConfig.match_criteria,
        extraction_fields: agentConfig.extraction_fields,
        user_intent: agentConfig.user_intent || null,
        link_selection_guidance: agentConfig.link_selection_guidance || null,
        extraction_examples: agentConfig.extraction_examples || null,
        analysis_feedback: agentConfig.analysis_feedback || null,
        button_text_pattern: agentConfig.button_text_pattern || null,
        follow_links: agentConfig.follow_links,
        max_links_to_scrape: agentConfig.max_links_to_scrape || 10,
        content_retrieval_strategy: agentConfig.content_retrieval_strategy || 'scrape_only',
      },
      
      // Track which new features are being used
      features_used: {
        has_user_intent: !!agentConfig.user_intent,
        has_extraction_examples: !!agentConfig.extraction_examples,
        has_analysis_feedback: !!agentConfig.analysis_feedback,
        has_link_guidance: !!agentConfig.link_selection_guidance,
        uses_web_search: agentConfig.content_retrieval_strategy !== 'scrape_only',
      }
    }
    
    fs.writeFileSync(
      path.join(runDir, '00-metadata.json'),
      JSON.stringify(metadata, null, 2)
    )
    
    console.log(`\n📁 Debug folder created: debug-analysis-runs/${runId}`)
    console.log(`   Agent Config: ${Object.keys(agentConfig).length} fields`)
    if (metadata.features_used.has_extraction_examples) {
      console.log(`   📋 Using extraction examples`)
    }
    if (metadata.features_used.has_analysis_feedback) {
      console.log(`   💡 Using analysis feedback`)
    }
  } catch (error) {
    console.error('Failed to create debug folder:', error)
  }
  
  return runId
}

/**
 * Log step data to debug folder
 */
export function logDebugStep(
  runId: string,
  stepNumber: number,
  stepName: string,
  data: Record<string, unknown>
): void {
  if (!DEBUG_ENABLED || !runId) return
  
  try {
    const runDir = path.join(DEBUG_DIR, runId)
    const fileName = `${String(stepNumber).padStart(2, '0')}-${stepName}.json`
    
    fs.writeFileSync(
      path.join(runDir, fileName),
      JSON.stringify(data, null, 2)
    )
    
    console.log(`📝 Logged: ${fileName}`)
  } catch (error) {
    console.error(`Failed to log debug step ${stepName}:`, error)
  }
}

/**
 * Log raw text content to debug folder
 */
export function logDebugText(
  runId: string,
  fileName: string,
  content: string
): void {
  if (!DEBUG_ENABLED || !runId) return
  
  try {
    const runDir = path.join(DEBUG_DIR, runId)
    fs.writeFileSync(path.join(runDir, fileName), content)
    console.log(`📝 Logged: ${fileName}`)
  } catch (error) {
    console.error(`Failed to log text file ${fileName}:`, error)
  }
}

/**
 * Finalize debug run with summary
 */
export function finalizeDebugRun(
  runId: string,
  debugData: Partial<AnalysisDebugData>
): void {
  if (!DEBUG_ENABLED || !runId) return
  
  try {
    const runDir = path.join(DEBUG_DIR, runId)
    
    // Write complete debug data
    fs.writeFileSync(
      path.join(runDir, '99-complete-run-data.json'),
      JSON.stringify({
        ...debugData,
        completedAt: Date.now(),
        timestamp: new Date().toISOString()
      }, null, 2)
    )
    
    // Write human-readable summary
    const summary = generateSummary(debugData)
    fs.writeFileSync(
      path.join(runDir, 'SUMMARY.md'),
      summary
    )
    
    console.log(`\n✅ Debug run complete: debug-analysis-runs/${runId}`)
    console.log(`📊 View summary: debug-analysis-runs/${runId}/SUMMARY.md\n`)
  } catch (error) {
    console.error('Failed to finalize debug run:', error)
  }
}

function generateSummary(data: Partial<AnalysisDebugData>): string {
  const agentConfig = data.agentConfig || {
    match_criteria: '',
    extraction_fields: '',
    follow_links: false
  }
  const emailIntent = data.emailIntent
  
  return `# Email Analysis Debug Summary

## Run Information
- **Run ID**: ${data.runId}
- **Email ID**: ${data.emailId}
- **Timestamp**: ${data.timestamp}
- **Subject**: ${data.emailSubject}
- **From**: ${data.emailFrom}

---

## Agent Configuration (What the AI was told to do)

### Core Criteria
- **Match Criteria**: ${agentConfig.match_criteria || 'N/A'}
- **Extraction Fields**: ${agentConfig.extraction_fields || 'N/A'}
- **User Intent**: ${agentConfig.user_intent || '(not provided)'}

### Link Processing Settings
- **Follow Links**: ${agentConfig.follow_links ? 'Yes' : 'No'}
- **Content Retrieval Strategy**: \`${agentConfig.content_retrieval_strategy || 'scrape_only'}\`
  ${agentConfig.content_retrieval_strategy === 'search_only' ? '→ Using web search only (for auth-required URLs like LinkedIn)' : ''}
  ${agentConfig.content_retrieval_strategy === 'scrape_and_search' ? '→ Using both scraping AND web search (most comprehensive)' : ''}
  ${agentConfig.content_retrieval_strategy === 'scrape_only' ? '→ Using Firecrawl scraping only' : ''}
- **Max Links to Scrape**: ${agentConfig.max_links_to_scrape || 10}
- **Button Text Pattern**: ${agentConfig.button_text_pattern || '(not provided)'}
- **Link Selection Guidance**: ${agentConfig.link_selection_guidance || '(not provided)'}

### AI Guidance Fields (NEW!)
- **Extraction Examples Provided**: ${agentConfig.extraction_examples ? '✅ YES - AI knows exact output format' : '❌ No'}
${agentConfig.extraction_examples ? `
  Example format provided:
  \`\`\`
  ${agentConfig.extraction_examples.substring(0, 200)}${agentConfig.extraction_examples.length > 200 ? '...' : ''}
  \`\`\`
` : ''}
- **Analysis Feedback Provided**: ${agentConfig.analysis_feedback ? '✅ YES - AI knows what to avoid' : '❌ No'}
${agentConfig.analysis_feedback ? `
  Feedback provided:
  \`\`\`
  ${agentConfig.analysis_feedback.substring(0, 200)}${agentConfig.analysis_feedback.length > 200 ? '...' : ''}
  \`\`\`
` : ''}

---

## Step 1: Email Fetching
- **Body Length**: ${data.emailBodyLength} chars
- **HTML Length**: ${data.emailHtmlLength} chars

---

## Step 2: Link Extraction
- **Total Links Found**: ${data.allLinksExtracted?.length || 0}
- **Links by Type**:
  - Buttons: ${data.allLinksExtracted?.filter(l => l.isButton).length || 0}
  - Regular Links: ${data.allLinksExtracted?.filter(l => !l.isButton).length || 0}

---

## Step 2.5: Email Intent Analysis (NEW!)
${emailIntent?.refinedGoal ? `
**Purpose**: Understand what the user is ACTUALLY looking for beyond surface keywords

**Inputs to AI**:
- Email subject: "${data.emailSubject}"
- Email content: ${data.emailBodyLength} chars
- User intent: ${agentConfig.user_intent ? '✅ Provided' : '❌ Not provided'}
- Extraction examples: ${agentConfig.extraction_examples ? '✅ Provided' : '❌ Not provided'}
- Analysis feedback: ${agentConfig.analysis_feedback ? '✅ Provided' : '❌ Not provided'}

**AI's Understanding**:
- **Refined Goal**: ${emailIntent.refinedGoal}
- **Key Terms Extracted**: ${emailIntent.keyTerms?.join(', ') || 'N/A'}
- **Expected Content**: ${emailIntent.expectedContent}

**Why This Matters**: Link text is often generic ("View Details", "Read More"). The AI extracted these key terms to understand what should be INSIDE the links to match the user's actual needs.
` : '(Step 2.5 was skipped - no email intent extraction performed)'}

---

## Step 3: AI Link Prioritization

**Inputs to AI**:
- Total links to evaluate: ${data.allLinksExtracted?.length || 0}
- Email intent: ${emailIntent?.refinedGoal ? '✅ Used' : '❌ Not available'}
- Link selection guidance: ${agentConfig.link_selection_guidance ? '✅ Provided' : '❌ Not provided'}
- Extraction examples: ${agentConfig.extraction_examples ? '✅ Helped AI understand relevance' : '❌ Not provided'}
- Analysis feedback: ${agentConfig.analysis_feedback ? '✅ Helped AI avoid past mistakes' : '❌ Not provided'}

**AI's Decision**:
- **Links Selected**: ${data.aiSelectedLinks?.length || 0} out of ${data.allLinksExtracted?.length || 0}
- **After Deduplication & Max Limit**: Final count may differ

**AI Reasoning**: The AI evaluated each link asking: "Would this link lead to a page containing information matching the user's key terms and goal?" Generic link text is expected.

---

## Step 4: Content Retrieval
- **Strategy Used**: \`${agentConfig.content_retrieval_strategy || 'scrape_only'}\`
- **URLs to Retrieve**: ${data.scrapedContent?.length || 0}
- **Successful Retrievals**: ${data.scrapingAttempts?.filter(a => a.success).length || 0}
- **Failed Retrievals**: ${data.scrapingAttempts?.filter(a => !a.success).length || 0}
${data.scrapingAttempts?.some(a => a.source) ? `
- **Sources Used**: ${[...new Set(data.scrapingAttempts.map(a => a.source).filter(Boolean))].join(', ')}
` : ''}

---

## Step 5: Full Email Body Analysis (NEW OPTIMIZED APPROACH!)

**What Changed**: Instead of chunking the email into many pieces, we now analyze the FULL email body in ONE API call when possible.

**Performance**:
- **Email Length**: ${data.emailBodyLength} chars
- **Used Chunking**: ${data.emailAnalysis?.usedChunking ? '⚠️ YES (email was exceptionally large)' : '✅ NO (analyzed in 1 API call)'}
- **API Calls**: ${data.emailAnalysis?.usedChunking ? 'Multiple (chunked fallback)' : '1 (full context) 🎉'}

**Inputs to AI**:
- Match criteria: ✅ Provided
- Extraction fields: ✅ Provided
- User intent: ${agentConfig.user_intent ? '✅ AI knows WHY user needs data' : '❌ Not provided'}
- Extraction examples: ${agentConfig.extraction_examples ? '✅ AI knows EXACT output format' : '❌ Not provided'}
- Analysis feedback: ${agentConfig.analysis_feedback ? '✅ AI avoids documented mistakes' : '❌ Not provided'}
- RAG context: ${data.ragContext ? '✅ Provided from knowledge bases' : '❌ Not used'}

**Email Analysis Result**:
- **Matched**: ${data.emailAnalysis?.matched ? '✅ YES' : '❌ NO'}
- **Confidence**: ${data.emailAnalysis?.confidence ? (data.emailAnalysis.confidence * 100).toFixed(1) + '%' : 'N/A'}
- **Fields Extracted**: ${data.emailAnalysis?.extractedData ? Object.keys(data.emailAnalysis.extractedData).length : 0}

---

## Step 6: Scraped Pages Analysis (PARALLEL FULL-CONTEXT)

**What Changed**: Each scraped page is now analyzed INDIVIDUALLY and IN PARALLEL, not chunked.

**Performance**:
- **Pages to Analyze**: ${data.scrapedPagesAnalysis?.totalPages || data.scrapedContent?.length || 0}
- **Pages Matched**: ${data.scrapedPagesAnalysis?.matchedPages || 0}
- **Pages Requiring Chunking**: ${data.scrapedPagesAnalysis?.pagesRequiringChunking || 0} (only for very large pages)
- **API Calls**: ${data.scrapedPagesAnalysis?.totalPages || data.scrapedContent?.length || 0} calls (1 per page, all in parallel) 🚀

**Why This is Better**:
- ✅ Each page analyzed in full context (AI sees complete page, not fragments)
- ✅ Better source attribution (know exactly which URL provided which data)
- ✅ Faster (parallel processing)
- ✅ Fewer total API calls (no chunking unless necessary)

**Results by Source**:
${data.scrapedPagesAnalysis?.results?.map((r, i) => `
${i + 1}. **${r.source}**
   - Matched: ${r.matched ? '✅ YES' : '❌ NO'}
   - Confidence: ${(r.confidence * 100).toFixed(1)}%
   - Used Chunking: ${r.used_chunking ? '⚠️ YES' : '✅ NO'}
   - Reasoning: ${r.reasoning.substring(0, 150)}${r.reasoning.length > 150 ? '...' : ''}
`).join('') || '(No scraped pages analyzed)'}

**Features Impact**:
${agentConfig.user_intent ? '✅ User Intent guided AI to extract data aligned with user\'s end goal\n' : ''}
${agentConfig.extraction_examples ? '✅ Extraction Examples ensured consistent output format\n' : ''}
${agentConfig.analysis_feedback ? '✅ Analysis Feedback prevented AI from repeating past mistakes\n' : ''}

---

## Step 7: Final Aggregation & Result

**Overall Match**: ${data.finalResult?.matched ? '✅ YES - Content matched user criteria' : '❌ NO - No matching content found'}

**Statistics**:
- **Total Sources Matched**: ${data.finalResult?.totalMatches || 0} (email + scraped pages)
- **Overall Confidence**: ${data.finalResult?.overallConfidence ? (data.finalResult.overallConfidence * 100).toFixed(1) + '%' : 'N/A'}
- **Fields Extracted**: ${Object.keys(data.finalResult?.aggregatedData || {}).length}

**Source Attribution** (NEW!):
${data.finalResult?.dataBySource?.map((s, i) => `
${i + 1}. **${s.source}**
   - Fields: ${Object.keys(s.data).length}
   - Confidence: ${(s.confidence * 100).toFixed(1)}%
`).join('') || '(No source attribution data)'}

---

## 📈 Performance Improvements (vs Old Chunked Approach)

**Old Approach (Chunking Everything)**:
- Email chunked into: ~${Math.ceil((data.emailBodyLength || 0) / 3000)} chunks
- Scraped pages chunked into: ~${Math.ceil(((data.scrapedContent || []).reduce((sum, p) => sum + (p.markdownLength || 0), 0)) / 3000)} chunks
- **Total API calls**: ~${1 + 1 + Math.ceil((data.emailBodyLength || 0) / 3000) + Math.ceil(((data.scrapedContent || []).reduce((sum, p) => sum + (p.markdownLength || 0), 0)) / 3000)} (intent + prioritize + email chunks + scraped chunks)

**New Approach (Full Context)**:
- Email: ${data.emailAnalysis?.usedChunking ? 'Chunked (large)' : '✅ 1 API call (full context)'}
- Scraped pages: ✅ ${(data.scrapedContent || []).length} API calls (1 per page, parallel)
- **Total API calls**: ~${2 + (data.emailAnalysis?.usedChunking ? Math.ceil((data.emailBodyLength || 0) / 3000) : 1) + (data.scrapedContent || []).length} (intent + prioritize + email + pages)

**Savings**: ~${Math.max(0, (1 + 1 + Math.ceil((data.emailBodyLength || 0) / 3000) + Math.ceil(((data.scrapedContent || []).reduce((sum, p) => sum + (p.markdownLength || 0), 0)) / 3000)) - (2 + (data.emailAnalysis?.usedChunking ? Math.ceil((data.emailBodyLength || 0) / 3000) : 1) + (data.scrapedContent || []).length))} fewer API calls = **${Math.round(Math.max(0, (1 - ((2 + (data.emailAnalysis?.usedChunking ? Math.ceil((data.emailBodyLength || 0) / 3000) : 1) + (data.scrapedContent || []).length) / (1 + 1 + Math.ceil((data.emailBodyLength || 0) / 3000) + Math.ceil(((data.scrapedContent || []).reduce((sum, p) => sum + (p.markdownLength || 0), 0)) / 3000))))) * 100)}% cost reduction** 💰

${data.finalResult?.aggregatedData && Object.keys(data.finalResult.aggregatedData).length > 0 ? `
## 📊 Extracted Data

\`\`\`json
${JSON.stringify(data.finalResult.aggregatedData, null, 2)}
\`\`\`
` : '**No data extracted** - content did not match user criteria'}

---

## 🔍 Debug Insights

### Features Used in This Run
- User Intent: ${agentConfig.user_intent ? '✅' : '❌'}
- Extraction Examples: ${agentConfig.extraction_examples ? '✅' : '❌'}
- Analysis Feedback: ${agentConfig.analysis_feedback ? '✅' : '❌'}
- Link Selection Guidance: ${agentConfig.link_selection_guidance ? '✅' : '❌'}
- Web Search: ${agentConfig.content_retrieval_strategy !== 'scrape_only' ? '✅' : '❌'}
- RAG/Knowledge Bases: ${data.ragContext ? '✅' : '❌'}

### Recommendations
${!agentConfig.user_intent ? '💡 Consider adding **user_intent** to help AI understand WHY you need this data\n' : ''}
${!agentConfig.extraction_examples ? '💡 Consider adding **extraction_examples** to get consistent output format\n' : ''}
${!agentConfig.analysis_feedback ? '💡 If extraction is not perfect, add **analysis_feedback** to prevent repeated errors\n' : ''}
${!agentConfig.link_selection_guidance && data.allLinksExtracted && data.allLinksExtracted.length > 20 ? '💡 Many links found - consider adding **link_selection_guidance**\n' : ''}

---

## 📁 Files in This Debug Run

- \`00-metadata.json\` - Full configuration and run metadata
- \`01-email-fetched.json\` - Raw email data
- \`01-email-html.html\` - Email HTML
- \`01-email-plain-text.txt\` - Email plain text
- \`02-links-extracted.json\` - All links found
- \`2.5-intent-extraction.json\` - Email intent analysis
- \`03-ai-link-prioritization.json\` - AI's link selection reasoning
- \`04-content-retrieval-complete.json\` - Retrieved content (scraped/searched)
- \`05-email-analysis-complete.json\` - **NEW!** Full email body analysis (1 API call)
- \`06-scraped-pages-analysis-complete.json\` - **NEW!** Individual page analyses (parallel)
- \`07-aggregation-complete.json\` - Final aggregated data with source attribution
- \`99-complete-run-data.json\` - Everything in one file
- \`SUMMARY.md\` - This human-readable summary

---

*Generated at ${new Date().toISOString()}*
*Debug Mode: ${process.env.EMAIL_ANALYSIS_DEBUG === 'true' ? 'ENABLED' : 'DISABLED'}*
`
}

/**
 * Clean up old debug runs (keep last 10)
 */
export function cleanupOldDebugRuns(): void {
  if (!DEBUG_ENABLED) return
  
  try {
    if (!fs.existsSync(DEBUG_DIR)) return
    
    const runs = fs.readdirSync(DEBUG_DIR)
      .filter(name => fs.statSync(path.join(DEBUG_DIR, name)).isDirectory())
      .sort()
      .reverse() // Newest first
    
    if (runs.length > 10) {
      console.log(`🧹 Cleaning up ${runs.length - 10} old debug runs...`)
      
      runs.slice(10).forEach(runDir => {
        const runPath = path.join(DEBUG_DIR, runDir)
        fs.rmSync(runPath, { recursive: true, force: true })
      })
    }
  } catch (error) {
    console.error('Failed to cleanup old debug runs:', error)
  }
}

