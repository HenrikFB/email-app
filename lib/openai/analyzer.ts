/**
 * OpenAI-powered email analysis
 * Fully generic - no hardcoded fields or job-specific logic
 */

import OpenAI from 'openai'
import type { AnalysisInput, AnalysisResult } from '../email-analysis/types'

/**
 * Analyzes email content using OpenAI
 * Uses user-defined match criteria and extraction fields
 * 
 * @param input - Email content and user-defined criteria
 * @returns Analysis result with matched status and extracted data
 */
export async function analyzeEmailContent(
  input: AnalysisInput
): Promise<AnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set in environment variables')
  }

  const openai = new OpenAI({ apiKey })

  // Build the prompt
  const prompt = buildAnalysisPrompt(input)

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Cost-effective and fast
      messages: [
        {
          role: 'system',
          content: 'You are an email analysis assistant that extracts structured information based on user-defined criteria. Always return valid JSON with the requested structure.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower for more consistent extraction
    })

    const content = response.choices[0]?.message?.content

    if (!content) {
      throw new Error('No response from OpenAI')
    }

    const result = JSON.parse(content)

    // Validate the response has required fields
    if (typeof result.matched !== 'boolean') {
      result.matched = false
    }
    if (!result.extractedData) {
      result.extractedData = {}
    }
    if (!result.reasoning) {
      result.reasoning = 'Analysis completed'
    }
    if (typeof result.confidence !== 'number') {
      result.confidence = 0.5
    }

    return result as AnalysisResult
  } catch (error) {
    console.error('OpenAI analysis error:', error)
    throw new Error(
      `Failed to analyze email: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Truncates text to max length, adding a note if truncated
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }
  return text.substring(0, maxLength) + `\n\n[... Content truncated. Original length: ${text.length} chars, showing first ${maxLength} chars ...]`
}

/**
 * Builds the analysis prompt with user-defined criteria
 * Fully generic - no hardcoded fields
 * Intelligently truncates content to stay within token limits
 */
function buildAnalysisPrompt(input: AnalysisInput): string {
  const MAX_EMAIL_LENGTH = 80000 // ~20k tokens
  const MAX_SCRAPED_PAGE_LENGTH = 15000 // ~3.75k tokens per page
  
  let content = `# Email Analysis Request

## Email Information
- Subject: ${input.emailSubject}
- From: ${input.emailFrom}`

  if (input.emailDate) {
    content += `\n- Date: ${input.emailDate}`
  }

  // Truncate email HTML if too long
  const emailTruncated = input.emailHtml.length > MAX_EMAIL_LENGTH
  const truncatedEmail = truncateText(input.emailHtml, MAX_EMAIL_LENGTH)
  if (emailTruncated) {
    console.log(`⚠️  Email truncated: ${input.emailHtml.length} → ${MAX_EMAIL_LENGTH} chars`)
  }
  content += `\n\n## Email Content\n${truncatedEmail}`

  // Add scraped content if available (truncate each page)
  if (input.scrapedContent && input.scrapedContent.length > 0) {
    content += `\n\n## Scraped Web Pages\n`
    input.scrapedContent.forEach((page, idx) => {
      content += `\n### Page ${idx + 1}: ${page.title || page.url}\n`
      content += `URL: ${page.url}\n\n`
      const pageTruncated = page.markdown.length > MAX_SCRAPED_PAGE_LENGTH
      if (pageTruncated) {
        console.log(`⚠️  Page ${idx + 1} truncated: ${page.markdown.length} → ${MAX_SCRAPED_PAGE_LENGTH} chars`)
      }
      const truncatedMarkdown = truncateText(page.markdown, MAX_SCRAPED_PAGE_LENGTH)
      content += `${truncatedMarkdown}\n`
    })
  }

  // Add user-defined criteria
  content += `\n\n---

## Analysis Instructions

### STEP 1: Check if the email matches the user's interest criteria

**User's Match Criteria (what they are interested in):**
${input.matchCriteria}

Determine if this email matches the criteria above. Consider both the email content and any scraped pages.

### STEP 2: If matched, extract the requested information

**User's Extraction Fields (what to extract if matched):**
${input.extractionFields}

Extract the requested information from the email and/or scraped pages. Be thorough and accurate.

---

## Response Format

Return a JSON object with the following structure:

\`\`\`json
{
  "matched": boolean,  // true if the email matches the user's criteria, false otherwise
  "extractedData": {
    // Create fields based on the user's extraction fields request above
    // The structure should match what the user asked to extract
    // Example: if they asked for "deadline, technologies", provide those fields
  },
  "reasoning": string,  // Brief explanation of why it matched (or didn't) and what you extracted
  "confidence": number  // 0-1 score indicating your confidence in the match and extraction
}
\`\`\`

**Important:**
- If "matched" is false, you can leave "extractedData" as an empty object
- If the user asked to extract specific fields but they're not found, set them to null or omit them
- Be flexible with field names based on what the user requested
- The "reasoning" should explain your decision-making process`

  return content
}

