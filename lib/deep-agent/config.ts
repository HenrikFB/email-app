/**
 * Deep Agent Configuration
 * 
 * GENERIC system prompts and configurations.
 * All user-specific settings come from agent_configurations table.
 * 
 * Key fields from agent_configurations used:
 * - match_criteria: What to look for in emails
 * - extraction_fields: What data to extract
 * - user_intent: User's goal/purpose
 * - draft_instructions: What to draft (if enabled)
 */

// ============================================
// Model Configuration
// ============================================

export const MODEL_CONFIG = {
  /** Main orchestrator model */
  orchestrator: 'gpt-4o',
  /** Email analysis model (fast, accurate extraction) */
  emailAnalyzer: 'gpt-4o-mini',
  /** Web research model */
  webResearcher: 'gpt-4o-mini',
  /** KB research model (needs good reasoning) */
  kbResearcher: 'gpt-4o-mini',
  /** Draft writer model (needs creativity + quality) */
  draftWriter: 'gpt-4o',
} as const

export const TEMPERATURE_CONFIG = {
  /** Low temperature for extraction tasks */
  extraction: 0.1,
  /** Medium temperature for search query generation */
  search: 0.3,
  /** Higher temperature for creative draft generation */
  draft: 0.7,
} as const

// ============================================
// System Prompts (GENERIC - use {{placeholders}})
// ============================================

export const SYSTEM_PROMPTS = {
  /**
   * Main orchestrator prompt
   * Placeholders: {{match_criteria}}, {{extraction_fields}}, {{user_intent}}, {{draft_enabled}}, {{draft_instructions}}
   */
  orchestrator: `You are an intelligent email analysis orchestrator. Your job is to coordinate specialized sub-agents to analyze emails based on USER-DEFINED criteria.

USER'S CONFIGURATION:
- Match Criteria: {{match_criteria}}
- Fields to Extract: {{extraction_fields}}
- User's Intent: {{user_intent}}
- Draft Generation: {{draft_enabled}}
{{draft_instructions}}

WORKFLOW:
1. Delegate email analysis to the email-analyzer sub-agent
2. If the email matches the user's criteria, delegate web research to find relevant public sources
3. Search the user's knowledge base for content matching the extracted data
4. If draft generation is enabled, delegate to the draft-writer sub-agent

IMPORTANT:
- Use the task() tool to delegate work to sub-agents
- Keep your context clean by letting sub-agents handle detailed work
- Return concise summaries from each phase
- Always respect the user's match_criteria and extraction_fields

Return a final summary with:
- Match decision (yes/no) with confidence
- Extracted data (matching the user's extraction_fields)
- Sources found (web + KB)
- Generated draft (if applicable)`,

  /**
   * Email analyzer sub-agent prompt
   * Placeholders: {{match_criteria}}, {{extraction_fields}}, {{user_intent}}
   */
  emailAnalyzer: `You are an expert email analyzer. Your job is to analyze emails based on USER-DEFINED criteria.

USER'S CONFIGURATION:
- Match Criteria: {{match_criteria}}
- Fields to Extract: {{extraction_fields}}
- User's Intent: {{user_intent}}

YOUR TASKS:
1. Parse and understand the email content
2. Determine if the email matches the user's MATCH CRITERIA
3. Extract data according to the user's EXTRACTION FIELDS
4. Extract relevant entities for further research

EXTRACTION GUIDELINES:
- Extract ONLY what the user requested in extraction_fields
- Be thorough but precise
- If extraction_fields mentions specific items (technologies, companies, dates, etc.), extract those
- Identify any entities that could be used for web/KB searches

OUTPUT FORMAT (JSON):
{
  "matched": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "Why this does/doesn't match the user's criteria",
  "extractedData": {
    // Fields based on user's extraction_fields
  },
  "entities": {
    "searchable": ["terms", "to", "search", "for"]
  },
  "searchTerms": ["key", "terms", "for", "research"]
}`,

  /**
   * Web researcher sub-agent prompt
   * Placeholders: {{user_intent}}, {{match_criteria}}
   */
  webResearcher: `You are a web researcher. Your job is to find relevant public information based on user needs.

USER'S CONTEXT:
- Intent: {{user_intent}}
- Looking for: {{match_criteria}}

YOUR TASKS:
1. Search for public information about entities extracted from emails
2. Find relevant websites, pages, or content
3. Return concise summaries of what you find

SEARCH STRATEGY:
- Start with specific queries based on extracted entities
- If initial search fails, try broader queries
- Focus on authoritative sources
- Avoid paywalled or login-required content

IMPORTANT:
- Do NOT include full page content in your response
- Summarize key findings in 2-3 sentences per source
- Return only the most relevant URLs (max 5)
- Note if content requires authentication

OUTPUT FORMAT:
Return a summary with:
- Key findings (bullet points)
- Relevant URLs with brief descriptions
- Any important information discovered`,

  /**
   * KB researcher sub-agent prompt
   * Placeholders: {{user_intent}}, {{extraction_fields}}
   */
  kbResearcher: `You are a knowledge base researcher. Your job is to find relevant content from the user's personal knowledge base.

USER'S CONTEXT:
- Intent: {{user_intent}}
- Extraction Fields: {{extraction_fields}}

The KB may contain:
- Previous documents, notes, or saved content
- Past emails or correspondence
- Professional materials
- Any content the user has stored

SEARCH STRATEGY:
1. Generate MULTIPLE targeted search queries based on the extracted data
2. Search for EACH major item separately (not combined)
3. Search for relevant context based on user_intent
4. Maximum 5-8 search queries per run

ITERATIVE SEARCH:
- Start with the most important items from extracted data
- If initial searches return few results, try alternative phrasings
- Track what was found vs. what's missing

OUTPUT FORMAT:
Return:
- Queries executed with reasoning
- Results found (document titles + relevant snippets)
- Coverage analysis (what was found vs. what's missing)
- Suggestions for using the content`,

  /**
   * Draft writer sub-agent prompt
   * Placeholders: {{draft_instructions}}, {{user_intent}}
   */
  draftWriter: `You are an expert draft writer. Your job is to generate content based on USER-DEFINED instructions.

USER'S INSTRUCTIONS:
{{draft_instructions}}

USER'S INTENT:
{{user_intent}}

YOUR TASKS:
1. Follow the user's draft instructions PRECISELY
2. Use KB content as reference for style and examples
3. Personalize based on the extracted data
4. Match the tone and format requested

WRITING GUIDELINES:
- The user's instructions are PRIMARY - follow them exactly
- Use KB content to inform style and provide examples
- Be concise but comprehensive
- If the user specifies length limits, respect them

SELF-CRITIQUE:
After generating a draft:
1. Does it follow the user's instructions?
2. Is KB content properly incorporated?
3. Is the format/length correct?

If the draft doesn't meet the user's requirements, refine it before returning.

OUTPUT FORMAT:
Return:
- The full draft text
- Sources used (which KB documents)
- Brief explanation of approach taken`,
} as const

// ============================================
// Tool Descriptions (Generic)
// ============================================

export const TOOL_DESCRIPTIONS = {
  parseEmailContent: 'Parse email to extract plain text, subject, sender, and date',
  extractEntities: 'Extract entities and structured data from text based on user-defined fields',
  tavilySearch: 'Search the web using Tavily for public information',
  searchKnowledgeBase: 'Search the user\'s knowledge base using hybrid (semantic + keyword) search',
  generateDraft: 'Generate a draft based on user instructions and KB content',
  refineDraft: 'Refine and improve an existing draft based on critique',
} as const

// ============================================
// Constants
// ============================================

export const LIMITS = {
  /** Maximum web search queries per run */
  maxWebSearchQueries: 5,
  /** Maximum KB search queries per run */
  maxKBSearchQueries: 8,
  /** Maximum results per KB search */
  maxResultsPerKBSearch: 5,
  /** Minimum similarity score for KB results */
  minKBSimilarity: 0.25,
  /** Maximum draft iterations */
  maxDraftIterations: 3,
  /** Maximum draft length (characters) */
  maxDraftLength: 5000,
} as const

// ============================================
// Few-Shot Examples for UI (Help text only)
// These are EXAMPLES to help users write their own instructions
// ============================================

export const DRAFT_INSTRUCTIONS_EXAMPLES = [
  {
    title: 'Professional Response',
    description: 'Draft a response to an incoming email',
    example: `Draft a professional response to this email.

Use content from my knowledge base as reference for tone and style.
Address the main points raised in the email.
Keep it concise - 2-3 paragraphs maximum.`,
  },
  {
    title: 'Summary',
    description: 'Create a summary of the email content',
    example: `Create a brief summary of this email.

Include:
- Key points or requests
- Important details from extracted data
- Relevant context from my KB

Keep it under 200 words.`,
  },
  {
    title: 'Analysis',
    description: 'Analyze and assess the email',
    example: `Analyze this email and provide an assessment.

Based on my match criteria and extracted data:
- Rate relevance (1-5)
- List key findings
- Note any concerns or highlights
- Suggest next steps`,
  },
  {
    title: 'Custom Template',
    description: 'Generate content using a specific template',
    example: `Generate content following this template:

[Your custom template here]

Use extracted data to fill in the details.
Reference relevant KB documents for context.
[Add any specific formatting requirements]`,
  },
]

// ============================================
// Logging Configuration
// ============================================

export const LOG_CONFIG = {
  /** Enable verbose logging */
  verbose: process.env.NODE_ENV === 'development',
  /** Log sub-agent communications */
  logSubAgents: true,
  /** Log tool calls */
  logTools: true,
} as const

// ============================================
// Prompt Builder Helper
// ============================================

/**
 * Build a prompt by replacing placeholders with user config values
 */
export function buildPrompt(
  template: string,
  config: {
    matchCriteria?: string
    extractionFields?: string
    userIntent?: string
    draftEnabled?: boolean
    draftInstructions?: string
  }
): string {
  return template
    .replace(/\{\{match_criteria\}\}/g, config.matchCriteria || 'Not specified')
    .replace(/\{\{extraction_fields\}\}/g, config.extractionFields || 'Not specified')
    .replace(/\{\{user_intent\}\}/g, config.userIntent || 'Not specified')
    .replace(/\{\{draft_enabled\}\}/g, config.draftEnabled ? 'ENABLED' : 'DISABLED')
    .replace(/\{\{draft_instructions\}\}/g, config.draftInstructions 
      ? `Draft Instructions: ${config.draftInstructions}` 
      : '')
}
