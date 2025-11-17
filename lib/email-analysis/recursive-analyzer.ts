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
 * Analyze a single chunk
 */
async function analyzeChunk(
  chunk: ContentChunk,
  matchCriteria: string,
  extractionFields: string
): Promise<ChunkAnalysisResult> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })
  
  const prompt = `Analyze this content chunk:

**Content Type**: ${chunk.type}
${chunk.source ? `**Source URL**: ${chunk.source}` : '**Source**: Email'}

**Content** (${chunk.charCount} chars):
${chunk.content}

---

**User's Interest (Match Criteria)**:
${matchCriteria}

**What to Extract (if matched)**:
${extractionFields}

---

**Task**: 
1. Determine if this chunk contains information matching the user's criteria
2. If YES, extract the requested fields as a JSON object
3. Provide reasoning for your decision

**Return JSON**:
{
  "matched": boolean,
  "extractedData": { /* user-requested fields */ },
  "reasoning": "brief explanation (1-2 sentences)",
  "confidence": 0.0-1.0
}

If not matched, set matched=false, extractedData={}, and explain why.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: 'You are analyzing content chunks to extract structured data. Return only valid JSON.'
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
 * Analyze all chunks recursively
 */
export async function analyzeChunksRecursively(
  chunks: ContentChunk[],
  matchCriteria: string,
  extractionFields: string
): Promise<ChunkAnalysisResult[]> {
  console.log(`\n🔄 Analyzing ${chunks.length} chunks recursively...`)
  
  const results: ChunkAnalysisResult[] = []
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    console.log(`\n📝 Chunk ${i + 1}/${chunks.length} [${chunk.type}${chunk.source ? `: ${chunk.source}` : ''}]`)
    
    const result = await analyzeChunk(chunk, matchCriteria, extractionFields)
    
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

