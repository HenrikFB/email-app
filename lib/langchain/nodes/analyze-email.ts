/**
 * Analyze Email Node
 * 
 * Uses LLM to analyze email content, find job listings,
 * and extract structured data based on user configuration.
 * 
 * This node implements chain-of-thought reasoning for accurate
 * job matching, following OpenAI's GPT-4.1 prompting best practices.
 * 
 * Key features:
 * - Batched processing for emails with many jobs (65+ jobs)
 * - Explicit <thinking> blocks for reasoning
 * - Few-shot examples for consistent behavior
 * - Danish/English bilingual support
 * - Clear match/reject criteria with examples
 */

import { ChatOpenAI } from '@langchain/openai'
import { JOB_SEARCH_CONFIG, ANALYSIS_EXAMPLES } from '../configs'
import { splitEmailIntoChunks, needsBatchedProcessing, type JobChunk } from '../utils/email-splitter'
import type { 
  EmailWorkflowState, 
  JobListing, 
  ExtractedEntities,
  SearchQuery 
} from '../types'

// ============================================
// JSON Schema for Structured Output
// ============================================

/**
 * JSON Schema for email analysis (used with function calling)
 */
const EmailAnalysisJsonSchema = {
  name: 'email_analysis',
  description: 'Extract structured job information from an email with reasoning',
  parameters: {
    type: 'object',
    properties: {
      thinking: {
        type: 'string',
        description: 'Your step-by-step reasoning about the email and each job',
      },
      isJobEmail: {
        type: 'boolean',
        description: 'Whether this email contains job listings',
      },
      emailType: {
        type: 'string',
        enum: ['job_listing', 'newsletter', 'application_status', 'other'],
        description: 'Type of email',
      },
      jobs: {
        type: 'array',
        description: 'Jobs found in email',
        items: {
          type: 'object',
          properties: {
            company: { type: 'string', description: 'Company name' },
            position: { type: 'string', description: 'Job position/title' },
            location: { type: 'string', description: 'Location (city, country, remote)' },
            technologies: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Technologies mentioned' 
            },
            originalUrl: { type: 'string', description: 'URL to job posting if present' },
            matched: { type: 'boolean', description: 'Whether this job matches user criteria' },
            confidence: { type: 'number', description: 'Match confidence (0-1)' },
            matchReasoning: { type: 'string', description: 'Detailed reasoning for match decision' },
            extractedData: { 
              type: 'object', 
              description: 'Additional extracted fields',
              properties: {
                experience_level: { type: 'string' },
                experience_years: { type: 'string' },
                deadline: { type: 'string' },
                work_type: { type: 'string' },
                salary: { type: 'string' },
                competencies: { type: 'array', items: { type: 'string' } },
                company_domain: { type: 'string' },
              },
            },
          },
          required: ['company', 'position', 'technologies', 'matched', 'confidence', 'matchReasoning'],
        },
      },
      entities: {
        type: 'object',
        properties: {
          companies: { type: 'array', items: { type: 'string' }, description: 'Companies mentioned' },
          technologies: { type: 'array', items: { type: 'string' }, description: 'Technologies mentioned' },
          locations: { type: 'array', items: { type: 'string' }, description: 'Locations mentioned' },
          positions: { type: 'array', items: { type: 'string' }, description: 'Job positions mentioned' },
          skills: { type: 'array', items: { type: 'string' }, description: 'Skills mentioned' },
        },
        required: ['companies', 'technologies', 'locations', 'positions', 'skills'],
      },
      summary: {
        type: 'string',
        description: 'Brief summary of the email content',
      },
    },
    required: ['thinking', 'isJobEmail', 'emailType', 'jobs', 'entities', 'summary'],
  },
}

// Type for the analysis result
interface EmailAnalysisResult {
  thinking: string
  isJobEmail: boolean
  emailType: 'job_listing' | 'newsletter' | 'application_status' | 'other'
  jobs: Array<{
    company: string
    position: string
    location?: string
    technologies: string[]
    originalUrl?: string
    matched: boolean
    confidence: number
    matchReasoning: string
    extractedData?: Record<string, unknown>
  }>
  entities: {
    companies: string[]
    technologies: string[]
    locations: string[]
    positions: string[]
    skills: string[]
  }
  summary: string
}

// ============================================
// LLM Configuration
// ============================================

const ANALYSIS_MODEL = 'gpt-4o-mini'

// Maximum characters per chunk for LLM analysis
const MAX_CHUNK_SIZE = 12000

/**
 * Decode SafeLinks URLs to get the real URL
 */
function decodeSafeLinksUrl(url: string): string {
  try {
    if (url.includes('safelinks.protection.outlook.com')) {
      const urlObj = new URL(url)
      const realUrl = urlObj.searchParams.get('url')
      if (realUrl) {
        return decodeURIComponent(realUrl)
      }
    }
    return url
  } catch {
    return url
  }
}

/**
 * Filter and clean URLs for analysis
 */
function cleanUrlsForAnalysis(urls: string[], maxUrls: number = 50): string[] {
  const seen = new Set<string>()
  const cleaned: string[] = []
  
  const excludePatterns = [
    /unsubscribe/i,
    /mailto:/i,
    /tel:/i,
    /preferences/i,
    /indstillinger/i,
    /settings/i,
    /\.gif$/i,
    /\.png$/i,
    /\.jpg$/i,
    /\.jpeg$/i,
    /\.ico$/i,
    /tracking/i,
    /click\./i,
    /pixel/i,
    /beacon/i,
    /analytics/i,
    /facebook\.com/i,
    /twitter\.com/i,
    /instagram\.com/i,
  ]
  
  const includePatterns = [
    /\/job/i,
    /\/career/i,
    /\/stilling/i,
    /\/vacancy/i,
    /\/position/i,
    /\/arbejde/i,
    /\/ansog/i,
    /\/apply/i,
    /\/hire/i,
    /\/recruit/i,
    /\/vis-job/i,
    /\/jobannonce/i,
  ]
  
  for (const url of urls) {
    const decoded = decodeSafeLinksUrl(url)
    
    if (seen.has(decoded)) continue
    if (excludePatterns.some(p => p.test(decoded))) continue
    
    if (includePatterns.some(p => p.test(decoded))) {
      seen.add(decoded)
      cleaned.push(decoded)
    }
    
    if (cleaned.length >= maxUrls) break
  }
  
  return cleaned
}

/**
 * Build the comprehensive analysis prompt with chain-of-thought
 */
function buildAnalysisPrompt(config: { 
  matchCriteria: string
  extractionFields: string
  userIntent?: string
}, isBatch: boolean = false): string {
  // Get few-shot examples
  const examples = ANALYSIS_EXAMPLES

  const batchInstruction = isBatch ? `
## BATCH PROCESSING MODE
This is a BATCH of job listings from a larger email. 
Each job listing may be separated by company names, "INDRYKKET:" dates, or double newlines.
` : ''

  return `You are an expert email analyzer specializing in job listings and career opportunities.
You analyze emails from job boards like Jobindex, karriere.dk, LinkedIn, and company newsletters.
${batchInstruction}
## ⚠️ CRITICAL: EXTRACT EVERY SINGLE JOB ⚠️

You MUST extract EVERY job listing in this content. This is NON-NEGOTIABLE.

### EXTRACTION RULES
1. **Do NOT skip any job** - even if it seems irrelevant, extract it
2. **Do NOT summarize** - list each job individually
3. **Do NOT combine jobs** - even similar jobs are separate entries
4. **Extract THEN judge** - first identify the job, THEN decide if it matches

### WHAT TO LOOK FOR
In Jobindex emails, each job follows this pattern:
- Company Name (often with A/S, ApS, Kommune, etc.)
- Job Title
- Location + distance
- Short description
- "INDRYKKET: DD-MM-YYYY"

### HOW TO HANDLE NON-MATCHES
If a job doesn't match criteria, you MUST still extract it:
\`\`\`json
{
  "company": "Company Name",
  "position": "Job Title",
  "matched": false,
  "matchReasoning": "REJECTED: [brief reason]"
}
\`\`\`

## YOUR MISSION
Extract ALL job opportunities and mark each as matched or not matched.
Use careful, step-by-step reasoning to make accurate decisions.

## CHAIN-OF-THOUGHT APPROACH
For EACH job you find, you MUST reason through these steps in your <thinking>:

1. **IDENTIFY THE JOB**
   - What is the exact job title? (in original language)
   - What company is hiring?
   - Where is the job located?

2. **CHECK JOB TYPE** (Is this IT/software/development?)
   - Software/web/cloud development? → Continue ✅
   - IT-udvikler / IT-konsulent / IT Consultant? → Continue ✅ (user wants these!)
   - Proceskonsulent / Digitaliseringskonsulent? → Continue ✅ (automation roles)
   - Teknologikonsulent / Technology Consultant? → Continue ✅
   - IT Security / Cybersecurity / Compliance? → Continue ✅
   - RPA / Automation developer? → Continue ✅
   - Is this PLC/SCADA/industrial automation? → REJECT ❌
   - Is this hardware/embedded/firmware? → REJECT ❌
   - Is this pure management (no coding)? → REJECT ❌
   - Is this BI/Data Engineering? → REJECT ❌

3. **CHECK TECHNOLOGIES**
   - What technologies are mentioned?
   - Do they match the user's skills?
   - Are there any deal-breakers?

4. **CHECK EXPERIENCE LEVEL** (CRITICAL!)
   - 0-3 years → Good match, normal confidence
   - 3-5 years → BORDERLINE, include but with LOW confidence (0.5-0.6)
   - 5+ years → REJECT! Too senior
   - "Senior", "Lead", "Architect", "Principal" → Usually 5+ years, REJECT
   - Danish: "erfaren" often means 3-5 years (borderline), "senior" is 5+ (reject)

5. **MAKE DECISION**
   - MATCH (0.7-1.0): Job fits criteria AND experience is 0-3 years
   - BORDERLINE (0.5-0.6): Job fits BUT experience is 3-5 years - flag it
   - REJECT: Experience is 5+ years OR is clearly senior level

## USER'S MATCH CRITERIA
${config.matchCriteria}

## FIELDS TO EXTRACT
${config.extractionFields}

## USER'S INTENT
${config.userIntent || 'Find relevant job opportunities'}

## DANISH LANGUAGE SUPPORT
The email may be in Danish. Common terms:
- "softwareudvikler" = software developer
- "udvikler" = developer
- "programmør" = programmer
- "stilling" = position
- "erfaring" = experience
- "års erfaring" = years of experience
- "ansøgningsfrist" = application deadline
- "hjemmearbejde" = remote work
- "København" = Copenhagen

## FEW-SHOT EXAMPLES

### Example 1: Clear Match
Input:
${examples.goodMatch.input}

Reasoning:
${examples.goodMatch.reasoning}

Output:
- matched: ${examples.goodMatch.output.matched}
- confidence: ${examples.goodMatch.output.confidence}
- matchReasoning: "${examples.goodMatch.output.matchReasoning}"

### Example 2: Clear Rejection
Input:
${examples.clearRejection.input}

Reasoning:
${examples.clearRejection.reasoning}

Output:
- matched: ${examples.clearRejection.output.matched}
- confidence: ${examples.clearRejection.output.confidence}
- matchReasoning: "${examples.clearRejection.output.matchReasoning}"

### Example 3: Edge Case (Senior Role)
Input:
${examples.edgeCase.input}

Reasoning:
${examples.edgeCase.reasoning}

Output:
- matched: ${examples.edgeCase.output.matched}
- confidence: ${examples.edgeCase.output.confidence}
- matchReasoning: "${examples.edgeCase.output.matchReasoning}"

### Example 4: Danish Job Posting
Input:
${examples.danishExample.input}

Reasoning:
${examples.danishExample.reasoning}

Output:
- matched: ${examples.danishExample.output.matched}
- confidence: ${examples.danishExample.output.confidence}
- matchReasoning: "${examples.danishExample.output.matchReasoning}"

## REJECTION TRIGGERS (Auto-reject if present)
- PLC, SCADA, Siemens S7, TIA Portal
- Embedded, Firmware, RTOS, Microcontroller
- Hardware Engineer, Electronic Design, PCB
- Mechanical, Mechatronic
- Industrial Automation (unless clearly software)

## IMPORTANT RULES
1. Extract ALL jobs from the content - DO NOT SKIP ANY
2. LinkedIn URLs are common - extract them but note they require auth
3. ALWAYS provide your reasoning in the "thinking" field
4. When uncertain, MATCH with lower confidence (0.5-0.7) - let user decide
5. For Danish postings, translate key terms in your reasoning

## 🛑 STOP AND COUNT
Before outputting, verify:
- Count the number of company names in the text
- Count the number of job titles
- Your jobs array should have approximately this many entries
- If your count is significantly lower, YOU MISSED JOBS - go back and re-read!

## OUTPUT
Call the email_analysis function with:
- thinking: Your complete chain-of-thought reasoning (REQUIRED - be thorough!)
- isJobEmail: true/false
- emailType: job_listing/newsletter/application_status/other
- jobs: Array of all jobs found with match decisions
- entities: All companies, technologies, locations mentioned
- summary: Brief summary of the email

## 💡 THINK STEP BY STEP
1. First, scan the ENTIRE text and list all company names you see
2. For each company, identify the associated job title and location
3. Then evaluate each job against criteria
4. Finally, verify you haven't missed any

Remember: The user PREFERS false positives over missed jobs. Include ALL uncertain matches with appropriate confidence scores. Better to include a questionable job than miss a good one!`
}

// ============================================
// Single Chunk Analysis
// ============================================

/**
 * Analyze a single chunk of email content
 */
async function analyzeChunk(
  chunk: JobChunk,
  config: {
    matchCriteria: string
    extractionFields: string
    userIntent?: string
  },
  emailMetadata: { subject: string; from: string; date: string },
  urls: string[] = [],
  isBatch: boolean = false
): Promise<EmailAnalysisResult> {
  const model = new ChatOpenAI({
    modelName: ANALYSIS_MODEL,
    temperature: 0.1,
  })

  const tool = {
    type: 'function' as const,
    function: EmailAnalysisJsonSchema,
  }
  
  const modelWithTool = model.bindTools([tool], {
    tool_choice: { type: 'function' as const, function: { name: 'email_analysis' } },
  })

  const systemPrompt = buildAnalysisPrompt(config, isBatch)
  
  // Truncate chunk if too long
  let content = chunk.content
  if (content.length > MAX_CHUNK_SIZE) {
    content = content.substring(0, MAX_CHUNK_SIZE) + '\n\n[... content truncated ...]'
  }
  
  // Prepare content for analysis
  const emailContent = isBatch 
    ? `## BATCH ${chunk.index + 1} - Job Listings

${content}

${urls.length > 0 ? `## RELATED JOB URLS\n${urls.slice(0, 20).join('\n')}` : ''}`
    : `## EMAIL METADATA
Subject: ${emailMetadata.subject}
From: ${emailMetadata.from}
Date: ${emailMetadata.date}

## EMAIL CONTENT
${content}
${urls.length > 0 ? `\n## JOB URLS (${urls.length} total)\n${urls.join('\n')}` : ''}`

  const response = await modelWithTool.invoke([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: emailContent },
  ])

  // Parse the response
  const toolCalls = response.additional_kwargs?.tool_calls
  if (toolCalls && toolCalls.length > 0) {
    const toolCall = toolCalls[0]
    if (toolCall.function?.arguments) {
      return JSON.parse(toolCall.function.arguments)
    }
  }
  
  if (typeof response.content === 'string' && response.content.trim().startsWith('{')) {
    return JSON.parse(response.content)
  }
  
  throw new Error('No valid response from LLM')
}

// ============================================
// Batched Analysis
// ============================================

/**
 * Analyze email with batched processing for large emails
 */
async function analyzeBatched(
  state: EmailWorkflowState,
  config: {
    matchCriteria: string
    extractionFields: string
    userIntent?: string
  }
): Promise<EmailAnalysisResult[]> {
  if (!state.cleanedEmail) {
    throw new Error('Email not cleaned')
  }

  const splitResult = splitEmailIntoChunks(
    state.cleanedEmail.plainText,
    state.cleanedEmail.from
  )

  // Estimate jobs based on total characters (~350 chars per job)
  const estimatedJobs = Math.ceil(splitResult.totalCharacters / 350)

  console.log(`   📦 Split into ${splitResult.chunkCount} chunks (source: ${splitResult.source})`)
  console.log(`   📊 Estimated ~${estimatedJobs} jobs (${splitResult.totalCharacters} chars)`)

  const allUrls = state.entities?.urls || []
  const cleanedUrls = cleanUrlsForAnalysis(allUrls, 50)

  const results: EmailAnalysisResult[] = []
  
  // Process batches in parallel (up to 3 at a time for efficiency)
  const PARALLEL_BATCHES = 3
  
  for (let i = 0; i < splitResult.chunks.length; i += PARALLEL_BATCHES) {
    const batchGroup = splitResult.chunks.slice(i, i + PARALLEL_BATCHES)
    
    console.log(`   ⏳ Processing batches ${i + 1}-${Math.min(i + PARALLEL_BATCHES, splitResult.chunks.length)}...`)
    
    const batchPromises = batchGroup.map(chunk => 
      analyzeChunk(
        chunk,
        config,
        {
          subject: state.cleanedEmail!.subject,
          from: state.cleanedEmail!.from,
          date: state.cleanedEmail!.date,
        },
        cleanedUrls,
        true // isBatch
      ).catch(error => {
        console.error(`   ❌ Batch ${chunk.index + 1} failed:`, error)
        return null
      })
    )
    
    const batchResults = await Promise.all(batchPromises)
    
    for (const result of batchResults) {
      if (result) {
        results.push(result)
        console.log(`   ✅ Batch completed: ${result.jobs.length} jobs found`)
      }
    }
  }

  return results
}

/**
 * Merge multiple analysis results into one
 */
function mergeResults(results: EmailAnalysisResult[]): EmailAnalysisResult {
  const allJobs: EmailAnalysisResult['jobs'] = []
  const allEntities = {
    companies: new Set<string>(),
    technologies: new Set<string>(),
    locations: new Set<string>(),
    positions: new Set<string>(),
    skills: new Set<string>(),
  }
  const summaries: string[] = []

  for (const result of results) {
    allJobs.push(...result.jobs)
    
    result.entities.companies.forEach(c => allEntities.companies.add(c))
    result.entities.technologies.forEach(t => allEntities.technologies.add(t))
    result.entities.locations.forEach(l => allEntities.locations.add(l))
    result.entities.positions.forEach(p => allEntities.positions.add(p))
    result.entities.skills.forEach(s => allEntities.skills.add(s))
    
    if (result.summary) summaries.push(result.summary)
  }

  // Deduplicate jobs by company+position
  const seenJobs = new Set<string>()
  const uniqueJobs = allJobs.filter(job => {
    const key = `${job.company.toLowerCase()}|${job.position.toLowerCase()}`
    if (seenJobs.has(key)) return false
    seenJobs.add(key)
    return true
  })

  return {
    thinking: results.map(r => r.thinking).join('\n\n---\n\n'),
    isJobEmail: true,
    emailType: 'job_listing',
    jobs: uniqueJobs,
    entities: {
      companies: Array.from(allEntities.companies),
      technologies: Array.from(allEntities.technologies),
      locations: Array.from(allEntities.locations),
      positions: Array.from(allEntities.positions),
      skills: Array.from(allEntities.skills),
    },
    summary: summaries.join(' | '),
  }
}

// ============================================
// Analyze Email Node
// ============================================

/**
 * Analyze email node function
 * Uses LLM with chain-of-thought to extract jobs and entities from email content
 * 
 * @param state - Current workflow state
 * @returns Updated state with analysis results
 */
export async function analyzeEmailNode(
  state: EmailWorkflowState
): Promise<Partial<EmailWorkflowState>> {
  console.log('\n🔍 [Analyze Email] Starting chain-of-thought analysis...')
  
  const startTime = Date.now()
  
  try {
    if (!state.cleanedEmail) {
      throw new Error('Email not cleaned - cleanEmailNode must run first')
    }

    // Build the prompt config
    const config = {
      matchCriteria: state.config.matchCriteria || JOB_SEARCH_CONFIG.matchCriteria,
      extractionFields: state.config.extractionFields || JOB_SEARCH_CONFIG.extractionFields,
      userIntent: state.config.userIntent || JOB_SEARCH_CONFIG.userIntent,
    }
    
    // Clean and prepare URLs
    const allUrls = state.entities?.urls || []
    const cleanedUrls = cleanUrlsForAnalysis(allUrls, 50)
    
    console.log(`   Plain text: ${state.cleanedEmail.plainText.length} characters`)
    console.log(`   URLs: ${cleanedUrls.length} job-related (filtered from ${allUrls.length} total)`)
    
    let analysis: EmailAnalysisResult

    // Check if we need batched processing
    if (needsBatchedProcessing(state.cleanedEmail.plainText)) {
      console.log(`   📦 Large email detected - using BATCHED processing...`)
      
      const batchResults = await analyzeBatched(state, config)
      analysis = mergeResults(batchResults)
      
      console.log(`   📊 Batched analysis complete: ${analysis.jobs.length} unique jobs from ${batchResults.length} batches`)
    } else {
      // Single-pass analysis for smaller emails
      console.log(`   📝 Standard email - using single-pass analysis...`)
      
      analysis = await analyzeChunk(
        { index: 0, content: state.cleanedEmail.plainText, charCount: state.cleanedEmail.plainText.length },
        config,
        {
          subject: state.cleanedEmail.subject,
          from: state.cleanedEmail.from,
          date: state.cleanedEmail.date,
        },
        cleanedUrls,
        false
      )
    }

    console.log(`   Email type: ${analysis.emailType}`)
    console.log(`   Jobs found: ${analysis.jobs.length}`)
    console.log(`   Matched jobs: ${analysis.jobs.filter(j => j.matched).length}`)
    
    // Log the LLM's thinking (first 500 chars)
    if (analysis.thinking) {
      console.log(`\n   💭 LLM Reasoning (preview):`)
      console.log(`   ${analysis.thinking.substring(0, 500)}...`)
    }

    // Convert to JobListing format with IDs
    const jobs: JobListing[] = analysis.jobs.map((job, index) => {
      // Ensure confidence is a valid number between 0 and 1
      let confidence = job.confidence
      if (typeof confidence !== 'number' || isNaN(confidence)) {
        confidence = job.matched ? 0.7 : 0.3 // Default based on match status
      }
      // Normalize confidence to 0-1 range (LLM might return 0-100)
      if (confidence > 1) {
        confidence = confidence / 100
      }
      confidence = Math.max(0, Math.min(1, confidence))

      return {
        id: `${state.email.id}-job-${index}`,
        company: job.company,
        position: job.position,
        location: job.location,
        technologies: job.technologies || [],
        originalUrl: job.originalUrl,
        matched: job.matched,
        confidence,
        matchReasoning: job.matchReasoning,
        extractedData: job.extractedData || {},
      }
    })

    // Build search queries for matched jobs
    const searchQueries: SearchQuery[] = jobs
      .filter(job => job.matched)
      .flatMap((job, index) => [
        {
          query: `${job.company} ${job.position} ${job.location || ''} careers`.trim(),
          entity: job.company,
          priority: 10 - index,
          type: 'job' as const,
        },
        {
          query: `"${job.position}" "${job.company}" job description`,
          entity: job.company,
          priority: 5 - index,
          type: 'job' as const,
        },
      ])

    // Merge entities
    const entities: ExtractedEntities = {
      companies: [...new Set([
        ...(state.entities?.companies || []),
        ...analysis.entities.companies,
      ])],
      technologies: [...new Set([
        ...(state.entities?.technologies || []),
        ...analysis.entities.technologies,
      ])],
      locations: [...new Set([
        ...(state.entities?.locations || []),
        ...analysis.entities.locations,
      ])],
      positions: [...new Set([
        ...(state.entities?.positions || []),
        ...analysis.entities.positions,
      ])],
      skills: [...new Set([
        ...(state.entities?.skills || []),
        ...analysis.entities.skills,
      ])],
      urls: state.entities?.urls || [],
    }

    const processingTime = Date.now() - startTime
    console.log(`✅ [Analyze Email] Completed in ${processingTime}ms`)

    // Log matched jobs
    if (jobs.filter(j => j.matched).length > 0) {
      console.log('\n📋 Matched Jobs:')
      jobs.filter(j => j.matched).forEach(job => {
        console.log(`   ✅ ${job.position} at ${job.company} (${Math.round(job.confidence * 100)}%)`)
        console.log(`      → ${job.matchReasoning}`)
      })
    }
    
    // Log rejected jobs summary
    const rejectedCount = jobs.filter(j => !j.matched).length
    if (rejectedCount > 0) {
      console.log(`\n📋 Rejected Jobs: ${rejectedCount} (see debug logs for details)`)
    }

    return {
      jobs,
      entities,
      searchQueries,
      hasMatches: jobs.some(j => j.matched),
      currentPhase: jobs.some(j => j.matched) ? 'researching' : 'complete',
    }
  } catch (error) {
    console.error('❌ [Analyze Email] Error:', error)
    
    return {
      jobs: [],
      hasMatches: false,
      errors: [...state.errors, `Email analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      currentPhase: 'error',
    }
  }
}

// ============================================
// Exports
// ============================================

export { buildAnalysisPrompt, EmailAnalysisJsonSchema }
