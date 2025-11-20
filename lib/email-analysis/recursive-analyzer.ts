/**
 * Recursive Chunk Analysis
 * Analyzes each chunk independently and aggregates results
 * Fully generic - works with any content type
 */

import OpenAI from 'openai'
import type { ContentChunk } from './content-chunker'

export interface ChunkAnalysisResult {
  chunkIndex: number
  chunkType: 'email' | 'scraped'  // NEW: Track chunk type
  source: string  // NEW: 'Email' or the URL
  matched: boolean
  extractedData: Record<string, any>
  reasoning: string
  confidence: number
}

export interface SourcedData {
  source: string  // 'Email' or URL
  data: Record<string, any>
  reasoning: string
  confidence: number
}

export interface AggregatedResult {
  matched: boolean
  totalMatches: number
  aggregatedData: Record<string, any>  // Combined data (backward compatible)
  dataBySource: SourcedData[]  // NEW: Data grouped by source
  overallConfidence: number
  allChunkResults: ChunkAnalysisResult[]
}

/**
 * Analyze a single chunk with full agent configuration context
 * @param chunk - Content chunk to analyze
 * @param matchCriteria - User's matching criteria
 * @param extractionFields - Fields to extract
 * @param ragContext - RAG context from knowledge bases
 * @param userIntent - User's intent/goal (NEW - was missing!)
 * @param extractionExamples - User-provided examples of expected output
 * @param analysisFeedback - User feedback about what works/fails
 */
async function analyzeChunk(
  chunk: ContentChunk,
  matchCriteria: string,
  extractionFields: string,
  ragContext?: string,
  userIntent?: string,
  extractionExamples?: string,
  analysisFeedback?: string
): Promise<ChunkAnalysisResult> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })
  
  // Build prompt following GPT-4.1 best practices: explicit structure, clear sections, examples
  let prompt = `You are an expert data extraction assistant. Your task is to extract specific information from content based on the user's criteria.

## Content to Analyze

**Source**: ${chunk.type === 'email' ? 'Email body' : `Scraped webpage: ${chunk.source}`}

**Content** (${chunk.charCount} characters):
${chunk.content}

---

## User's Requirements

**What the user is interested in**:
${matchCriteria}

${userIntent ? `**User's Intent/Context** (WHY they need this data):
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
- If feedback says "always extracts X when I don't want it", be VERY CONSERVATIVE about extracting X
- If feedback says "misses Y", actively look for Y
- If feedback mentions confusion between similar concepts, pay extra attention to disambiguation
- If feedback mentions wrong data types or formats, strictly adhere to correct formats

NEVER repeat these mistakes. Treat this feedback as hard constraints on your extraction.

---
` : ''}

## Your Task (Step-by-Step Process)

Follow this reasoning process explicitly:

**Step 1: Understanding Check**
- Read the user's goal and intent carefully
- Understand WHY they need this data (not just WHAT they want)
- Consider: Does this content help achieve their end goal?

**Step 2: Match Decision**
- Does this content contain information matching the user's criteria?
- Think about INTENT, not just keyword matching
- Be inclusive: if ANY relevant information exists, consider it a match
${analysisFeedback ? '- Apply feedback constraints: avoid extracting problematic content mentioned' : ''}

**Step 3: Data Extraction** (if matched)
- Extract ALL fields mentioned in "What to extract"
- Use the EXACT field names specified by the user
- Extract ACTUAL VALUES, not descriptions or meta-information
${extractionExamples ? '- Match the format/structure shown in the examples' : ''}
${ragContext ? '- Follow the style from reference context if applicable' : ''}
- If a field isn't found, use null or empty string (don't omit it)
- Be thorough and precise

**Step 4: Verification**
${analysisFeedback ? '- Double-check: Am I avoiding the problems mentioned in feedback?' : ''}
${extractionExamples ? '- Double-check: Does my output match the example format?' : ''}
- Double-check: Are all field names exact matches?
- Double-check: Are values actual data, not descriptions?

**Step 5: Confidence Rating**
Rate your confidence (0.0-1.0) based on:
- How clearly the content matches the user's goal
- How complete the extracted data is
- How certain you are about the extracted values

---

## Output Format

Return valid JSON with this exact structure:

{
  "matched": boolean,
  "extractedData": {
    // Use exact field names from "What to extract"
    // Include ALL fields even if null/empty
    // Extract actual values, not descriptions
  },
  "reasoning": "1-2 sentences explaining your decision and what was found",
  "confidence": 0.0-1.0
}

**Rules**:
- If matched=false: set extractedData={} and explain why it doesn't match
- If matched=true but some fields missing: still include them as null/empty
- Focus on the user's END GOAL, not just surface keywords
- Be thorough: extract all available information matching requested fields

Return only valid JSON.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: 'You are a data extraction specialist who understands user intent and extracts structured information based on their goals. You reason about the user\'s end goal, not just keywords. You are thorough, precise, and follow the exact field specifications provided. Always return valid JSON with matched, extractedData, reasoning, and confidence fields.'
      }, {
        role: 'user',
        content: prompt
      }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 1000,
    })
    
    const result = JSON.parse(response.choices[0].message.content || '{}')
    
    return {
      chunkIndex: chunk.index,
      chunkType: chunk.type,
      source: chunk.source || 'Email',
      matched: result.matched || false,
      extractedData: result.extractedData || {},
      reasoning: result.reasoning || 'Analysis completed',
      confidence: typeof result.confidence === 'number' ? result.confidence : 0.5
    }
  } catch (error) {
    console.error(`❌ Error analyzing chunk ${chunk.index}:`, error)
    return {
      chunkIndex: chunk.index,
      chunkType: chunk.type,
      source: chunk.source || 'Email',
      matched: false,
      extractedData: {},
      reasoning: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      confidence: 0
    }
  }
}

/**
 * Analyze all chunks recursively with full configuration context
 */
export async function analyzeChunksRecursively(
  chunks: ContentChunk[],
  matchCriteria: string,
  extractionFields: string,
  ragContext?: string,
  userIntent?: string,
  extractionExamples?: string,
  analysisFeedback?: string
): Promise<ChunkAnalysisResult[]> {
  console.log(`\n🔄 Analyzing ${chunks.length} chunks recursively...`)
  if (ragContext) {
    console.log(`   📚 Using RAG context (${ragContext.length} chars)`)
  }
  if (userIntent) {
    console.log(`   🎯 User intent provided`)
  }
  if (extractionExamples) {
    console.log(`   📋 Extraction examples provided`)
  }
  if (analysisFeedback) {
    console.log(`   💡 Analysis feedback provided`)
  }
  
  const results: ChunkAnalysisResult[] = []
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    console.log(`\n📝 Chunk ${i + 1}/${chunks.length} [${chunk.type}${chunk.source ? `: ${chunk.source}` : ''}]`)
    
    const result = await analyzeChunk(
      chunk, 
      matchCriteria, 
      extractionFields, 
      ragContext,
      userIntent,
      extractionExamples,
      analysisFeedback
    )
    
    if (result.matched) {
      console.log(`   ✅ MATCHED (confidence: ${(result.confidence * 100).toFixed(0)}%)`)
      console.log(`   📊 Extracted ${Object.keys(result.extractedData).length} fields`)
      console.log(`   💭 ${result.reasoning}`)
    } else {
      console.log(`   ⏭️  No match`)
    }
    
    results.push(result)
  }
  
  const matchCount = results.filter(r => r.matched).length
  console.log(`\n📊 Recursive analysis complete: ${matchCount}/${chunks.length} chunks matched`)
  
  return results
}

/**
 * Aggregate results from all chunks into final output
 * Handles duplicate data, merges arrays, picks highest confidence values
 */
export function aggregateResults(
  chunkResults: ChunkAnalysisResult[]
): AggregatedResult {
  console.log('\n🔗 Aggregating results from all chunks...')
  
  const matchedResults = chunkResults.filter(r => r.matched)
  
  if (matchedResults.length === 0) {
    console.log('   No matches found across any chunks')
    return {
      matched: false,
      totalMatches: 0,
      aggregatedData: {},
      dataBySource: [],
      overallConfidence: 0,
      allChunkResults: chunkResults
    }
  }
  
  // Merge all extracted data
  const aggregatedData: Record<string, any> = {}
  
  matchedResults.forEach(result => {
    Object.entries(result.extractedData).forEach(([key, value]) => {
      if (!aggregatedData[key]) {
        // First occurrence of this field
        aggregatedData[key] = value
      } else {
        // Field already exists - merge intelligently
        if (Array.isArray(value) && Array.isArray(aggregatedData[key])) {
          // Merge arrays, remove duplicates
          aggregatedData[key] = [...new Set([...aggregatedData[key], ...value])]
        } else if (typeof value === 'object' && typeof aggregatedData[key] === 'object') {
          // Merge objects
          aggregatedData[key] = { ...aggregatedData[key], ...value }
        } else if (aggregatedData[key] !== value) {
          // Different values - keep both in array
          if (Array.isArray(aggregatedData[key])) {
            if (!aggregatedData[key].includes(value)) {
              aggregatedData[key].push(value)
            }
          } else {
            aggregatedData[key] = [aggregatedData[key], value]
          }
        }
      }
    })
  })
  
  // Calculate overall confidence (weighted average)
  const totalConfidence = matchedResults.reduce((sum, r) => sum + r.confidence, 0)
  const overallConfidence = totalConfidence / matchedResults.length
  
  // NEW: Group data by source
  const sourceMap = new Map<string, SourcedData>()
  
  matchedResults.forEach(result => {
    const source = result.source
    
    if (!sourceMap.has(source)) {
      sourceMap.set(source, {
        source,
        data: {},
        reasoning: result.reasoning,
        confidence: result.confidence
      })
    }
    
    const sourcedData = sourceMap.get(source)!
    
    // Merge extracted data for this source
    Object.entries(result.extractedData).forEach(([key, value]) => {
      if (!sourcedData.data[key]) {
        sourcedData.data[key] = value
      } else {
        // Merge multiple values from same source
        if (Array.isArray(value) && Array.isArray(sourcedData.data[key])) {
          sourcedData.data[key] = [...new Set([...sourcedData.data[key], ...value])]
        } else if (sourcedData.data[key] !== value) {
          if (Array.isArray(sourcedData.data[key])) {
            if (!sourcedData.data[key].includes(value)) {
              sourcedData.data[key].push(value)
            }
          } else {
            sourcedData.data[key] = [sourcedData.data[key], value]
          }
        }
      }
    })
    
    // Update confidence (average if multiple chunks from same source)
    sourcedData.confidence = (sourcedData.confidence + result.confidence) / 2
  })
  
  const dataBySource = Array.from(sourceMap.values())
    .sort((a, b) => {
      // Email first, then by confidence
      if (a.source === 'Email') return -1
      if (b.source === 'Email') return 1
      return b.confidence - a.confidence
    })
  
  console.log(`   ✅ Aggregated ${matchedResults.length} matched chunks`)
  console.log(`   📊 Total fields extracted: ${Object.keys(aggregatedData).length}`)
  console.log(`   📍 Sources: ${dataBySource.length} (Email + ${dataBySource.length - 1} URLs)`)
  console.log(`   📈 Overall confidence: ${(overallConfidence * 100).toFixed(0)}%`)
  
  return {
    matched: true,
    totalMatches: matchedResults.length,
    aggregatedData,
    dataBySource,
    overallConfidence,
    allChunkResults: chunkResults
  }
}

