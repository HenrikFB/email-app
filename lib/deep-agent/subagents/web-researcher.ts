/**
 * Web Researcher Sub-Agent
 * 
 * Specialized sub-agent for searching the web using Tavily.
 */

import { SYSTEM_PROMPTS, MODEL_CONFIG } from '../config'
import { webSearchTools } from '../tools/web-search'
import type { SubAgentConfig } from '../types'

/**
 * Web Researcher Sub-Agent Configuration
 * 
 * Responsibilities:
 * - Search for public information about entities mentioned in emails
 * - Find company career pages and job postings
 * - Research companies and their offerings
 * - Return concise summaries (not raw content)
 */
export const webResearcherSubAgent: SubAgentConfig & { tools: typeof webSearchTools } = {
  name: 'web-researcher',
  description: `Searches the web for relevant public information using Tavily.
Use when you need to:
- Find company websites, career pages, or job postings
- Research companies mentioned in emails
- Find public sources for entities extracted from emails
- Gather additional context from the web`,
  
  systemPrompt: SYSTEM_PROMPTS.webResearcher,
  
  model: MODEL_CONFIG.webResearcher,
  
  tools: webSearchTools,
}

/**
 * Create web research task description
 */
export function createWebResearchTask(params: {
  searchTerms: string[]
  companies: string[]
  additionalContext?: string
}): string {
  const hasCompanies = params.companies.length > 0
  const hasTerms = params.searchTerms.length > 0
  
  return `Research the following using web search:

${hasCompanies ? `Companies to research:\n${params.companies.map(c => `- ${c}`).join('\n')}\n` : ''}
${hasTerms ? `Search terms:\n${params.searchTerms.map(t => `- ${t}`).join('\n')}\n` : ''}
${params.additionalContext ? `Additional context: ${params.additionalContext}` : ''}

Tasks:
1. ${hasCompanies ? 'Use research_company for each company to find their careers page and about information' : 'Search for relevant public sources'}
2. Use tavily_search for any specific queries about technologies or roles
3. Summarize key findings (don't include full page content)

Return a summary with:
- Key findings (2-3 bullet points per source)
- Relevant URLs with brief descriptions
- Any important information discovered (job requirements, company info, etc.)

Keep responses concise - the main agent only needs summaries, not raw data.`
}

