/**
 * Email Analyzer Sub-Agent
 * 
 * Specialized sub-agent for parsing and analyzing email content.
 */

import { SYSTEM_PROMPTS, MODEL_CONFIG } from '../config'
import { emailAnalyzerTools } from '../tools/email-analyzer'
import type { SubAgentConfig } from '../types'

/**
 * Email Analyzer Sub-Agent Configuration
 * 
 * Responsibilities:
 * - Parse email HTML to extract plain text
 * - Extract entities (companies, technologies, locations, skills)
 * - Determine if email matches user's criteria
 * - Extract structured data based on extraction fields
 * - Generate search terms for web and KB searches
 */
export const emailAnalyzerSubAgent: SubAgentConfig & { tools: typeof emailAnalyzerTools } = {
  name: 'email-analyzer',
  description: `Analyzes emails to extract entities, check match criteria, and prepare data for research.
Use when you need to:
- Parse and understand an email's content
- Extract companies, technologies, locations, and skills mentioned
- Determine if the email matches the user's criteria
- Generate search terms for further research`,
  
  systemPrompt: SYSTEM_PROMPTS.emailAnalyzer,
  
  model: MODEL_CONFIG.emailAnalyzer,
  
  tools: emailAnalyzerTools,
}

/**
 * Create email analysis task description
 */
export function createEmailAnalysisTask(params: {
  emailSubject: string
  emailFrom: string
  matchCriteria: string
  extractionFields: string
  userIntent?: string
}): string {
  return `Analyze this email and extract relevant information:

Email Subject: ${params.emailSubject}
From: ${params.emailFrom}

User's Match Criteria: ${params.matchCriteria}
Fields to Extract: ${params.extractionFields}
${params.userIntent ? `User's Intent: ${params.userIntent}` : ''}

Tasks:
1. Use analyze_email to parse the email and extract entities
2. Determine if this email matches the user's criteria
3. Extract the specified fields from the content
4. Generate search terms for web and KB research

Return a summary with:
- Match decision (yes/no) with confidence score
- Extracted entities (companies, technologies, locations, etc.)
- Extracted structured data
- Recommended search terms for further research`
}

