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
  
  // Step 5: Chunking
  chunks: Array<{
    type: 'email' | 'scraped'
    contentLength: number
    source?: string
  }>
  
  // Step 6: Recursive analysis
  chunkAnalysisPrompt?: string  // Sample of the prompt used
  chunkAnalysisResults: Array<{
    chunkIndex: number
    matched: boolean
    confidence: number
    reasoning: string
    extractedFieldsCount: number
  }>
  
  // Step 7: Final aggregation
  finalResult: {
    matched: boolean
    totalMatches: number
    aggregatedData: Record<string, any>
    overallConfidence: number
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
  data: any
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
  const agentConfig = (data as any).agentConfig || {}
  const emailIntent = (data as any).emailIntent || {}
  const featuresUsed = (data as any).features_used || {}
  
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
${emailIntent.refinedGoal ? `
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

**Why This Matters**: Link text is often generic ("Software Developer", "View Job"). The AI extracted these key terms to understand what should be INSIDE the links to match the user's actual needs.
` : '(Step 2.5 was skipped - no email intent extraction performed)'}

---

## Step 3: AI Link Prioritization

**Inputs to AI**:
- Total links to evaluate: ${data.allLinksExtracted?.length || 0}
- Email intent: ${emailIntent.refinedGoal ? '✅ Used' : '❌ Not available'}
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

## Step 5: Content Chunking
- **Total Chunks Created**: ${data.chunks?.length || 0}
- **Email Chunks**: ${data.chunks?.filter(c => c.type === 'email').length || 0}
- **Scraped Content Chunks**: ${data.chunks?.filter(c => c.type === 'scraped').length || 0}

**Why Chunking**: Large content is broken into manageable pieces so the AI can analyze each thoroughly without token limits.

---

## Step 6: Recursive Chunk Analysis (WHERE EXTRACTION HAPPENS)

**Inputs to AI for EACH chunk**:
- Match criteria: ✅ Provided
- Extraction fields: ✅ Provided  
- User intent: ${agentConfig.user_intent ? '✅ AI knows WHY user needs data' : '❌ Not provided (AI doesn\'t know the "why")'}
- Extraction examples: ${agentConfig.extraction_examples ? '✅ AI knows EXACT output format' : '❌ Not provided (AI guesses format)'}
- Analysis feedback: ${agentConfig.analysis_feedback ? '✅ AI avoids documented mistakes' : '❌ Not provided (AI may repeat errors)'}
- RAG context: ${(data as any).ragContextLength ? '✅ Provided from knowledge bases' : '❌ Not used'}

**Results**:
- **Chunks Analyzed**: ${data.chunkAnalysisResults?.length || 0}
- **Chunks Matched**: ${data.chunkAnalysisResults?.filter(r => r.matched).length || 0}
- **Average Confidence**: ${data.chunkAnalysisResults?.length 
    ? (data.chunkAnalysisResults.reduce((sum, r) => sum + r.confidence, 0) / data.chunkAnalysisResults.length * 100).toFixed(1) + '%'
    : 'N/A'}

**Features Impact**:
${agentConfig.user_intent ? '✅ User Intent guided AI to extract data aligned with user\'s end goal' : ''}
${agentConfig.extraction_examples ? '✅ Extraction Examples ensured consistent output format' : ''}
${agentConfig.analysis_feedback ? '✅ Analysis Feedback prevented AI from repeating past mistakes' : ''}

---

## Step 7: Final Aggregation & Result

**Overall Match**: ${data.finalResult?.matched ? '✅ YES - Content matched user criteria' : '❌ NO - No matching content found'}

**Statistics**:
- **Total Matches**: ${data.finalResult?.totalMatches || 0} chunks
- **Overall Confidence**: ${data.finalResult?.overallConfidence ? (data.finalResult.overallConfidence * 100).toFixed(1) + '%' : 'N/A'}
- **Fields Extracted**: ${Object.keys(data.finalResult?.aggregatedData || {}).length}

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
- RAG/Knowledge Bases: ${(data as any).ragContextLength ? '✅' : '❌'}

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
- \`02.5-intent-extraction.json\` - Email intent analysis (NEW!)
- \`03-ai-link-prioritization.json\` - AI's link selection reasoning
- \`04-scraping-complete.json\` / \`04-content-retrieval-complete.json\` - Retrieved content
- \`05-chunking-complete.json\` - Content chunks
- \`06-chunk-analysis-complete.json\` - AI extraction results
- \`07-aggregation-complete.json\` - Final aggregated data
- \`99-complete-run-data.json\` - Everything in one file

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

