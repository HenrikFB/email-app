/**
 * Re-Evaluation Node
 * 
 * After research finds the full job description, this node re-evaluates
 * whether each job still matches the user's criteria based on the
 * complete information (not just the email snippet).
 * 
 * This catches cases where:
 * - Email says ".NET developer" (matches)
 * - Full description says "5+ years required" (doesn't match user's <5 years criteria)
 */

import { ChatOpenAI } from '@langchain/openai'
import type { EmailWorkflowState, JobListing, JobResearchResult } from '../types'

// Use same model as analysis for consistency
const RE_EVALUATE_MODEL = 'gpt-4o-mini'

interface ReEvaluationResult {
  jobId: string
  originalMatch: boolean
  newMatch: boolean
  newConfidence: number
  newReasoning: string
  changedReason?: string // Why the decision changed
  extractedFields: Record<string, unknown>
}

/**
 * Build the re-evaluation prompt
 */
function buildReEvaluationPrompt(config: {
  matchCriteria: string
  extractionFields: string
  userIntent?: string
}): string {
  return `You are an expert job matcher. You previously matched jobs based on email snippets.
Now you have the FULL job description and must RE-EVALUATE if each job truly matches the user's criteria.

## USER'S MATCH CRITERIA
${config.matchCriteria}

## USER'S INTENT
${config.userIntent || 'Find relevant job opportunities'}

## EXTRACTION FIELDS TO LOOK FOR
${config.extractionFields}

## YOUR TASK
For each job, carefully read the FULL job description and:

1. **Check Experience Requirements**: 
   - If user wants "<5 years" but job requires "5+ years", "senior", "lead" → REJECT
   - If user wants "senior" but job is for "junior" → REJECT

2. **Check Technology Match**:
   - Does the job require technologies the user knows?
   - Are there deal-breaker requirements (e.g., PLC/SCADA for a software dev)?

3. **Check Other Criteria**:
   - Location compatibility
   - Work type (remote/hybrid/onsite)
   - Any other user-specified requirements

4. **Extract Fields**:
   - deadline, technologies, competencies, experience_level, location, work_type
   - Any other fields from the extraction fields list

## IMPORTANT
- Be STRICT now that you have full information
- If the full description reveals disqualifying criteria, CHANGE the match to false
- Provide clear reasoning about what changed and why

Respond with a JSON object for each job.`
}

/**
 * Re-evaluate a single job against the full description
 */
async function reEvaluateSingleJob(
  job: JobListing,
  research: JobResearchResult | undefined,
  config: {
    matchCriteria: string
    extractionFields: string
    userIntent?: string
  }
): Promise<ReEvaluationResult> {
  // If no research or no job description found, keep original match
  if (!research || !research.found || !research.jobDescription) {
    return {
      jobId: job.id,
      originalMatch: job.matched,
      newMatch: job.matched,
      newConfidence: job.confidence,
      newReasoning: job.matchReasoning + ' (No full description available for re-evaluation)',
      extractedFields: job.extractedData || {},
    }
  }

  const model = new ChatOpenAI({
    modelName: RE_EVALUATE_MODEL,
    temperature: 0.1,
  })

  const systemPrompt = buildReEvaluationPrompt(config)

  // Truncate job description if too long
  const maxDescLength = 8000
  const jobDescription = research.jobDescription.length > maxDescLength
    ? research.jobDescription.substring(0, maxDescLength) + '\n... [truncated]'
    : research.jobDescription

  const userPrompt = `
## JOB TO RE-EVALUATE

**Company**: ${job.company}
**Position**: ${job.position}
**Location**: ${job.location || 'Not specified'}
**Original Match**: ${job.matched ? 'Yes' : 'No'} (${(job.confidence * 100).toFixed(0)}%)
**Original Reasoning**: ${job.matchReasoning}

## FULL JOB DESCRIPTION (from ${research.primarySource?.sourceType || 'web search'}):
${jobDescription}

---

Re-evaluate this job. Respond with ONLY a JSON object:
{
  "stillMatches": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "Explanation of why it matches or not based on the FULL description",
  "changedReason": "If the decision changed, explain what new information caused this" or null,
  "extractedFields": {
    "deadline": "extracted deadline or null",
    "experience_level": "junior/mid/senior/not specified",
    "technologies": ["list", "of", "technologies"],
    "competencies": ["list", "of", "competencies"],
    "work_type": "remote/hybrid/onsite/not specified",
    "location": "extracted location",
    "salary": "if mentioned or null"
  }
}`

  try {
    const response = await model.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])

    // Parse the response
    const content = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content)

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.warn(`   ⚠️ Could not parse re-evaluation response for ${job.company}`)
      return {
        jobId: job.id,
        originalMatch: job.matched,
        newMatch: job.matched,
        newConfidence: job.confidence,
        newReasoning: job.matchReasoning,
        extractedFields: job.extractedData || {},
      }
    }

    const parsed = JSON.parse(jsonMatch[0])

    return {
      jobId: job.id,
      originalMatch: job.matched,
      newMatch: parsed.stillMatches ?? job.matched,
      newConfidence: parsed.confidence ?? job.confidence,
      newReasoning: parsed.reasoning || job.matchReasoning,
      changedReason: parsed.changedReason || undefined,
      extractedFields: parsed.extractedFields || {},
    }
  } catch (error) {
    console.error(`   ❌ Re-evaluation failed for ${job.company}:`, error)
    return {
      jobId: job.id,
      originalMatch: job.matched,
      newMatch: job.matched,
      newConfidence: job.confidence,
      newReasoning: job.matchReasoning,
      extractedFields: job.extractedData || {},
    }
  }
}

/**
 * Re-Evaluate Node
 * 
 * Re-evaluates matched jobs against their full job descriptions
 * to catch cases where the email snippet looked good but the
 * full description has disqualifying requirements.
 */
export async function reEvaluateNode(
  state: EmailWorkflowState
): Promise<Partial<EmailWorkflowState>> {
  console.log('\n🔄 [Re-Evaluate] Starting re-evaluation of matched jobs...')
  const startTime = Date.now()

  try {
    const matchedJobs = state.jobs.filter(j => j.matched)
    
    if (matchedJobs.length === 0) {
      console.log('   No matched jobs to re-evaluate')
      return {}
    }

    console.log(`   Re-evaluating ${matchedJobs.length} job(s) against full descriptions...`)

    const results: ReEvaluationResult[] = []
    let changedCount = 0
    let rejectedCount = 0

    // Re-evaluate each matched job
    for (const job of matchedJobs) {
      const research = state.researchResults.find(r => r.jobId === job.id)
      
      console.log(`\n   📋 Re-evaluating: ${job.position} at ${job.company}`)
      console.log(`      Original: ${job.matched ? '✅' : '❌'} (${(job.confidence * 100).toFixed(0)}%)`)
      console.log(`      Has full description: ${research?.found ? 'Yes' : 'No'}`)

      const result = await reEvaluateSingleJob(job, research, {
        matchCriteria: state.config.matchCriteria,
        extractionFields: state.config.extractionFields,
        userIntent: state.config.userIntent,
      })

      results.push(result)

      // Log changes
      if (result.originalMatch !== result.newMatch) {
        changedCount++
        if (!result.newMatch) {
          rejectedCount++
          console.log(`      ❌ REJECTED after re-evaluation`)
          console.log(`      Reason: ${result.changedReason || result.newReasoning}`)
        } else {
          console.log(`      ✅ CONFIRMED after re-evaluation`)
        }
      } else {
        console.log(`      → No change (${result.newMatch ? '✅' : '❌'})`)
      }
      console.log(`      New confidence: ${(result.newConfidence * 100).toFixed(0)}%`)
    }

    // Update jobs with re-evaluation results
    const updatedJobs = state.jobs.map(job => {
      const reEvalResult = results.find(r => r.jobId === job.id)
      if (!reEvalResult) return job

      return {
        ...job,
        matched: reEvalResult.newMatch,
        confidence: reEvalResult.newConfidence,
        matchReasoning: reEvalResult.newReasoning,
        extractedData: {
          ...job.extractedData,
          ...reEvalResult.extractedFields,
          _reEvaluated: true,
          _changedReason: reEvalResult.changedReason,
        },
      }
    })

    // Recalculate hasMatches
    const hasMatches = updatedJobs.some(j => j.matched)

    const duration = Date.now() - startTime
    console.log(`\n✅ [Re-Evaluate] Completed in ${(duration / 1000).toFixed(1)}s`)
    console.log(`   Changed: ${changedCount}/${matchedJobs.length}`)
    console.log(`   Rejected: ${rejectedCount}`)
    console.log(`   Still matching: ${updatedJobs.filter(j => j.matched).length}`)

    return {
      jobs: updatedJobs,
      hasMatches,
    }
  } catch (error) {
    console.error('❌ [Re-Evaluate] Error:', error)
    return {
      errors: [...state.errors, `Re-evaluation error: ${error instanceof Error ? error.message : 'Unknown'}`],
    }
  }
}

export { reEvaluateNode as default }

