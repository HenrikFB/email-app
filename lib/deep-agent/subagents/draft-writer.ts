/**
 * Draft Writer Sub-Agent
 * 
 * Specialized sub-agent for generating and refining drafts.
 */

import { SYSTEM_PROMPTS, MODEL_CONFIG } from '../config'
import { draftGeneratorTools } from '../tools/draft-generator'
import type { SubAgentConfig } from '../types'

/**
 * Draft Writer Sub-Agent Configuration
 * 
 * Responsibilities:
 * - Generate drafts based on user instructions
 * - Incorporate KB content as style reference
 * - Self-critique and refine drafts
 * - Personalize content based on extracted data
 */
export const draftWriterSubAgent: SubAgentConfig & { tools: typeof draftGeneratorTools } = {
  name: 'draft-writer',
  description: `Generates and refines drafts (cover letters, summaries, responses, etc.) based on user instructions.
Use when you need to:
- Generate a cover letter or application response
- Create a summary of opportunities
- Draft a professional response
- Create any user-requested content

The sub-agent will use KB content as style reference and self-critique to improve quality.`,
  
  systemPrompt: SYSTEM_PROMPTS.draftWriter,
  
  model: MODEL_CONFIG.draftWriter,
  
  tools: draftGeneratorTools,
}

/**
 * Create draft generation task description
 */
export function createDraftTask(params: {
  instructions: string
  extractedData: Record<string, unknown>
  kbContent: Array<{
    documentId: string
    documentTitle: string
    content: string
  }>
  webResearch?: string
  emailContext?: string
}): string {
  return `Generate a draft based on the following:

USER'S INSTRUCTIONS:
${params.instructions}

EXTRACTED DATA (incorporate this information):
${JSON.stringify(params.extractedData, null, 2)}

KB CONTENT (use as style reference and source of examples):
${params.kbContent.length > 0 
  ? params.kbContent.map((doc, i) => `\n[${i + 1}. ${doc.documentTitle}]\n${doc.content}`).join('\n---\n')
  : 'No KB content provided - generate based on extracted data'}

${params.webResearch ? `\nWEB RESEARCH FINDINGS:\n${params.webResearch}` : ''}
${params.emailContext ? `\nORIGINAL EMAIL CONTEXT:\n${params.emailContext}` : ''}

TASKS:
1. Use generate_draft_with_critique to create the draft with automatic refinement
2. The tool will:
   - Generate an initial draft
   - Self-critique against requirements
   - Refine if needed (up to 2 iterations)
3. Ensure the draft:
   - Follows user instructions precisely
   - Incorporates relevant KB content
   - Addresses key requirements from extracted data
   - Maintains appropriate tone

Return:
- The final draft content
- Sources used from KB
- Brief summary of the generation process`
}

/**
 * Create simple draft task (without self-critique)
 */
export function createSimpleDraftTask(params: {
  instructions: string
  extractedData: Record<string, unknown>
  kbContent: Array<{
    documentId: string
    documentTitle: string
    content: string
  }>
}): string {
  return `Generate a quick draft based on:

Instructions: ${params.instructions}
Data: ${JSON.stringify(params.extractedData, null, 2)}
KB Content: ${params.kbContent.length} document(s) available

Use generate_draft (without critique) for a single-pass generation.
Return the draft content.`
}

