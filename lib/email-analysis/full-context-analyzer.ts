/**
 * Full Context Analyzer
 * Analyzes complete content without chunking when it fits in context window
 * Much more efficient than chunking: 1 API call vs many
 */

import OpenAI from 'openai'
import type { ScrapedPage, FullContentAnalysisResult } from './types'
import { splitTextIntoChunks } from './content-chunker'
import { analyzeChunksRecursively, aggregateResults } from './recursive-analyzer'

// Token estimation: 1 token ≈ 4 characters
const CHARS_PER_TOKEN = 4
const SAFE_TOKEN_LIMIT = 30000 // Conservative limit, leaves room for prompts + response
const SAFE_CHAR_LIMIT = SAFE_TOKEN_LIMIT * CHARS_PER_TOKEN // 120,000 characters

/**
 * Determines if content needs to be chunked
 * @param content - Text content to analyze
 * @returns true if content exceeds safe limits
 */
export function needsChunking(content: string): boolean {
  return content.length > SAFE_CHAR_LIMIT
}

/**
 * Analyzes full email body in a single AI call
 * Much more efficient than chunking for typical emails
 * 
 * @param emailText - Plain text email content
 * @param emailSubject - Email subject line
 * @param agentConfig - Agent configuration with criteria and fields
 * @param ragContext - Optional RAG context from knowledge bases
 * @returns Analysis result with extracted data
 */
export async function analyzeFullEmail(
  emailText: string,
  emailSubject: string,
  agentConfig: {
    match_criteria: string
    extraction_fields: string
    user_intent?: string
    extraction_examples?: string
    analysis_feedback?: string
  },
  ragContext?: string
): Promise<FullContentAnalysisResult> {
  
  // Check if we need to fall back to chunking
  if (needsChunking(emailText)) {
    console.log('⚠️  Email exceeds safe limit, falling back to chunking')
    return await analyzeWithChunking(emailText, 'Email', 'email', agentConfig, ragContext)
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })

  // Build comprehensive prompt for full email analysis
  const prompt = buildFullContentPrompt(
    emailText,
    'Email body',
    emailSubject,
    agentConfig.match_criteria,
    agentConfig.extraction_fields,
    agentConfig.user_intent,
    agentConfig.extraction_examples,
    agentConfig.analysis_feedback,
    ragContext
  )

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert data extraction assistant. Your task is to analyze content and extract specific information based on the user's criteria.

Key principles:
1. Be THOROUGH - scan the entire content for relevant information
2. Be ACCURATE - only extract data that's actually present
3. Be STRUCTURED - follow the user's desired output format exactly
4. Be SPECIFIC - extract concrete values, not descriptions
5. REASON CLEARLY - explain why you matched or didn't match

Return a JSON object with:
- matched: boolean (does this content match the user's criteria?)
- extractedData: object (structured data matching extraction_fields)
- reasoning: string (clear explanation of your decision)
- confidence: number (0-1, how confident are you?)`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1, // Low temperature for consistency
      response_format: { type: 'json_object' }
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')

    return {
      source: 'Email',
      sourceType: 'email',
      matched: result.matched || false,
      extractedData: result.extractedData || {},
      reasoning: result.reasoning || 'No reasoning provided',
      confidence: result.confidence || 0,
      contentLength: emailText.length,
      usedChunking: false
    }
  } catch (error) {
    console.error('❌ Error analyzing full email:', error)
    throw error
  }
}

/**
 * Analyzes a single scraped page in one AI call
 * 
 * @param page - Scraped page with URL and markdown content
 * @param agentConfig - Agent configuration
 * @param ragContext - Optional RAG context
 * @returns Analysis result
 */
export async function analyzeScrapedPage(
  page: ScrapedPage,
  agentConfig: {
    match_criteria: string
    extraction_fields: string
    user_intent?: string
    extraction_examples?: string
    analysis_feedback?: string
  },
  ragContext?: string
): Promise<FullContentAnalysisResult> {
  
  // Check if we need to fall back to chunking
  if (needsChunking(page.markdown)) {
    console.log(`⚠️  Page ${page.url} exceeds safe limit, falling back to chunking`)
    return await analyzeWithChunking(page.markdown, page.url, 'scraped', agentConfig, ragContext)
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })

  // Build prompt for scraped page
  const prompt = buildFullContentPrompt(
    page.markdown,
    `Scraped webpage: ${page.url}`,
    page.title || 'No title',
    agentConfig.match_criteria,
    agentConfig.extraction_fields,
    agentConfig.user_intent,
    agentConfig.extraction_examples,
    agentConfig.analysis_feedback,
    ragContext
  )

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert data extraction assistant. Your task is to analyze content and extract specific information based on the user's criteria.

Key principles:
1. Be THOROUGH - scan the entire content for relevant information
2. Be ACCURATE - only extract data that's actually present
3. Be STRUCTURED - follow the user's desired output format exactly
4. Be SPECIFIC - extract concrete values, not descriptions
5. REASON CLEARLY - explain why you matched or didn't match

Return a JSON object with:
- matched: boolean (does this content match the user's criteria?)
- extractedData: object (structured data matching extraction_fields)
- reasoning: string (clear explanation of your decision)
- confidence: number (0-1, how confident are you?)`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')

    return {
      source: page.url,
      sourceType: 'scraped',
      matched: result.matched || false,
      extractedData: result.extractedData || {},
      reasoning: result.reasoning || 'No reasoning provided',
      confidence: result.confidence || 0,
      contentLength: page.markdown.length,
      usedChunking: false
    }
  } catch (error) {
    console.error(`❌ Error analyzing page ${page.url}:`, error)
    throw error
  }
}

/**
 * Fallback: Analyze with chunking for large content
 * Uses existing recursive analyzer
 */
async function analyzeWithChunking(
  content: string,
  source: string,
  sourceType: 'email' | 'scraped',
  agentConfig: {
    match_criteria: string
    extraction_fields: string
    user_intent?: string
    extraction_examples?: string
    analysis_feedback?: string
  },
  ragContext?: string
): Promise<FullContentAnalysisResult> {
  
  // Split into chunks
  const textChunks = splitTextIntoChunks(content)
  const chunks = textChunks.map((text, index) => ({
    type: sourceType,
    content: text,
    source: source,
    index,
    charCount: text.length
  }))

  // Analyze chunks recursively
  const chunkResults = await analyzeChunksRecursively(
    chunks,
    agentConfig.match_criteria,
    agentConfig.extraction_fields,
    ragContext,
    agentConfig.user_intent,
    agentConfig.extraction_examples,
    agentConfig.analysis_feedback
  )

  // Aggregate results
  const aggregated = aggregateResults(chunkResults)

  return {
    source,
    sourceType,
    matched: aggregated.matched,
    extractedData: aggregated.aggregatedData,
    reasoning: `Analyzed in ${chunks.length} chunks. ${aggregated.totalMatches} chunks matched.`,
    confidence: aggregated.overallConfidence,
    contentLength: content.length,
    usedChunking: true
  }
}

/**
 * Builds a comprehensive prompt for full-context analysis
 * Following GPT-4.1 best practices
 */
function buildFullContentPrompt(
  content: string,
  sourceDescription: string,
  title: string,
  matchCriteria: string,
  extractionFields: string,
  userIntent?: string,
  extractionExamples?: string,
  analysisFeedback?: string,
  ragContext?: string
): string {
  
  return `You are analyzing content to extract specific information based on user-defined criteria.

## Content to Analyze

**Source**: ${sourceDescription}
**Title**: ${title}
**Length**: ${content.length} characters

**Content**:
${content}

---

## User's Requirements

**What the user is interested in**:
${matchCriteria}

${userIntent ? `
**User's Intent/Context** (WHY they need this data):
${userIntent}
` : ''}

**What to extract** (if content matches the goal):
${extractionFields}

---

${extractionExamples ? `
## Expected Output Examples

The user has provided these examples of desired extraction format:

${extractionExamples}

**IMPORTANT**: Your output should match this format and level of detail.
- If examples show arrays (e.g., ["C#", "Python"]), extract arrays
- If examples show objects (e.g., {"sector": "Fintech"}), extract objects
- If examples show specific value types (numbers, dates, strings), use those types
- Match the structure, naming, and specificity shown in these examples

---
` : ''}

${ragContext ? `
## Reference Context (from Knowledge Base)

Similar successful extractions from past analyses:

${ragContext}

These show:
- What format and structure to use for extracted fields
- What level of detail is expected
- How similar data has been extracted before

Use these as guidance, but adapt to the current content.

---
` : ''}

${analysisFeedback ? `
## CRITICAL: Learn from Past Mistakes

The user has noted these issues with previous analyses:

${analysisFeedback}

This is MANDATORY feedback you MUST incorporate:
- If feedback says "always extracts X when I don't want it", be VERY conservative about extracting X
- If feedback says "misses Y", actively look for Y
- If feedback mentions confusion between similar concepts, pay extra attention to disambiguation

NEVER repeat these mistakes. Treat this feedback as hard constraints.

---
` : ''}

## Your Task

1. **READ** the entire content carefully
2. **EVALUATE** if it matches the user's criteria
3. **EXTRACT** all relevant data in the specified format
4. **REASON** clearly about your decision

## Output Format

Return a JSON object with these fields:

{
  "matched": boolean,  // Does this content match the user's criteria?
  "extractedData": {   // Structured data matching extraction_fields
    // Use the field names from extraction_fields
    // Follow the format shown in examples (if provided)
    // Extract ALL relevant information, not just one item
  },
  "reasoning": "Clear explanation of your decision and what you found",
  "confidence": 0.85  // Number between 0-1
}

## Critical Instructions

1. **Be COMPREHENSIVE**: Don't just extract the first match - scan the ENTIRE content for ALL relevant data
2. **Be ACCURATE**: Only extract information that's explicitly present
3. **Match the FORMAT**: Follow extraction_examples format exactly
4. **Apply FEEDBACK**: Avoid mistakes mentioned in analysis_feedback
5. **Be SPECIFIC**: Extract concrete values (e.g., "Java, Python" not "programming languages")

## Step-by-Step Reasoning

Before responding, think through:
1. ✅ Does this content match the user's interests? (Check match_criteria)
2. ✅ What specific information can I extract? (Check extraction_fields)
3. ✅ Am I following the expected format? (Check extraction_examples)
4. ✅ Am I avoiding past mistakes? (Check analysis_feedback)
5. ✅ Have I scanned the ENTIRE content thoroughly?

Now analyze the content and return your JSON response.`
}

