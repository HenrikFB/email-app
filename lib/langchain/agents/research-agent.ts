/**
 * Research Agent
 * 
 * ReAct-style agent for researching job listings.
 * This agent iteratively uses tools to find public job descriptions
 * when the original URLs (like LinkedIn) require authentication.
 * 
 * Implements OpenAI's GPT-4.1 agentic prompting best practices:
 * - Explicit planning before each action
 * - Reflection after each observation
 * - Persistence and multiple strategies
 * - Tool usage with reasoning
 */

import { ChatOpenAI } from '@langchain/openai'
import { createReactAgent } from '@langchain/langgraph/prebuilt'
import { HumanMessage } from '@langchain/core/messages'
import { allResearchTools } from '../tools'
import { JOB_SEARCH_CONFIG, RESEARCH_EXAMPLES } from '../configs'
import type { JobListing, JobResearchResult, AgentConfig } from '../types'

// ============================================
// Agent Configuration
// ============================================

const RESEARCH_AGENT_MODEL = 'gpt-4o-mini'
// Use config value - reduced to prevent context overflow
const MAX_ITERATIONS = JOB_SEARCH_CONFIG.research.maxIterations

/**
 * Build the comprehensive system prompt for the research agent
 * Following OpenAI's GPT-4.1 agentic prompting best practices
 */
function buildResearchSystemPrompt(config: AgentConfig): string {
  const researchConfig = JOB_SEARCH_CONFIG.research

  return `You are an expert job research agent. Your mission is to find complete, public job descriptions for positions mentioned in emails.

## AGENTIC BEHAVIOR GUIDELINES

### Persistence
- NEVER give up after the first search attempt
- If one approach fails, try a different strategy
- Keep iterating until you find the job description OR exhaust all reasonable options
- A "not found" result should only come after 3+ different search strategies

### Planning (Before Each Action)
Before using any tool, EXPLICITLY state:
1. 🎯 GOAL: What am I trying to achieve?
2. 📋 PLAN: What tool will I use and why?
3. 🔮 EXPECTATION: What do I expect to find?

### Reflection (After Each Observation)
After each tool result, EXPLICITLY state:
1. ✅ FOUND: What useful information did I get?
2. ❌ MISSING: What am I still looking for?
3. ➡️ NEXT: What should I do next?

## THE PROBLEM YOU SOLVE
Job emails often contain LinkedIn URLs that require authentication. You need to find the SAME job on PUBLIC sources.

## RESEARCH STRATEGIES (In Order of Preference)

### Strategy 1: Company Career Page
Search: "[Company Name] careers [Job Title]"
Why: Company career pages have the most complete information
Example: "Danske Bank careers Backend Developer"

### Strategy 2: Danish Job Boards
Search on these domains:
${researchConfig.preferredDomains.map(d => `- ${d}`).join('\n')}

### Strategy 3: General Search with Job Focus
Search: "[Job Title] [Company Name] job description"
Add location if known: "København" or "Copenhagen"

### Strategy 4: Alternative Titles
If not found, try variations:
- "Software Developer" ↔ "Software Engineer" ↔ "Softwareudvikler"
- "Backend Developer" ↔ ".NET Developer" ↔ "C# Developer"

## YOUR TOOLS

### smart_job_search
Best for: Initial search to find relevant URLs
Input: company name and position
Output: Ranked list of URLs with recommendations

### tavily_search
Best for: General web search with control
Input: search query with optional domain filters
Output: Search results with snippets

### tavily_extract / extract_job_description
Best for: Getting full content from a URL
Input: URL to extract
Output: Complete page content

## RESEARCH WORKFLOW

\`\`\`
START
  │
  ▼
┌─────────────────────────────────────────┐
│ PLAN: State your goal and first search  │
└─────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────┐
│ ACTION: Use smart_job_search with       │
│         company + position              │
└─────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────┐
│ REFLECT: What did I find?               │
│ - Good URLs? → Extract content          │
│ - Nothing useful? → Try different query │
└─────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────┐
│ ACTION: Extract from best URL           │
└─────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────┐
│ REFLECT: Is this the full job desc?     │
│ - Yes, has requirements → SUCCESS       │
│ - Partial info → Extract another URL    │
│ - Wrong job → Search again              │
└─────────────────────────────────────────┘
  │
  ▼
REPEAT until found or strategies exhausted
\`\`\`

## HANDLING COMMON SCENARIOS

### Scenario: LinkedIn URL
${RESEARCH_EXAMPLES.linkedinWorkaround.problem}
Solution:
${RESEARCH_EXAMPLES.linkedinWorkaround.solution}

### Scenario: Jobindex Deep Link
${RESEARCH_EXAMPLES.jobindexDeepLink.problem}
Solution:
${RESEARCH_EXAMPLES.jobindexDeepLink.solution}

## DOMAINS TO AVOID
${researchConfig.avoidDomains.map(d => `- ${d} (requires authentication)`).join('\n')}

## USER'S CRITERIA
The user is looking for jobs matching:
${config.matchCriteria}

They want to extract:
${config.extractionFields}

User's intent:
${config.userIntent || 'Find relevant job opportunities'}

## SUCCESS CRITERIA
You have succeeded when you can provide:
1. ✅ Full job description (not just a snippet)
2. ✅ Requirements and qualifications
3. ✅ Technologies/skills mentioned
4. ✅ Public source URL
5. ✅ Any deadline information

## ⚡ EARLY STOPPING - STOP AS SOON AS YOU FIND IT!

**IMPORTANT: Stop searching immediately once you have a valid job description!**

When you find content that:
- ✅ Mentions the correct company name
- ✅ Has the job title or equivalent
- ✅ Contains requirements/qualifications section
- ✅ Is from a public URL (not LinkedIn)

→ **STOP IMMEDIATELY and provide your final answer!**

Do NOT continue searching "just to be thorough" - this wastes context and may cause errors.

### Bad pattern (wastes context):
1. Search → find career page
2. Extract → valid job description ← SHOULD STOP HERE
3. Search again "to verify" ← UNNECESSARY
4. Extract another URL ← WASTES CONTEXT
5. Error: context too long ← BAD!

### Good pattern:
1. Search → find career page
2. Extract → valid job description
3. Validate → matches criteria
4. STOP → provide final answer immediately

## CRITICAL: JOB VALIDATION (Before Concluding "Found")

⚠️ BEFORE marking any job as "Found", you MUST validate that you found the CORRECT job.
This is crucial - do NOT report success for the wrong job or a generic template!

### Validation Checklist (Reason Through Each)

<validation_thinking>
1. **COMPANY MATCH**: 
   - Does the content mention the EXACT company name I was looking for?
   - Watch for: Different companies, subsidiaries, or no company mentioned
   - ✅ MATCH / ⚠️ SIMILAR / ❌ WRONG COMPANY

2. **POSITION MATCH**:
   - Is this the same job title (or clear equivalent)?
   - Equivalents OK: "Software Developer" ≈ "Software Engineer" ≈ "Softwareudvikler"
   - Different role = wrong job
   - ✅ MATCH / ⚠️ SIMILAR / ❌ DIFFERENT ROLE

3. **LOCATION CHECK**:
   - Is this job in the expected country/city?
   - CRITICAL: "Bangalore, India" ≠ "Aalborg, Denmark" - completely wrong job!
   - Remote jobs are OK if they match the expected region
   - ✅ CORRECT LOCATION / ⚠️ DIFFERENT CITY / ❌ WRONG COUNTRY

4. **CONTENT TYPE CHECK**:
   - Is this a REAL job posting with specific company details?
   - RED FLAGS for templates/generic content:
     - URL contains "/hire/job-description/" or "templates" or "sample"
     - Content talks about "how to write" or "example"
     - No specific company name, deadline, or salary range
     - Generic responsibilities without company context
   - ✅ REAL JOB POSTING / ❌ TEMPLATE OR GENERIC
</validation_thinking>

### Validation Decision Rules
- If company is WRONG → Status: "Not Found" - keep searching
- If location is WRONG COUNTRY → Status: "Not Found" - this is a different job!
- If content is a TEMPLATE → Status: "Not Found" - not the real posting
- All checks pass → Status: "Found" ✅

### Example: Catching a Wrong Match
<example>
Task: Find "Full Stack Developer at Unleash, Remote (Europe)"
Found: indeed.com/hire/job-description/full-stack-developer

<validation_thinking>
1. COMPANY MATCH: ❌ WRONG - Content doesn't mention "Unleash" anywhere
2. POSITION MATCH: ⚠️ Title says "Full Stack Developer" - matches
3. LOCATION CHECK: ❌ WRONG - No location specified, this is generic
4. CONTENT TYPE: ❌ TEMPLATE - URL is Indeed's job description template generator!
</validation_thinking>

Decision: NOT FOUND - This is a generic template page, not the actual Unleash job.
Action: Continue searching with "Unleash careers Full Stack Developer Europe"
</example>

### Example: Catching Wrong Location
<example>
Task: Find "Software Developer at ABB, Aalborg, Denmark"
Found: builtin.com/job/software-engineer/7917290

<validation_thinking>
1. COMPANY MATCH: ✅ MATCH - Content mentions "ABB"
2. POSITION MATCH: ✅ MATCH - "Software Developer" matches
3. LOCATION CHECK: ❌ WRONG COUNTRY - Content says "Bangalore, India"!
4. CONTENT TYPE: ✅ REAL - Has specific requirements and company info
</validation_thinking>

Decision: NOT FOUND - This is a real ABB job but in INDIA, not Denmark.
Action: Search specifically for "ABB careers Software Developer Aalborg Denmark"
</example>

## OUTPUT FORMAT
When you have found sufficient information, summarize:

\`\`\`
## RESEARCH RESULT

**Status**: Found / Partially Found / Not Found
**Confidence**: High / Medium / Low
**Primary Source**: [URL]

### Validation Check
- Company Match: ✅/❌ [Explanation]
- Position Match: ✅/❌ [Explanation]  
- Location Match: ✅/❌ [Explanation]
- Content Type: ✅ Real Job / ❌ Template

### Job Description
[Full job description text]

### Requirements
- Requirement 1
- Requirement 2
...

### Technologies
- Technology 1
- Technology 2
...

### Additional Info
- Deadline: [if found]
- Work Type: [remote/hybrid/onsite]
- Experience: [level required]
- Location Found: [actual location in job posting]

### Research Path
1. First, I searched for...
2. Then, I tried...
3. Finally, I found...
\`\`\`

Remember: Be thorough, be persistent, validate before concluding, and document your reasoning at every step.`
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
    temperature: 0.2, // Lower temperature for focused reasoning
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

    // Build the research task with explicit planning prompt
    const task = buildResearchTask(job, config)

    console.log('\n📝 Research Task (preview):')
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
    console.log(`✅ Agent completed after ${iterations} tool uses`)

    // Parse the agent's response
    const researchResult = parseAgentResponse(result, job, iterations)
    
    const processingTime = Date.now() - startTime
    console.log(`⏱️ Processing time: ${(processingTime / 1000).toFixed(2)}s`)
    console.log(`📊 Result: ${researchResult.found ? 'FOUND' : 'NOT FOUND'}`)
    console.log('═'.repeat(70) + '\n')

    return researchResult

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const processingTime = (Date.now() - startTime) / 1000
    
    // Check for context length errors specifically
    const isContextError = errorMessage.includes('context length') || 
                           errorMessage.includes('maximum context') ||
                           errorMessage.includes('token')
    
    if (isContextError) {
      console.warn(`⚠️ Context overflow for ${job.company} after ${processingTime.toFixed(2)}s`)
      console.warn(`   This job accumulated too much content - consider simplifying research`)
    } else {
      console.error(`❌ Research agent error (after ${processingTime.toFixed(2)}s):`, error)
    }
    
    return {
      jobId: job.id,
      company: job.company,
      position: job.position,
      found: false,
      sourcesSearched: [],
      extractedData: {},
      reasoning: isContextError 
        ? `Research stopped: context size exceeded (job may have complex/large content)`
        : `Research failed: ${errorMessage}`,
      iterations: 0,
    }
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Build the research task with explicit planning prompt
 */
function buildResearchTask(job: JobListing, config: AgentConfig): string {
  const locationInfo = job.location ? `Location: ${job.location}` : 'Location: Not specified'
  const urlInfo = job.originalUrl 
    ? `Original URL (may require auth): ${job.originalUrl}` 
    : 'No original URL provided'
  
  const linkedinWarning = job.originalUrl?.includes('linkedin.com')
    ? `
⚠️ IMPORTANT: The LinkedIn URL requires authentication and cannot be accessed.
You MUST find an alternative public source for this job.
`
    : ''

  return `## YOUR RESEARCH TASK

Find the complete, public job description for this position:

### JOB DETAILS
- **Company**: ${job.company}
- **Position**: ${job.position}
- **${locationInfo}**
- **${urlInfo}**
${linkedinWarning}

### WHAT TO FIND
1. Complete job description with full text
2. Requirements and qualifications
3. Technologies and skills required
4. Application deadline (if mentioned)
5. Work type (remote/hybrid/onsite)

### EXTRACTION FIELDS (from user configuration)
${config.extractionFields}

### YOUR FIRST STEP
Before doing anything, state your PLAN:
- 🎯 GOAL: What are you trying to find?
- 📋 PLAN: What's your first search strategy?
- 🔮 EXPECTATION: What do you expect to find?

Then execute your plan using the tools.

### REMEMBER
- Be persistent - try multiple strategies if needed
- Prefer company career pages over job boards
- Skip LinkedIn (requires auth)
- Extract FULL content, not just snippets
- Document your reasoning at each step

### ⚠️ CRITICAL: VALIDATE BEFORE CONCLUDING
Before you report "Found", you MUST verify:
1. The content mentions **"${job.company}"** as the employer
2. The job title is **"${job.position}"** (or equivalent)
3. The location matches **${job.location || 'expected region'}** - WRONG COUNTRY = WRONG JOB!
4. This is a REAL job posting, not a template or generic page

If ANY validation fails, CONTINUE SEARCHING. Do NOT report success for the wrong job!

Go ahead and start your research!`
}

/**
 * Count the number of tool-use iterations in agent messages
 */
function countAgentIterations(messages: unknown[]): number {
  let count = 0
  for (const msg of messages) {
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
  const messages = result.messages || []
  let finalContent = ''
  
  // Get the last AI message (final response)
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
  const llmSaysFound = (contentLower.includes('found') || contentLower.includes('status**: found')) && 
          !contentLower.includes('not found') &&
          !contentLower.includes("couldn't find") &&
          !contentLower.includes("could not find")
  
  // Initial found status based on LLM response
  found = llmSaysFound

  // Try to extract URL
  const urlMatch = finalContent.match(/https?:\/\/[^\s\)"'<>]+/)
  if (urlMatch) {
    primarySourceUrl = urlMatch[0].replace(/[.,;:!?]$/, '') // Clean trailing punctuation
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

  // If we found content, try to extract the full job description from tool results
  // Tavily extract returns: { success: true, results: [{ url, rawContent, ... }] }
  if (primarySourceUrl && found) {
    for (const rawMsg of messages) {
      const msg = rawMsg as { _getType?: () => string; content?: string | unknown }
      if (msg._getType && msg._getType() === 'tool' && msg.content) {
        try {
          const contentStr = typeof msg.content === 'string' ? msg.content : ''
          const toolResult = JSON.parse(contentStr) as Record<string, unknown>
          
          // Check top-level rawContent/fullContent (legacy format)
          if (toolResult.fullContent || toolResult.rawContent) {
            const content = (toolResult.fullContent || toolResult.rawContent) as string
            if (content.length > (jobDescription?.length || 0)) {
              jobDescription = content
            }
          }
          
          // Check nested results array (Tavily extract format)
          // Format: { results: [{ url, rawContent, contentLength, ... }] }
          if (toolResult.results && Array.isArray(toolResult.results)) {
            for (const result of toolResult.results as Array<{ url?: string; rawContent?: string; content?: string }>) {
              const content = result.rawContent || result.content
              if (content && content.length > (jobDescription?.length || 0)) {
                // Prioritize content from the primary source URL
                if (result.url && primarySourceUrl.includes(new URL(result.url).hostname)) {
                  jobDescription = content
                } else if (!jobDescription) {
                  jobDescription = content
                }
              }
            }
          }
        } catch {
          // Not JSON, skip
        }
      }
    }
  }

  // ============================================
  // CRITICAL: Company Name Validation
  // ============================================
  // The LLM may report "found" for a page that doesn't actually contain
  // the target company. We enforce stricter validation here.
  
  let validationFailed = false
  let validationReason = ''
  
  if (found && jobDescription) {
    const descriptionLower = jobDescription.toLowerCase()
    const companyLower = job.company.toLowerCase()
    
    // Get company name variants (handle A/S, ApS, etc.)
    const companyVariants = [
      companyLower,
      companyLower.replace(/\s*(a\/s|aps|i\/s|k\/s|gmbh|inc|ltd|llc|as|a\.s\.)$/i, '').trim(),
      companyLower.replace(/\s+/g, ''), // No spaces
      companyLower.split(' ')[0], // First word only (for long company names)
    ].filter(v => v.length > 2)
    
    // Check if ANY company variant appears in the description
    const companyFound = companyVariants.some(variant => 
      descriptionLower.includes(variant) ||
      finalContent.toLowerCase().includes(variant) // Also check the LLM response
    )
    
    if (!companyFound) {
      // Double-check: Look for the company in a more flexible way
      const companyWords = job.company.toLowerCase().split(/[\s\-&]+/).filter(w => w.length > 3)
      const partialMatch = companyWords.length > 0 && 
        companyWords.some(word => descriptionLower.includes(word))
      
      if (!partialMatch) {
        validationFailed = true
        validationReason = `Company name "${job.company}" not found in extracted content`
        found = false
        console.warn(`   ⚠️ VALIDATION FAILED: ${validationReason}`)
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
      validationFailed,
      validationReason: validationReason || undefined,
    },
    reasoning: validationFailed 
      ? `[VALIDATION FAILED: ${validationReason}] ${reasoning}`
      : reasoning,
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
function identifySourceType(url: string): SourceType {
  const urlLower = url.toLowerCase()
  
  if (urlLower.includes('/careers') || urlLower.includes('/jobs') || 
      urlLower.includes('/career') || urlLower.includes('/job') ||
      urlLower.includes('/stillinger') || urlLower.includes('/arbejde')) {
    return 'career_page'
  }
  
  const jobBoards = ['jobindex.dk', 'linkedin.com', 'indeed.com', 'glassdoor.com', 'monster.dk', 'karriere.dk']
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
 * @param maxConcurrent - Maximum concurrent research tasks (default from config)
 * @returns Array of research results
 */
export async function researchJobsBatch(
  jobs: JobListing[],
  config: AgentConfig,
  maxConcurrent: number = JOB_SEARCH_CONFIG.research.maxConcurrent
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
