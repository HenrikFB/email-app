/**
 * AI-Powered Query Strategy
 * 
 * Uses LLM to intelligently analyze extracted data and generate
 * optimal search queries based on user intent and instructions.
 */

import OpenAI from 'openai'
import type { SearchMode, StrategyContext, SearchIntent } from '../types'
import { BaseSearchQueryStrategy } from './base'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Response schema for AI query generation
 */
interface AIQueryResponse {
  queries: Array<{
    query: string
    field: string
    value: string
    reasoning: string
    priority: number
  }>
}

/**
 * Strategy that uses LLM to generate optimal search queries
 */
export class AIPoweredStrategy extends BaseSearchQueryStrategy {
  readonly name = 'AIPoweredStrategy'
  readonly mode: SearchMode = 'ai_powered'

  protected async doGenerateQueries(context: StrategyContext): Promise<SearchIntent[]> {
    const { extractedData, userIntent, searchInstructions, maxQueries } = context

    console.log('   🤖 Using AI to generate optimal search queries...')

    try {
      const systemPrompt = this.buildSystemPrompt(userIntent, searchInstructions, maxQueries)
      const userPrompt = this.buildUserPrompt(extractedData)

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3, // Lower temperature for more consistent output
        max_tokens: 1000,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        console.log('   ⚠️ Empty AI response')
        return this.fallbackToSimple(context)
      }

      const parsed = JSON.parse(content) as AIQueryResponse
      
      if (!parsed.queries || !Array.isArray(parsed.queries)) {
        console.log('   ⚠️ Invalid AI response structure')
        return this.fallbackToSimple(context)
      }

      console.log(`   ✅ AI generated ${parsed.queries.length} queries`)

      return parsed.queries.map((q) => ({
        query: q.query,
        sourceField: q.field,
        sourceValue: q.value,
        priority: q.priority || 0.5,
        reasoning: q.reasoning,
      }))
    } catch (error) {
      console.error('   ❌ AI query generation failed:', error)
      return this.fallbackToSimple(context)
    }
  }

  /**
   * Build system prompt for AI
   */
  private buildSystemPrompt(
    userIntent?: string,
    searchInstructions?: string,
    maxQueries: number = 5
  ): string {
    return `You are a search query optimization assistant. Your job is to analyze extracted data from emails (like job postings) and generate optimal search queries to find relevant documents in a knowledge base.

The knowledge base contains:
- Cover letters for different technologies and positions
- Previous job applications
- Saved job descriptions
- Professional notes and documents

${userIntent ? `User's Intent: ${userIntent}\n` : ''}
${searchInstructions ? `Search Instructions: ${searchInstructions}\n` : ''}

Rules:
1. Generate ${maxQueries} or fewer search queries
2. Each query should be specific and focused (e.g., "Python backend developer" not "Python .NET Java C# developer")
3. If there are multiple technologies, create SEPARATE queries for each major one
4. Include context like role level (Senior, Junior) and location when relevant
5. Prioritize the most important/prominent items from the data
6. Keep queries concise (5-50 characters ideal)

Respond with JSON in this exact format:
{
  "queries": [
    {
      "query": "Python backend developer Copenhagen",
      "field": "technologies",
      "value": "Python",
      "reasoning": "Primary technology mentioned, combined with role and location",
      "priority": 1.0
    }
  ]
}

Priority should be 0.0-1.0 where 1.0 is highest priority.`
  }

  /**
   * Build user prompt with extracted data
   */
  private buildUserPrompt(extractedData: Record<string, unknown>): string {
    // Format extracted data nicely
    const formattedData = Object.entries(extractedData)
      .filter(([_, value]) => value !== null && value !== undefined)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}: ${value.join(', ')}`
        }
        return `${key}: ${value}`
      })
      .join('\n')

    return `Analyze this extracted data and generate optimal search queries:

${formattedData}

Generate the best search queries to find relevant documents in my knowledge base.`
  }

  /**
   * Fallback to simple multi-intent if AI fails
   */
  private fallbackToSimple(context: StrategyContext): SearchIntent[] {
    console.log('   🔄 Falling back to simple multi-intent logic')

    const intents: SearchIntent[] = []
    const ctx = this.getContextFields(context.extractedData)

    // Try technologies first
    const techFields = ['technologies', 'tech_stack', 'skills', 'programming_languages']
    
    for (const field of techFields) {
      const values = this.extractFieldValues(context.extractedData, field)
      for (const value of values.slice(0, context.maxQueries)) {
        intents.push({
          query: this.buildQuery(value, ctx.title, ctx.location),
          sourceField: field,
          sourceValue: value,
          priority: 0.5,
          reasoning: 'Fallback query',
        })
      }
      if (intents.length >= context.maxQueries) break
    }

    // If still empty, create one combined query
    if (intents.length === 0 && ctx.title) {
      intents.push({
        query: this.buildQuery(ctx.title, ctx.location),
        sourceField: 'title',
        priority: 0.5,
        reasoning: 'Fallback combined query',
      })
    }

    return intents
  }
}

