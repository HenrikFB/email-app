/**
 * Draft Generator Tools
 * 
 * Tools for generating and refining drafts based on user instructions.
 */

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import OpenAI from 'openai'
import { MODEL_CONFIG, TEMPERATURE_CONFIG, LIMITS } from '../config'
import type { GeneratedDraft, DraftCritique, DraftMetadata } from '../types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// ============================================
// Generate Draft Tool
// ============================================

const generateDraftSchema = z.object({
  instructions: z.string().describe('User instructions for what to draft'),
  extractedData: z.record(z.string(), z.unknown()).describe('Extracted data from email analysis'),
  kbContent: z.array(z.object({
    documentTitle: z.string(),
    content: z.string(),
    documentId: z.string(),
  })).describe('Relevant content from knowledge base'),
  webResearch: z.string().optional().describe('Summary of web research findings'),
  emailContext: z.string().optional().describe('Original email context'),
})

/**
 * Generate a draft based on user instructions and context
 */
export const generateDraftTool = tool(
  async ({ instructions, extractedData, kbContent, webResearch, emailContext }): Promise<string> => {
    const startTime = Date.now()
    
    try {
      // Build context from KB content
      const kbContext = kbContent.map((doc, i) => 
        `[Document ${i + 1}: ${doc.documentTitle}]\n${doc.content}`
      ).join('\n\n---\n\n')

      const systemPrompt = `You are an expert writer helping the user create professional content. 

USER'S INSTRUCTIONS:
${instructions}

KNOWLEDGE BASE CONTEXT (use this as style reference and source of examples):
${kbContext || 'No KB content provided'}

${webResearch ? `WEB RESEARCH FINDINGS:\n${webResearch}\n` : ''}

${emailContext ? `ORIGINAL EMAIL CONTEXT:\n${emailContext}\n` : ''}

EXTRACTED DATA (key information to incorporate):
${JSON.stringify(extractedData, null, 2)}

GUIDELINES:
1. Follow the user's instructions precisely
2. Use the KB content as a style and tone reference
3. Incorporate specific examples from KB that match the requirements
4. Personalize based on the extracted data
5. Keep the content professional and authentic
6. Do NOT copy KB content verbatim - adapt and personalize it

OUTPUT:
Write the draft directly. Do not include meta-commentary like "Here is the draft" - just output the content.`

      const response = await openai.chat.completions.create({
        model: MODEL_CONFIG.draftWriter,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate the draft based on the provided context and instructions.' },
        ],
        temperature: TEMPERATURE_CONFIG.draft,
        max_tokens: 2000,
      })

      const draftContent = response.choices[0]?.message?.content
      if (!draftContent) {
        throw new Error('Empty response from LLM')
      }

      // Track which KB documents were used
      const sourcesUsed = kbContent.map(doc => ({
        documentId: doc.documentId,
        documentTitle: doc.documentTitle,
        snippetUsed: doc.content.substring(0, 200) + '...',
      }))

      const processingTime = Date.now() - startTime

      return JSON.stringify({
        success: true,
        draft: {
          content: draftContent,
          kbSourcesUsed: sourcesUsed,
          metadata: {
            reasoning: 'Generated based on user instructions and KB context',
            iterations: 1,
            searchQueries: [],
            confidence: 0.8,
            modelUsed: MODEL_CONFIG.draftWriter,
            processingTimeMs: processingTime,
            webSourcesSearched: [],
          },
        },
      })
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Draft generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  },
  {
    name: 'generate_draft',
    description: 'Generate a draft (cover letter, summary, response, etc.) based on user instructions and KB content',
    schema: generateDraftSchema,
  }
)

// ============================================
// Critique Draft Tool
// ============================================

const critiqueDraftSchema = z.object({
  draft: z.string().describe('The draft to critique'),
  instructions: z.string().describe('Original user instructions'),
  extractedData: z.record(z.string(), z.unknown()).describe('Extracted data that should be addressed'),
})

/**
 * Critique a draft and suggest improvements
 */
export const critiqueDraftTool = tool(
  async ({ draft, instructions, extractedData }): Promise<string> => {
    try {
      const systemPrompt = `You are a critical editor reviewing a draft. Evaluate it against the original instructions and requirements.

ORIGINAL INSTRUCTIONS:
${instructions}

REQUIREMENTS FROM EXTRACTED DATA:
${JSON.stringify(extractedData, null, 2)}

DRAFT TO REVIEW:
${draft}

EVALUATION CRITERIA:
1. Does the draft follow the instructions?
2. Are all key requirements from the extracted data addressed?
3. Is the tone appropriate?
4. Is the length appropriate?
5. Is the content specific and personalized (not generic)?
6. Are there any factual errors or inconsistencies?

OUTPUT FORMAT (JSON):
{
  "isAcceptable": true/false,
  "score": 0.0-1.0,
  "issues": ["Issue 1", "Issue 2"],
  "suggestions": ["Suggestion 1", "Suggestion 2"],
  "shouldRefine": true/false,
  "reasoning": "Explanation of the evaluation"
}`

      const response = await openai.chat.completions.create({
        model: MODEL_CONFIG.draftWriter,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Critique this draft.' },
        ],
        response_format: { type: 'json_object' },
        temperature: TEMPERATURE_CONFIG.extraction,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('Empty response from LLM')
      }

      const critique = JSON.parse(content) as DraftCritique & { reasoning: string }

      return JSON.stringify({
        success: true,
        critique: {
          isAcceptable: critique.isAcceptable,
          score: critique.score,
          issues: critique.issues || [],
          suggestions: critique.suggestions || [],
          shouldRefine: critique.shouldRefine,
        },
        reasoning: critique.reasoning,
      })
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Critique failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  },
  {
    name: 'critique_draft',
    description: 'Critique a draft and identify issues and improvements needed',
    schema: critiqueDraftSchema,
  }
)

// ============================================
// Refine Draft Tool
// ============================================

const refineDraftSchema = z.object({
  draft: z.string().describe('The draft to refine'),
  critique: z.object({
    issues: z.array(z.string()),
    suggestions: z.array(z.string()),
  }).describe('Critique feedback'),
  instructions: z.string().describe('Original user instructions'),
  kbContent: z.array(z.object({
    documentTitle: z.string(),
    content: z.string(),
    documentId: z.string(),
  })).optional().describe('Additional KB content if needed'),
})

/**
 * Refine a draft based on critique feedback
 */
export const refineDraftTool = tool(
  async ({ draft, critique, instructions, kbContent }): Promise<string> => {
    const startTime = Date.now()
    
    try {
      const kbContext = kbContent?.map((doc, i) => 
        `[Document ${i + 1}: ${doc.documentTitle}]\n${doc.content}`
      ).join('\n\n---\n\n') || ''

      const systemPrompt = `You are refining a draft based on feedback. 

ORIGINAL INSTRUCTIONS:
${instructions}

CURRENT DRAFT:
${draft}

ISSUES TO FIX:
${critique.issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

SUGGESTIONS TO INCORPORATE:
${critique.suggestions.map((sug, i) => `${i + 1}. ${sug}`).join('\n')}

${kbContext ? `ADDITIONAL KB CONTENT FOR REFERENCE:\n${kbContext}\n` : ''}

TASK:
Rewrite the draft addressing all issues and incorporating suggestions.
Maintain the same overall structure but improve where needed.
Output only the refined draft - no meta-commentary.`

      const response = await openai.chat.completions.create({
        model: MODEL_CONFIG.draftWriter,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Refine the draft.' },
        ],
        temperature: TEMPERATURE_CONFIG.draft,
        max_tokens: 2000,
      })

      const refinedContent = response.choices[0]?.message?.content
      if (!refinedContent) {
        throw new Error('Empty response from LLM')
      }

      const processingTime = Date.now() - startTime

      return JSON.stringify({
        success: true,
        refinedDraft: refinedContent,
        processingTimeMs: processingTime,
        issuesAddressed: critique.issues.length,
        suggestionsIncorporated: critique.suggestions.length,
      })
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Draft refinement failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  },
  {
    name: 'refine_draft',
    description: 'Refine a draft based on critique feedback',
    schema: refineDraftSchema,
  }
)

// ============================================
// Generate with Self-Critique Tool
// ============================================

const generateWithCritiqueSchema = z.object({
  instructions: z.string().describe('User instructions for what to draft'),
  extractedData: z.record(z.string(), z.unknown()).describe('Extracted data from email analysis'),
  kbContent: z.array(z.object({
    documentTitle: z.string(),
    content: z.string(),
    documentId: z.string(),
  })).describe('Relevant content from knowledge base'),
  webResearch: z.string().optional().describe('Summary of web research findings'),
  emailContext: z.string().optional().describe('Original email context'),
  maxIterations: z.number().optional().default(2).describe('Maximum refinement iterations'),
})

/**
 * Generate a draft with automatic self-critique and refinement
 */
export const generateWithCritiqueTool = tool(
  async ({ instructions, extractedData, kbContent, webResearch, emailContext, maxIterations }): Promise<string> => {
    const startTime = Date.now()
    const iterations: Array<{ draft: string; critique?: any }> = []
    
    try {
      // Initial generation
      const kbContext = kbContent.map((doc, i) => 
        `[Document ${i + 1}: ${doc.documentTitle}]\n${doc.content}`
      ).join('\n\n---\n\n')

      let currentDraft = ''
      
      // Generate initial draft
      const generatePrompt = `You are an expert writer. Generate content based on these instructions.

USER'S INSTRUCTIONS:
${instructions}

KNOWLEDGE BASE CONTEXT:
${kbContext || 'No KB content provided'}

${webResearch ? `WEB RESEARCH:\n${webResearch}\n` : ''}
${emailContext ? `EMAIL CONTEXT:\n${emailContext}\n` : ''}

EXTRACTED DATA:
${JSON.stringify(extractedData, null, 2)}

Write the draft directly without meta-commentary.`

      const initialResponse = await openai.chat.completions.create({
        model: MODEL_CONFIG.draftWriter,
        messages: [
          { role: 'system', content: generatePrompt },
          { role: 'user', content: 'Generate the draft.' },
        ],
        temperature: TEMPERATURE_CONFIG.draft,
        max_tokens: 2000,
      })

      currentDraft = initialResponse.choices[0]?.message?.content || ''
      iterations.push({ draft: currentDraft })

      // Self-critique and refine loop
      const maxIter = Math.min(maxIterations || 2, LIMITS.maxDraftIterations)
      
      for (let i = 0; i < maxIter; i++) {
        // Critique
        const critiquePrompt = `Evaluate this draft against the requirements.

INSTRUCTIONS: ${instructions}
REQUIREMENTS: ${JSON.stringify(extractedData, null, 2)}
DRAFT: ${currentDraft}

OUTPUT JSON: { "isAcceptable": bool, "score": 0-1, "issues": [], "suggestions": [], "shouldRefine": bool }`

        const critiqueResponse = await openai.chat.completions.create({
          model: MODEL_CONFIG.draftWriter,
          messages: [
            { role: 'system', content: critiquePrompt },
            { role: 'user', content: 'Critique.' },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        })

        const critique = JSON.parse(critiqueResponse.choices[0]?.message?.content || '{}')
        iterations[iterations.length - 1].critique = critique

        // Check if acceptable
        if (critique.isAcceptable && critique.score >= 0.8) {
          break
        }

        if (!critique.shouldRefine || critique.issues?.length === 0) {
          break
        }

        // Refine
        const refinePrompt = `Refine this draft addressing these issues:
${critique.issues?.join('\n') || 'Minor improvements needed'}

DRAFT: ${currentDraft}

Output only the refined draft.`

        const refineResponse = await openai.chat.completions.create({
          model: MODEL_CONFIG.draftWriter,
          messages: [
            { role: 'system', content: refinePrompt },
            { role: 'user', content: 'Refine.' },
          ],
          temperature: TEMPERATURE_CONFIG.draft,
          max_tokens: 2000,
        })

        currentDraft = refineResponse.choices[0]?.message?.content || currentDraft
        iterations.push({ draft: currentDraft })
      }

      const processingTime = Date.now() - startTime
      const finalCritique = iterations[iterations.length - 1].critique

      return JSON.stringify({
        success: true,
        draft: {
          content: currentDraft,
          kbSourcesUsed: kbContent.map(doc => ({
            documentId: doc.documentId,
            documentTitle: doc.documentTitle,
            snippetUsed: doc.content.substring(0, 200) + '...',
          })),
          metadata: {
            reasoning: `Generated and refined through ${iterations.length} iteration(s)`,
            iterations: iterations.length,
            searchQueries: [],
            confidence: finalCritique?.score || 0.8,
            modelUsed: MODEL_CONFIG.draftWriter,
            processingTimeMs: processingTime,
            webSourcesSearched: [],
          },
        },
        iterationHistory: iterations.map((iter, i) => ({
          iteration: i + 1,
          draftLength: iter.draft.length,
          critiqueScore: iter.critique?.score,
          issues: iter.critique?.issues?.length || 0,
        })),
      })
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Draft generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  },
  {
    name: 'generate_draft_with_critique',
    description: 'Generate a draft with automatic self-critique and iterative refinement',
    schema: generateWithCritiqueSchema,
  }
)

// ============================================
// Export all draft tools
// ============================================

export const draftGeneratorTools = [
  generateDraftTool,
  critiqueDraftTool,
  refineDraftTool,
  generateWithCritiqueTool,
]

