/**
 * KB Researcher Sub-Agent
 * 
 * Specialized sub-agent for searching the user's knowledge base.
 */

import { SYSTEM_PROMPTS, MODEL_CONFIG } from '../config'
import { kbSearchTools } from '../tools/kb-search'
import type { SubAgentConfig } from '../types'

/**
 * KB Researcher Sub-Agent Configuration
 * 
 * Responsibilities:
 * - Generate multiple targeted search queries
 * - Search KB iteratively with different intents
 * - Find relevant content for each technology/skill separately
 * - Analyze coverage and identify gaps
 */
export const kbResearcherSubAgent: SubAgentConfig & { tools: typeof kbSearchTools } = {
  name: 'kb-researcher',
  description: `Searches the user's knowledge base for relevant past content (cover letters, projects, etc.).
Use when you need to:
- Find relevant cover letters or application materials
- Search for project descriptions matching specific technologies
- Look up past experiences relevant to job requirements
- Find examples to reference in new drafts

IMPORTANT: This sub-agent will search MULTIPLE TIMES with different queries to ensure comprehensive coverage.`,
  
  systemPrompt: SYSTEM_PROMPTS.kbResearcher,
  
  model: MODEL_CONFIG.kbResearcher,
  
  tools: kbSearchTools,
}

/**
 * Create KB research task description
 */
export function createKBResearchTask(params: {
  extractedData: Record<string, unknown>
  userId: string
  knowledgeBaseIds: string[]
  userIntent?: string
}): string {
  const technologies = (params.extractedData.technologies as string[]) || []
  const skills = (params.extractedData.skills as string[]) || []
  const jobTitle = params.extractedData.jobTitle || params.extractedData.title
  
  return `Search the knowledge base for relevant content.

User ID: ${params.userId}
Knowledge Base IDs: ${params.knowledgeBaseIds.join(', ')}
${params.userIntent ? `User's Intent: ${params.userIntent}` : ''}

Extracted data to search for:
${JSON.stringify(params.extractedData, null, 2)}

${technologies.length > 0 ? `\nKey technologies to search (EACH SEPARATELY):\n${technologies.map(t => `- ${t}`).join('\n')}` : ''}
${skills.length > 0 ? `\nKey skills to search:\n${skills.map(s => `- ${s}`).join('\n')}` : ''}
${jobTitle ? `\nJob title/role: ${jobTitle}` : ''}

TASKS (ITERATIVE SEARCH):
1. Use generate_kb_search_queries to create targeted queries from the extracted data
2. Use multi_intent_kb_search to search for each intent separately (e.g., ".NET experience" as one search, "React projects" as another)
3. Review results and identify coverage gaps
4. If gaps exist, use search_knowledge_base with alternative queries
5. If specific documents look promising, use get_kb_document to retrieve full content

IMPORTANT:
- Search for EACH major technology/skill SEPARATELY
- Don't combine multiple unrelated terms in one query
- Track which requirements have good coverage vs. gaps

Return a summary with:
- Queries executed with result counts
- Most relevant content found (document titles + snippets)
- Coverage analysis (what was found vs. what's missing)
- Recommendations for the draft writer`
}

