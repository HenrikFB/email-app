/**
 * Analyze Email Node
 * 
 * Uses LLM to analyze email content, find job listings,
 * and extract structured data based on user configuration.
 * 
 * This node:
 * 1. Identifies jobs/opportunities in the email
 * 2. Extracts entities (companies, technologies, locations)
 * 3. Determines match status based on user criteria
 * 4. Generates search queries for research phase
 */

import { ChatOpenAI } from '@langchain/openai'
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
  description: 'Extract structured job information from an email',
  parameters: {
    type: 'object',
    properties: {
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
            matchReasoning: { type: 'string', description: 'Reasoning for match decision' },
            extractedData: { 
              type: 'object', 
              description: 'Additional extracted fields based on extractionFields',
              additionalProperties: true,
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
    required: ['isJobEmail', 'emailType', 'jobs', 'entities', 'summary'],
  },
}

// Type for the analysis result
interface EmailAnalysisResult {
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
// gpt-4o-mini has 128k context, but we want to leave room for response
const MAX_CONTENT_LENGTH = 30000 // ~7500 tokens

/**
 * Decode SafeLinks URLs to get the real URL
 */
function decodeSafeLinksUrl(url: string): string {
  try {
    // Microsoft SafeLinks format: https://...safelinks.protection.outlook.com/?url=ENCODED_URL&...
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
 * - Decode SafeLinks
 * - Remove duplicates
 * - Filter out tracking/unsubscribe/image links
 * - Keep job-related URLs (generic patterns, not platform-specific)
 * - Limit count
 */
function cleanUrlsForAnalysis(urls: string[], maxUrls: number = 20): string[] {
  const seen = new Set<string>()
  const cleaned: string[] = []
  
  // Patterns to EXCLUDE (noise)
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
  
  // Patterns to INCLUDE (job-related - generic, not platform-specific)
  const includePatterns = [
    /\/job/i,           // /job, /jobs, /jobannonce, etc.
    /\/career/i,        // /careers, /career
    /\/stilling/i,      // Danish: position
    /\/vacancy/i,       // vacancy
    /\/position/i,      // position
    /\/arbejde/i,       // Danish: work
    /\/ansog/i,         // Danish: apply
    /\/apply/i,         // apply
    /\/hire/i,          // hiring
    /\/recruit/i,       // recruiting
  ]
  
  for (const url of urls) {
    const decoded = decodeSafeLinksUrl(url)
    
    // Skip if already seen
    if (seen.has(decoded)) continue
    
    // Skip excluded patterns
    if (excludePatterns.some(p => p.test(decoded))) continue
    
    // Include if matches job-related patterns
    if (includePatterns.some(p => p.test(decoded))) {
      seen.add(decoded)
      cleaned.push(decoded)
    }
    
    if (cleaned.length >= maxUrls) break
  }
  
  return cleaned
}

/**
 * Build analysis prompt based on user configuration
 */
function buildAnalysisPrompt(config: { 
  matchCriteria: string
  extractionFields: string
  userIntent?: string
}): string {
  return `You are an expert email analyzer specializing in job listings and career opportunities.

## YOUR TASK
Analyze the email content and extract structured information about job opportunities.

## USER'S MATCH CRITERIA
The user is looking for jobs matching these criteria:
${config.matchCriteria}

## FIELDS TO EXTRACT
For each job, extract these fields into extractedData:
${config.extractionFields}

## USER'S INTENT
${config.userIntent || 'Find relevant job opportunities'}

## ANALYSIS INSTRUCTIONS

### 1. Email Classification
First, determine if this is a job-related email:
- Job listing emails (from job boards, recruiters, companies)
- Newsletters with job content
- Application status updates
- Other (not job related)

### 2. Job Extraction
For each job mentioned:
- Extract company name and position
- Identify location (city, country, remote, hybrid)
- List technologies and skills mentioned
- Find the URL to the full job posting
- Determine if it matches user criteria

### 3. Match Decision
For each job, reason about whether it matches the user's criteria:
- matched: true/false based on criteria alignment
- confidence: 0.0-1.0 how confident you are
- matchReasoning: explain your reasoning about why it matches or not

MATCHING APPROACH - Be INCLUSIVE, not strict:

1. EQUIVALENT TERMS (treat as the same):
   - "Software Engineer" = "Software Developer" = "Programmer" = "Udvikler"
   - These are interchangeable job titles for the same type of work

2. ONLY REJECT jobs that are CLEARLY outside software development:
   - PLC programming, SCADA systems (industrial control)
   - Hardware/electronic/mechanic engineering
   - Embedded systems (hardware-focused, microcontrollers, firmware)
   - Automation Engineer IF focused on industrial PLCs (not software automation)

3. INCLUDE all software-related positions:
   - Backend, Frontend, Fullstack, Web development
   - Cloud, DevOps, MLOps, Platform engineering
   - AI/ML, Data engineering, Data science
   - Security, Cryptography, Compliance (software-based)
   - IT/Solution Architecture
   - ERP/CRM development

4. EXPERIENCE LEVEL: Let the user's criteria guide you
   - Read what they specified about experience
   - Use confidence to reflect uncertainty (e.g., Senior role when user wants <5 years → match with 0.5-0.6 confidence)
   - Explain your reasoning in matchReasoning

5. WHEN IN DOUBT → MATCH IT
   - Better to include a borderline job than miss a relevant one
   - Use confidence 0.5-0.7 for uncertain matches
   - The user can review and filter later

### 4. Entity Extraction
Extract all mentioned:
- Companies (employer names)
- Technologies (programming languages, frameworks, tools)
- Locations (cities, countries, "remote", "hybrid")
- Positions (job titles)
- Skills (soft skills, qualifications)

## IMPORTANT NOTES
- LinkedIn URLs are common but require authentication - still extract them
- Some emails list multiple jobs - extract ALL of them
- For technologies, include specific versions if mentioned (e.g., "React 18", ".NET 8")

Call the email_analysis function with your structured analysis.`
}

// ============================================
// Analyze Email Node
// ============================================

/**
 * Analyze email node function
 * Uses LLM to extract jobs and entities from email content
 * 
 * @param state - Current workflow state
 * @returns Updated state with analysis results
 */
export async function analyzeEmailNode(
  state: EmailWorkflowState
): Promise<Partial<EmailWorkflowState>> {
  console.log('\n🔍 [Analyze Email] Starting analysis...')
  
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

    // Build the prompt
    const systemPrompt = buildAnalysisPrompt(state.config)
    
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
    
    // Prepare email content for analysis (optimized for token usage)
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
    
    // Check for tool calls in the response
    const toolCalls = response.additional_kwargs?.tool_calls
    if (toolCalls && toolCalls.length > 0) {
      const toolCall = toolCalls[0]
      if (toolCall.function?.arguments) {
        analysis = JSON.parse(toolCall.function.arguments)
      } else {
        throw new Error('Tool call has no arguments')
      }
    } else if (typeof response.content === 'string' && response.content.trim().startsWith('{')) {
      // Fallback: try to parse content as JSON
      analysis = JSON.parse(response.content)
    } else {
      throw new Error('No tool call response received')
    }

    console.log(`   Email type: ${analysis.emailType}`)
    console.log(`   Jobs found: ${analysis.jobs.length}`)
    console.log(`   Matched jobs: ${analysis.jobs.filter(j => j.matched).length}`)

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
        // Primary search query
        {
          query: `${job.company} ${job.position} ${job.location || ''} careers`.trim(),
          entity: job.company,
          priority: 10 - index, // Higher priority for earlier jobs
          type: 'job' as const,
        },
        // Fallback query
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
        console.log(`   • ${job.position} at ${job.company} (${Math.round(job.confidence * 100)}%)`)
      })
    } else {
      console.log('\n📋 No matching jobs found')
      // Log why each job didn't match
      jobs.forEach(job => {
        console.log(`   ✗ ${job.position} at ${job.company}: ${job.matchReasoning}`)
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
