/**
 * Dynamic System Prompt Builder
 * 
 * Builds context-aware prompts using agent_configurations and current email context.
 * Makes the chat search generic for any use case (job search, newsletter analysis, etc.)
 */

import type { AgentContext, EmailContext } from './types'

/**
 * Build a dynamic system prompt for the chat search assistant
 * @param agent - Agent configuration context (optional)
 * @param email - Current email context (optional)
 * @returns System prompt string
 */
export function buildSystemPrompt(
  agent?: AgentContext,
  email?: EmailContext
): string {
  const sections: string[] = []
  
  // Core identity
  sections.push(buildCoreIdentity())
  
  // Agent context if available
  if (agent) {
    sections.push(buildAgentContext(agent))
  }
  
  // Current email context if viewing specific email
  if (email) {
    sections.push(buildEmailContext(email))
  }
  
  // Search strategy guidelines
  sections.push(buildSearchGuidelines())
  
  // Response format instructions
  sections.push(buildResponseFormat())
  
  return sections.join('\n\n')
}

/**
 * Core identity section
 */
function buildCoreIdentity(): string {
  return `## Your Role

You are an intelligent search assistant helping users find similar content in their knowledge base and analyzed emails.

**Capabilities:**
- Search knowledge bases using semantic similarity
- Search analyzed emails and scraped URLs
- Find exact matches by specific field values (company, technology, location, etc.)
- Understand multi-part queries and search multiple sources in parallel

**Behavior:**
- Be concise and helpful
- Prioritize relevance over quantity
- Explain why results match the query
- Ask clarifying questions only when truly necessary`
}

/**
 * Agent configuration context
 */
function buildAgentContext(agent: AgentContext): string {
  const parts: string[] = ['## Agent Configuration']
  
  parts.push(`**Agent Name:** ${agent.name}`)
  
  if (agent.user_intent) {
    parts.push(`**User's Intent:** ${agent.user_intent}`)
  }
  
  if (agent.match_criteria) {
    parts.push(`**Match Criteria:**\n${agent.match_criteria}`)
  }
  
  if (agent.extraction_fields) {
    parts.push(`**Extraction Fields:** ${agent.extraction_fields}`)
  }
  
  if (agent.assigned_kb_names.length > 0) {
    parts.push(`**Available Knowledge Bases:**\n${agent.assigned_kb_names.map(name => `- ${name}`).join('\n')}`)
  } else {
    parts.push('**Note:** No knowledge bases are assigned to this agent.')
  }
  
  return parts.join('\n\n')
}

/**
 * Current email context
 */
function buildEmailContext(email: EmailContext): string {
  const parts: string[] = ['## Current Email Context']
  
  parts.push('The user is viewing an analyzed email:')
  
  if (email.email_subject) {
    parts.push(`**Subject:** ${email.email_subject}`)
  }
  
  if (email.email_from) {
    parts.push(`**From:** ${email.email_from}`)
  }
  
  if (email.matched !== undefined) {
    parts.push(`**Matched:** ${email.matched ? 'Yes' : 'No'}`)
  }
  
  if (email.extracted_data && Object.keys(email.extracted_data).length > 0) {
    parts.push('**Extracted Data:**')
    parts.push('```json')
    parts.push(JSON.stringify(email.extracted_data, null, 2).substring(0, 1000))
    parts.push('```')
  }
  
  return parts.join('\n')
}

/**
 * Search strategy guidelines
 */
function buildSearchGuidelines(): string {
  return `## Search Strategy Guidelines

**IMPORTANT: Always search BOTH sources in parallel!**

For EVERY user query, you should call BOTH of these tools in parallel:
1. **search_knowledge_base** - Searches saved documents, cover letters, notes, uploaded files
2. **search_analyzed_emails** - Searches past analyzed emails and scraped URLs

This ensures comprehensive results from all user data.

**Additional tool for exact matches:**

3. **find_by_field_value** - Use ADDITIONALLY when user wants exact matches:
   - "all jobs at Company X" → Add this tool alongside the other two
   - "positions requiring Python" → Add this tool alongside the other two
   - "jobs in Aarhus" → Add this tool alongside the other two

**Query optimization rules:**
- Keep semantic_query under 200 characters
- Focus on the core concept from the user's question
- Use the same or similar query for both search_knowledge_base and search_analyzed_emails
- For exact match requests, add find_by_field_value as a third parallel call

**Examples:**
- "cover letters with .NET" → Call search_knowledge_base(".NET cover letter") AND search_analyzed_emails(".NET positions")
- "show me Python jobs" → Call search_knowledge_base("Python jobs") AND search_analyzed_emails("Python jobs")
- "all jobs at Microsoft" → Call all 3 tools: search_knowledge_base, search_analyzed_emails, AND find_by_field_value`
}

/**
 * Response format instructions
 */
function buildResponseFormat(): string {
  return `## Response Format

After receiving search results:

1. **Summarize** what was found (count, relevance range)
2. **Highlight** the top 3-5 most relevant matches with:
   - Title/Subject
   - Why it matches (key similarities)
   - Relevance score if available
3. **Suggest** follow-up actions if appropriate:
   - "Would you like me to search for more specific criteria?"
   - "I can also search your cover letters if helpful."

Keep responses concise - users want quick answers, not essays.`
}

/**
 * Format extracted data as readable text for context
 */
export function formatExtractedData(data: Record<string, unknown>): string {
  const parts: string[] = []
  
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue
    
    const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    
    if (Array.isArray(value)) {
      parts.push(`${formattedKey}: ${value.join(', ')}`)
    } else if (typeof value === 'object') {
      parts.push(`${formattedKey}: ${JSON.stringify(value)}`)
    } else {
      parts.push(`${formattedKey}: ${value}`)
    }
  }
  
  return parts.join('\n')
}

/**
 * Generate suggested queries based on context
 */
export function generateSuggestedQueries(
  agent?: AgentContext,
  email?: EmailContext
): string[] {
  const suggestions: string[] = []
  
  if (email?.extracted_data) {
    const data = email.extracted_data
    
    // Technology-based suggestion
    if (data.technologies && Array.isArray(data.technologies) && data.technologies.length > 0) {
      suggestions.push(`Find similar ${data.technologies[0]} positions`)
    }
    
    // Company-based suggestion
    if (data.company) {
      suggestions.push(`Show my cover letters for ${data.company}`)
    }
    
    // Location-based suggestion
    if (data.location) {
      suggestions.push(`Find jobs in ${data.location}`)
    }
    
    // Domain-based suggestion
    if (data.domain) {
      suggestions.push(`Find other ${data.domain} positions`)
    }
  }
  
  // Fallback suggestions
  if (suggestions.length === 0) {
    suggestions.push('Find similar job postings')
    suggestions.push('Show matching positions from my knowledge base')
    suggestions.push('What have I saved recently?')
  }
  
  return suggestions.slice(0, 4)
}

