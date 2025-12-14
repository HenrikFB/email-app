/**
 * Email Analyzer Tools
 * 
 * Tools for parsing and analyzing email content.
 */

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import OpenAI from 'openai'
import { MODEL_CONFIG, TEMPERATURE_CONFIG } from '../config'
import type { ParsedEmail, EmailAnalysis, ExtractedEntities, ToolContext } from '../types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// ============================================
// Parse Email Content Tool
// ============================================

const parseEmailContentSchema = z.object({
  htmlBody: z.string().describe('The HTML body of the email'),
  subject: z.string().describe('Email subject line'),
  from: z.string().describe('Sender email address'),
  to: z.array(z.string()).describe('Recipient email addresses'),
  date: z.string().describe('Email date'),
})

/**
 * Parse email HTML to extract clean text content
 */
export const parseEmailContentTool = tool(
  async ({ htmlBody, subject, from, to, date }): Promise<string> => {
    try {
      // Simple HTML to text conversion
      const plainText = htmlBody
        // Remove script and style tags with content
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        // Remove HTML tags
        .replace(/<[^>]+>/g, ' ')
        // Decode HTML entities
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        // Clean up whitespace
        .replace(/\s+/g, ' ')
        .trim()

      const result: ParsedEmail = {
        subject,
        from,
        to,
        date,
        plainText,
        snippet: plainText.substring(0, 500),
      }

      return JSON.stringify(result)
    } catch (error) {
      return JSON.stringify({
        error: `Failed to parse email: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  },
  {
    name: 'parse_email_content',
    description: 'Parse email HTML to extract clean text content, subject, sender, and date',
    schema: parseEmailContentSchema,
  }
)

// ============================================
// Extract Entities Tool
// ============================================

const extractEntitiesSchema = z.object({
  text: z.string().describe('The text to extract entities from'),
  matchCriteria: z.string().describe('User criteria for matching emails'),
  extractionFields: z.string().describe('Fields to extract from the content'),
})

/**
 * Extract entities and structured data from text using LLM
 */
export const extractEntitiesTool = tool(
  async ({ text, matchCriteria, extractionFields }): Promise<string> => {
    try {
      const systemPrompt = `You are an expert entity extractor. Extract structured information from the given text.

USER'S MATCH CRITERIA:
${matchCriteria}

FIELDS TO EXTRACT:
${extractionFields}

TASK:
1. Extract all relevant entities (companies, technologies, locations, job titles, skills)
2. Determine if the content matches the user's criteria
3. Extract the specific fields requested
4. Generate search terms for finding related content

OUTPUT FORMAT (JSON):
{
  "entities": {
    "companies": ["Company A", "Company B"],
    "technologies": ["Python", "React", "AWS"],
    "locations": ["Copenhagen", "Denmark"],
    "jobTitles": ["Software Developer", "Backend Engineer"],
    "skills": ["API Design", "Database Management"],
    "other": {}
  },
  "matched": true,
  "confidence": 0.85,
  "reasoning": "Explanation of why this matches or doesn't match",
  "extractedData": {
    // Fields based on extractionFields
  },
  "searchTerms": ["python developer", "aws cloud", "copenhagen tech"]
}`

      const response = await openai.chat.completions.create({
        model: MODEL_CONFIG.emailAnalyzer,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extract entities and analyze:\n\n${text.substring(0, 8000)}` },
        ],
        response_format: { type: 'json_object' },
        temperature: TEMPERATURE_CONFIG.extraction,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('Empty response from LLM')
      }

      // Validate the response structure
      const parsed = JSON.parse(content) as EmailAnalysis
      
      return JSON.stringify({
        success: true,
        analysis: parsed,
      })
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Entity extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  },
  {
    name: 'extract_entities',
    description: 'Extract entities (companies, technologies, locations, skills) and structured data from text',
    schema: extractEntitiesSchema,
  }
)

// ============================================
// Analyze Email Tool (Combined)
// ============================================

const analyzeEmailSchema = z.object({
  htmlBody: z.string().describe('The HTML body of the email'),
  subject: z.string().describe('Email subject line'),
  from: z.string().describe('Sender email address'),
  matchCriteria: z.string().describe('User criteria for matching emails'),
  extractionFields: z.string().describe('Fields to extract from the content'),
  userIntent: z.string().optional().describe('User intent description'),
})

/**
 * Full email analysis - parses and extracts in one call
 */
export const analyzeEmailTool = tool(
  async ({ htmlBody, subject, from, matchCriteria, extractionFields, userIntent }): Promise<string> => {
    try {
      // Parse HTML to text
      const plainText = htmlBody
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim()

      const systemPrompt = `You are an expert email analyzer. Analyze the given email and extract relevant information.

USER'S MATCH CRITERIA:
${matchCriteria}

FIELDS TO EXTRACT:
${extractionFields}

${userIntent ? `USER'S INTENT:\n${userIntent}\n` : ''}

TASK:
1. Understand the email content and purpose
2. Extract all relevant entities
3. Determine if it matches user's criteria
4. Extract the requested fields
5. Generate search terms for web and KB searches

Be thorough - extract ALL technologies, skills, and requirements mentioned.

OUTPUT FORMAT (JSON):
{
  "email": {
    "subject": "${subject}",
    "from": "${from}",
    "plainText": "...",
    "snippet": "..."
  },
  "entities": {
    "companies": [],
    "technologies": [],
    "locations": [],
    "jobTitles": [],
    "skills": [],
    "other": {}
  },
  "matched": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "Why this matches or doesn't",
  "extractedData": {},
  "searchTerms": []
}`

      const response = await openai.chat.completions.create({
        model: MODEL_CONFIG.emailAnalyzer,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Email Subject: ${subject}\nFrom: ${from}\n\nContent:\n${plainText.substring(0, 10000)}` },
        ],
        response_format: { type: 'json_object' },
        temperature: TEMPERATURE_CONFIG.extraction,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('Empty response from LLM')
      }

      return content
    } catch (error) {
      return JSON.stringify({
        error: `Email analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  },
  {
    name: 'analyze_email',
    description: 'Fully analyze an email - parse content, extract entities, check match criteria, and generate search terms',
    schema: analyzeEmailSchema,
  }
)

// ============================================
// Export all email tools
// ============================================

export const emailAnalyzerTools = [
  parseEmailContentTool,
  extractEntitiesTool,
  analyzeEmailTool,
]

