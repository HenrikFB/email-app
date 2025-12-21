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
 * - Explicit <thinking> blocks for reasoning
 * - Few-shot examples for consistent behavior
 * - Danish/English bilingual support
 * - Clear match/reject criteria with examples
 */

import { ChatOpenAI } from '@langchain/openai'
import { JOB_SEARCH_CONFIG, ANALYSIS_EXAMPLES } from '../configs'
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

// Maximum characters to send to the LLM for analysis
const MAX_CONTENT_LENGTH = 30000

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
function cleanUrlsForAnalysis(urls: string[], maxUrls: number = 20): string[] {
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
}): string {
  // Get few-shot examples
  const examples = ANALYSIS_EXAMPLES

  return `You are an expert email analyzer specializing in job listings and career opportunities.
You analyze emails from job boards like Jobindex, karriere.dk, LinkedIn, and company newsletters.

## YOUR MISSION
Extract ALL job opportunities from the email and determine which ones match the user's criteria.
Use careful, step-by-step reasoning to make accurate decisions.

## CHAIN-OF-THOUGHT APPROACH
For EACH job you find, you MUST reason through these steps in your <thinking>:

1. **IDENTIFY THE JOB**
   - What is the exact job title? (in original language)
   - What company is hiring?
   - Where is the job located?

2. **CHECK JOB TYPE** (Is this software development?)
   - Is this a software/web/cloud development role? → Continue
   - Is this PLC/SCADA/industrial automation? → REJECT
   - Is this hardware/embedded/firmware? → REJECT
   - Is this non-technical (PM, Scrum Master)? → REJECT

3. **CHECK TECHNOLOGIES**
   - What technologies are mentioned?
   - Do they match the user's skills?
   - Are there any deal-breakers?

4. **CHECK EXPERIENCE LEVEL**
   - What experience is required?
   - Is it appropriate for the user?
   - Flag if clearly senior (5+ years, Lead, Architect)

5. **MAKE DECISION**
   - MATCH: Job fits criteria → confidence 0.7-1.0
   - UNCERTAIN: Could fit, needs more info → confidence 0.5-0.7
   - REJECT: Clearly doesn't fit → matched: false

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
1. Extract ALL jobs from the email, not just the first few
2. LinkedIn URLs are common - extract them but note they require auth
3. ALWAYS provide your reasoning in the "thinking" field
4. When uncertain, MATCH with lower confidence (0.5-0.7) - let user decide
5. For Danish postings, translate key terms in your reasoning

## OUTPUT
Call the email_analysis function with:
- thinking: Your complete chain-of-thought reasoning
- isJobEmail: true/false
- emailType: job_listing/newsletter/application_status/other
- jobs: Array of all jobs found with match decisions
- entities: All companies, technologies, locations mentioned
- summary: Brief summary of the email

Remember: The user wants to see ALL potentially relevant jobs. Include uncertain matches with appropriate confidence scores.`
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

    const model = new ChatOpenAI({
      modelName: ANALYSIS_MODEL,
      temperature: 0.1, // Low temperature for consistent extraction
    })

    // Use tool calling with JSON schema
    const tool = {
      type: 'function' as const,
      function: EmailAnalysisJsonSchema,
    }
    
    const modelWithTool = model.bindTools([tool], {
      tool_choice: { type: 'function' as const, function: { name: 'email_analysis' } },
    })

    // Build the prompt - use hardcoded config or state config
    const config = {
      matchCriteria: state.config.matchCriteria || JOB_SEARCH_CONFIG.matchCriteria,
      extractionFields: state.config.extractionFields || JOB_SEARCH_CONFIG.extractionFields,
      userIntent: state.config.userIntent || JOB_SEARCH_CONFIG.userIntent,
    }
    
    const systemPrompt = buildAnalysisPrompt(config)
    
    // Clean and limit URLs
    const allUrls = state.entities?.urls || []
    const cleanedUrls = cleanUrlsForAnalysis(allUrls, 20)
    
    // Truncate content if too long
    let plainText = state.cleanedEmail.plainText
    let truncated = false
    if (plainText.length > MAX_CONTENT_LENGTH) {
      plainText = plainText.substring(0, MAX_CONTENT_LENGTH) + '\n\n[... content truncated for analysis ...]'
      truncated = true
    }
    
    // Prepare email content for analysis
    const emailContent = `## EMAIL METADATA
Subject: ${state.cleanedEmail.subject}
From: ${state.cleanedEmail.from}
Date: ${state.cleanedEmail.date}

## EMAIL CONTENT
${plainText}
${cleanedUrls.length > 0 ? `\n## JOB URLS (${cleanedUrls.length} of ${allUrls.length} total)\n${cleanedUrls.join('\n')}` : ''}`

    console.log(`   Processing ${state.cleanedEmail.plainText.length} characters${truncated ? ' (truncated to ' + MAX_CONTENT_LENGTH + ')' : ''}...`)
    console.log(`   URLs: ${cleanedUrls.length} job-related (filtered from ${allUrls.length} total)`)

    // Call the LLM with tool calling
    const response = await modelWithTool.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: emailContent },
    ])

    // Parse the tool call response
    let analysis: EmailAnalysisResult
    
    const toolCalls = response.additional_kwargs?.tool_calls
    if (toolCalls && toolCalls.length > 0) {
      const toolCall = toolCalls[0]
      if (toolCall.function?.arguments) {
        analysis = JSON.parse(toolCall.function.arguments)
      } else {
        throw new Error('Tool call has no arguments')
      }
    } else if (typeof response.content === 'string' && response.content.trim().startsWith('{')) {
      analysis = JSON.parse(response.content)
    } else {
      throw new Error('No tool call response received')
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
    const jobs: JobListing[] = analysis.jobs.map((job, index) => ({
      id: `${state.email.id}-job-${index}`,
      company: job.company,
      position: job.position,
      location: job.location,
      technologies: job.technologies || [],
      originalUrl: job.originalUrl,
      matched: job.matched,
      confidence: job.confidence,
      matchReasoning: job.matchReasoning,
      extractedData: job.extractedData || {},
    }))

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
    
    // Log rejected jobs
    if (jobs.filter(j => !j.matched).length > 0) {
      console.log('\n📋 Rejected Jobs:')
      jobs.filter(j => !j.matched).forEach(job => {
        console.log(`   ❌ ${job.position} at ${job.company}`)
        console.log(`      → ${job.matchReasoning}`)
      })
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
