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
  
  // Step 1: Email fetching
  emailSubject: string
  emailFrom: string
  emailBodyLength: number
  emailHtmlLength: number
  
  // Step 2: Link extraction
  allLinksExtracted: Array<{ url: string; text: string; isButton: boolean }>
  
  // Step 3: AI link prioritization
  aiPrioritizationPrompt?: string
  aiSelectedLinks?: string[]
  
  // Step 4: Scraping
  scrapingAttempts: Array<{
    url: string
    attempts: number
    success: boolean
    error?: string
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
export function initDebugRun(emailId: string, emailSubject: string): string {
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
    
    // Create initial metadata file
    fs.writeFileSync(
      path.join(runDir, '00-metadata.json'),
      JSON.stringify({
        runId,
        emailId,
        emailSubject,
        timestamp: new Date().toISOString(),
        startedAt: Date.now()
      }, null, 2)
    )
    
    console.log(`\n📁 Debug folder created: debug-analysis-runs/${runId}`)
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
  return `# Email Analysis Debug Summary

## Run Information
- **Run ID**: ${data.runId}
- **Email ID**: ${data.emailId}
- **Timestamp**: ${data.timestamp}
- **Subject**: ${data.emailSubject}
- **From**: ${data.emailFrom}

## Step 1: Email Fetching
- Body Length: ${data.emailBodyLength} chars
- HTML Length: ${data.emailHtmlLength} chars

## Step 2: Link Extraction
- Total Links Found: ${data.allLinksExtracted?.length || 0}
- Links by Type:
  - Buttons: ${data.allLinksExtracted?.filter(l => l.isButton).length || 0}
  - Regular Links: ${data.allLinksExtracted?.filter(l => !l.isButton).length || 0}

## Step 3: AI Link Prioritization
- Links Selected by AI: ${data.aiSelectedLinks?.length || 0}

## Step 4: Scraping
- URLs Scraped: ${data.scrapedContent?.length || 0}
- Successful Scrapes: ${data.scrapingAttempts?.filter(a => a.success).length || 0}
- Failed Scrapes: ${data.scrapingAttempts?.filter(a => !a.success).length || 0}

## Step 5: Chunking
- Total Chunks Created: ${data.chunks?.length || 0}
- Email Chunks: ${data.chunks?.filter(c => c.type === 'email').length || 0}
- Scraped Content Chunks: ${data.chunks?.filter(c => c.type === 'scraped').length || 0}

## Step 6: Recursive Analysis
- Chunks Analyzed: ${data.chunkAnalysisResults?.length || 0}
- Chunks Matched: ${data.chunkAnalysisResults?.filter(r => r.matched).length || 0}
- Average Confidence: ${data.chunkAnalysisResults?.length 
    ? (data.chunkAnalysisResults.reduce((sum, r) => sum + r.confidence, 0) / data.chunkAnalysisResults.length).toFixed(2)
    : 'N/A'}

## Step 7: Final Result
- **Overall Match**: ${data.finalResult?.matched ? '✅ YES' : '❌ NO'}
- **Total Matches**: ${data.finalResult?.totalMatches || 0}
- **Overall Confidence**: ${data.finalResult?.overallConfidence?.toFixed(2) || 'N/A'}
- **Fields Extracted**: ${Object.keys(data.finalResult?.aggregatedData || {}).length}

${data.finalResult?.aggregatedData ? `
## Extracted Data
\`\`\`json
${JSON.stringify(data.finalResult.aggregatedData, null, 2)}
\`\`\`
` : ''}

---
*Generated at ${new Date().toISOString()}*
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

