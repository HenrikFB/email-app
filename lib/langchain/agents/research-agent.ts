/**
 * Research Agent
 * 
 * ReAct-style agent for researching job listings.
 * This agent iteratively uses tools to find public job descriptions
 * when the original URLs (like LinkedIn) require authentication.
 * 
 * Key features:
 * - Iterative tool use (ReAct pattern: Thought → Action → Observation → Repeat)
 * - Multiple search strategies
 * - Intelligent URL selection
 * - Structured output with reasoning
 */

import { ChatOpenAI } from '@langchain/openai'
import { createReactAgent } from '@langchain/langgraph/prebuilt'
import { HumanMessage } from '@langchain/core/messages'
import { allResearchTools } from '../tools'
import type { JobListing, JobResearchResult, AgentConfig } from '../types'

// ============================================
// Agent Configuration
// ============================================

const RESEARCH_AGENT_MODEL = 'gpt-4o-mini'
const MAX_ITERATIONS = 15 // Allow enough iterations for thorough research

/**
 * Build the system prompt for the research agent
 */
function buildResearchSystemPrompt(config: AgentConfig): string {
  return `You are an expert job research agent. Your task is to find complete, public job descriptions for positions mentioned in emails.

## YOUR GOAL
Find the REAL job description with full details (requirements, technologies, qualifications) from PUBLIC sources.

## CONTEXT
The user is looking for jobs matching these criteria:
${config.matchCriteria}

They want to extract these fields:
${config.extractionFields}

User's intent:
${config.userIntent || 'Find relevant job opportunities'}

## THE PROBLEM
Job emails often contain LinkedIn URLs that require authentication. You need to find the SAME job on PUBLIC sources like:
- Company career pages (company.com/careers)
- Job boards (jobindex.dk, indeed.com, etc.)
- Direct company job listings

## YOUR WORKFLOW

### Step 1: Smart Search
Use \`smart_job_search\` with the company name and position. This will:
- Search company career pages
- Search job boards
- Automatically skip LinkedIn (requires auth)
- Return recommendations for next steps

### Step 2: Extract Content
Based on search results, use \`tavily_extract\` or \`extract_job_description\` to get full content from promising URLs.

### Step 3: Validate & Iterate
- Check if the extracted content contains the actual job description
- If not enough detail, try another URL or a different search query
- Keep iterating until you find sufficient information

### Step 4: Structure Results
Once you have the job description, extract:
- Job title and company (verify match)
- Full requirements and qualifications
- Technologies/skills mentioned
- Location and work type
- Application deadline (if mentioned)
- Any other relevant details

## IMPORTANT RULES
1. NEVER give up after first search - iterate until you find the job or exhaust options
2. ALWAYS prefer company career pages over job boards (more complete info)
3. SKIP LinkedIn URLs - they require authentication
4. If a job board links to another site, follow that link
5. Extract FULL content, not just snippets

## OUTPUT FORMAT
When you have found sufficient information, provide a structured summary:
- Whether you found the job description (true/false)
- Primary source URL
- Full job description
- Extracted requirements
- Technologies mentioned
- Deadline (if found)
- Confidence level (high/medium/low)
- Reasoning about your search process

## THINKING PROCESS
Before each action, explain your reasoning:
- What information do you have?
- What are you looking for?
- Why are you choosing this tool/query?
- What will you do with the results?

Be thorough and systematic. The user needs complete job information to make decisions.`
}

// ============================================
// Research Agent Factory
// ============================================

/**
 * Create a research agent for job research
 * 
 * @param config - Agent configuration with user preferences
 * @returns A ReAct agent configured for job research
 */
export function createResearchAgent(config: AgentConfig) {
  const model = new ChatOpenAI({
    modelName: RESEARCH_AGENT_MODEL,
    temperature: 0.2, // Lower temperature for more focused reasoning
  })

  const systemPrompt = buildResearchSystemPrompt(config)

  // Create ReAct agent with all research tools
  const agent = createReactAgent({
    llm: model,
    tools: allResearchTools,
    messageModifier: systemPrompt,
  })

  return agent
}

// ============================================
// Research Job Function
// ============================================

/**
 * Research a single job listing to find public job description
 * 
 * This is the main entry point for researching a job.
 * It uses the ReAct agent to iteratively search and extract information.
 * 
 * @param job - The job listing to research
 * @param config - Agent configuration
 * @returns Research result with job description and sources
 */
export async function researchJob(
  job: JobListing,
  config: AgentConfig
): Promise<JobResearchResult> {
  const startTime = Date.now()
  
  console.log('\n' + '═'.repeat(70))
  console.log('🔍 RESEARCH AGENT - START')
  console.log('═'.repeat(70))
  console.log(`📋 Job: ${job.position} at ${job.company}`)
  console.log(`📍 Location: ${job.location || 'Not specified'}`)
  console.log(`🔗 Original URL: ${job.originalUrl || 'None'}`)
  console.log('─'.repeat(70))

  try {
    // Create the research agent
    const agent = createResearchAgent(config)

    // Build the research task
    const task = buildResearchTask(job, config)

    console.log('\n📝 Research Task:')
    console.log(task.substring(0, 500) + '...')
    console.log('─'.repeat(70))

    // Run the agent with iteration tracking
    let iterations = 0
    
    const result = await agent.invoke(
      {
        messages: [new HumanMessage(task)],
      },
      {
        recursionLimit: MAX_ITERATIONS * 2, // Each iteration has thought + action
      }
    )

    // Count iterations from messages
    iterations = countAgentIterations(result.messages)

    console.log('\n' + '─'.repeat(70))
    console.log(`✅ Agent completed after ${iterations} iterations`)

    // Parse the agent's response
    const researchResult = parseAgentResponse(result, job, iterations)
    
    const processingTime = Date.now() - startTime
    console.log(`⏱️ Processing time: ${(processingTime / 1000).toFixed(2)}s`)
    console.log('═'.repeat(70) + '\n')

    return researchResult

  } catch (error) {
    console.error(`❌ Research agent error (after ${((Date.now() - startTime) / 1000).toFixed(2)}s):`, error)
    
    return {
      jobId: job.id,
      company: job.company,
      position: job.position,
      found: false,
      sourcesSearched: [],
      extractedData: {},
      reasoning: `Research failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      iterations: 0,
    }
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Build the research task for the agent
 */
function buildResearchTask(job: JobListing, config: AgentConfig): string {
  const locationInfo = job.location ? `Location: ${job.location}` : 'Location: Not specified'
  const urlInfo = job.originalUrl 
    ? `Original URL (may require auth): ${job.originalUrl}` 
    : 'No original URL provided'
  
  const linkedinWarning = job.originalUrl?.includes('linkedin.com')
    ? '\n⚠️ WARNING: The LinkedIn URL requires authentication. You MUST find an alternative public source.'
    : ''

  return `Research this job and find the complete public job description:

## JOB DETAILS
Company: ${job.company}
Position: ${job.position}
${locationInfo}
${urlInfo}
${linkedinWarning}

## WHAT TO FIND
1. The complete job description
2. Requirements and qualifications
3. Technologies and skills required
4. Application deadline (if mentioned)
5. Work type (remote, hybrid, onsite)

## EXTRACTION FIELDS (from user configuration)
${config.extractionFields}

## START YOUR RESEARCH
Begin by using smart_job_search with the company and position.
Then iterate: search → extract → validate → repeat if needed.

Remember:
- Be thorough - don't stop at the first result
- Prefer company career pages over job boards
- Skip LinkedIn URLs (they need authentication)
- Extract full content to get all details

Go ahead and start your research!`
}

/**
 * Count the number of tool-use iterations in agent messages
 */
function countAgentIterations(messages: unknown[]): number {
  let count = 0
  for (const msg of messages) {
    // Count tool messages as iterations
    const typedMsg = msg as { _getType?: () => string }
    if (typedMsg._getType && typedMsg._getType() === 'tool') {
      count++
    }
  }
  return count
}

/**
 * Parse the agent's response into structured result
 */
function parseAgentResponse(
  result: { messages: unknown[] },
  job: JobListing,
  iterations: number
): JobResearchResult {
  // Get the last AI message (final response)
  const messages = result.messages || []
  let finalContent = ''
  
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as { _getType?: () => string; content?: string | unknown }
    if (msg._getType && msg._getType() === 'ai' && msg.content) {
      finalContent = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      break
    }
  }

  // Try to extract structured data from the response
  let found = false
  let jobDescription: string | undefined
  let primarySourceUrl: string | undefined
  let requirements: string[] = []
  let technologies: string[] = []
  let deadline: string | undefined
  const reasoning = finalContent

  // Check for success indicators
  const contentLower = finalContent.toLowerCase()
  found = contentLower.includes('found') && 
          !contentLower.includes('not found') &&
          !contentLower.includes("couldn't find") &&
          !contentLower.includes("could not find")

  // Try to extract URL
  const urlMatch = finalContent.match(/https?:\/\/[^\s\)"']+/)
  if (urlMatch) {
    primarySourceUrl = urlMatch[0]
  }

  // Look for structured sections in the response
  const requirementsMatch = finalContent.match(/requirements?[:\s]+([^#]+?)(?=\n\n|\n##|technologies?|$)/i)
  if (requirementsMatch) {
    requirements = requirementsMatch[1]
      .split(/[\n,•\-]/)
      .map(r => r.trim())
      .filter(r => r.length > 5)
      .slice(0, 10)
  }

  const technologiesMatch = finalContent.match(/technologies?[:\s]+([^#]+?)(?=\n\n|\n##|deadline|$)/i)
  if (technologiesMatch) {
    technologies = technologiesMatch[1]
      .split(/[\n,•\-]/)
      .map(t => t.trim())
      .filter(t => t.length > 1 && t.length < 30)
      .slice(0, 15)
  }

  const deadlineMatch = finalContent.match(/deadline[:\s]+([^\n]+)/i)
  if (deadlineMatch) {
    deadline = deadlineMatch[1].trim()
  }

  // Build sources list from tool calls
  const sourcesSearched = extractSourcesFromMessages(messages)

  // If we found content, try to extract more
  if (primarySourceUrl && found) {
    // Look for job description in the messages (from extract tools)
    for (const rawMsg of messages) {
      const msg = rawMsg as { _getType?: () => string; content?: string | unknown }
      if (msg._getType && msg._getType() === 'tool' && msg.content) {
        try {
          const contentStr = typeof msg.content === 'string' ? msg.content : ''
          const toolResult = JSON.parse(contentStr) as Record<string, unknown>
          if (toolResult.fullContent || toolResult.rawContent) {
            const content = (toolResult.fullContent || toolResult.rawContent) as string
            if (content.length > (jobDescription?.length || 0)) {
              jobDescription = content
            }
          }
        } catch {
          // Not JSON, skip
        }
      }
    }
  }

  return {
    jobId: job.id,
    company: job.company,
    position: job.position,
    found,
    jobDescription,
    sourcesSearched,
    primarySource: primarySourceUrl ? {
      url: primarySourceUrl,
      title: `${job.position} at ${job.company}`,
      content: jobDescription || '',
      score: found ? 0.9 : 0.3,
      isPrimarySource: true,
      sourceType: identifySourceType(primarySourceUrl),
    } : undefined,
    requirements: requirements.length > 0 ? requirements : undefined,
    technologies: technologies.length > 0 ? technologies : undefined,
    deadline,
    extractedData: {
      requirements,
      technologies,
      deadline,
      found,
      primarySource: primarySourceUrl,
    },
    reasoning,
    iterations,
  }
}

/**
 * Extract sources searched from agent messages
 */
type SourceType = 'career_page' | 'job_board' | 'company_page' | 'other'

function extractSourcesFromMessages(
  messages: unknown[]
): Array<{ url: string; title: string; content: string; score: number; isPrimarySource: boolean; sourceType: SourceType }> {
  const sources: Array<{ url: string; title: string; content: string; score: number; isPrimarySource: boolean; sourceType: SourceType }> = []
  const seenUrls = new Set<string>()

  for (const rawMsg of messages) {
    const msg = rawMsg as { _getType?: () => string; content?: string | unknown }
    if (msg._getType && msg._getType() === 'tool' && msg.content) {
      try {
        const contentStr = typeof msg.content === 'string' ? msg.content : ''
        const toolResult = JSON.parse(contentStr) as Record<string, unknown>
        
        // Helper to validate source type
        const validSourceTypes: SourceType[] = ['career_page', 'job_board', 'company_page', 'other']
        const getSourceType = (url: string, rawType?: string): SourceType => {
          if (rawType && validSourceTypes.includes(rawType as SourceType)) {
            return rawType as SourceType
          }
          return identifySourceType(url)
        }

        // Extract from search results
        if (toolResult.results && Array.isArray(toolResult.results)) {
          for (const r of toolResult.results) {
            if (r.url && !seenUrls.has(r.url)) {
              seenUrls.add(r.url)
              sources.push({
                url: r.url,
                title: r.title || '',
                content: (r.content || '').substring(0, 200),
                score: r.score || 0,
                isPrimarySource: false,
                sourceType: getSourceType(r.url, r.sourceType),
              })
            }
          }
        }
        
        // Extract from bestResults
        if (toolResult.bestResults && Array.isArray(toolResult.bestResults)) {
          for (const r of toolResult.bestResults) {
            if (r.url && !seenUrls.has(r.url)) {
              seenUrls.add(r.url)
              sources.push({
                url: r.url,
                title: r.title || '',
                content: (r.content || '').substring(0, 200),
                score: r.score || 0,
                isPrimarySource: false,
                sourceType: getSourceType(r.url, r.sourceType),
              })
            }
          }
        }
      } catch {
        // Not JSON, skip
      }
    }
  }

  return sources
}

/**
 * Identify source type from URL
 */
function identifySourceType(url: string): 'career_page' | 'job_board' | 'company_page' | 'other' {
  const urlLower = url.toLowerCase()
  
  if (urlLower.includes('/careers') || urlLower.includes('/jobs') || 
      urlLower.includes('/career') || urlLower.includes('/job') ||
      urlLower.includes('/stillinger') || urlLower.includes('/arbejde')) {
    return 'career_page'
  }
  
  const jobBoards = ['jobindex.dk', 'linkedin.com', 'indeed.com', 'glassdoor.com', 'monster.dk']
  if (jobBoards.some(board => urlLower.includes(board))) {
    return 'job_board'
  }
  
  if (urlLower.includes('/about') || urlLower.includes('/om-os')) {
    return 'company_page'
  }
  
  return 'other'
}

// ============================================
// Batch Research Function
// ============================================

/**
 * Research multiple jobs in parallel
 * 
 * @param jobs - Array of job listings to research
 * @param config - Agent configuration
 * @param maxConcurrent - Maximum concurrent research tasks (default 3)
 * @returns Array of research results
 */
export async function researchJobsBatch(
  jobs: JobListing[],
  config: AgentConfig,
  maxConcurrent: number = 3
): Promise<JobResearchResult[]> {
  console.log('\n' + '═'.repeat(70))
  console.log('🔍 BATCH RESEARCH - START')
  console.log('═'.repeat(70))
  console.log(`📋 Total jobs to research: ${jobs.length}`)
  console.log(`⚡ Max concurrent: ${maxConcurrent}`)
  console.log('═'.repeat(70))

  const results: JobResearchResult[] = []
  
  // Process in batches
  for (let i = 0; i < jobs.length; i += maxConcurrent) {
    const batch = jobs.slice(i, i + maxConcurrent)
    console.log(`\n📦 Processing batch ${Math.floor(i / maxConcurrent) + 1}/${Math.ceil(jobs.length / maxConcurrent)}`)
    
    const batchResults = await Promise.all(
      batch.map(job => researchJob(job, config))
    )
    
    results.push(...batchResults)
  }

  console.log('\n' + '═'.repeat(70))
  console.log('✅ BATCH RESEARCH - COMPLETE')
  console.log(`📊 Researched: ${results.length} jobs`)
  console.log(`✓ Found: ${results.filter(r => r.found).length}`)
  console.log(`✗ Not found: ${results.filter(r => !r.found).length}`)
  console.log('═'.repeat(70) + '\n')

  return results
}

// createResearchAgent, researchJob, and researchJobsBatch are exported inline above
