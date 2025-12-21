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
 * 
 * Uses chain-of-thought reasoning for accurate verification.
 */

import { ChatOpenAI } from '@langchain/openai'
import { JOB_SEARCH_CONFIG } from '../configs'
import { debugLog } from '../utils/debug-logger'
import type { EmailWorkflowState, JobListing, JobResearchResult } from '../types'

// Use same model as analysis for consistency
const RE_EVALUATE_MODEL = 'gpt-4o-mini'

interface ReEvaluationResult {
  jobId: string
  originalMatch: boolean
  newMatch: boolean
  newConfidence: number
  newReasoning: string
  changedReason?: string
  extractedFields: Record<string, unknown>
}

/**
 * Build the re-evaluation prompt - INCLUSIVE approach
 * User prefers false positives over missing opportunities
 */
function buildReEvaluationPrompt(config: {
  matchCriteria: string
  extractionFields: string
  userIntent?: string
}): string {
  return `You are an expert job analyst performing a VERIFICATION step.

## YOUR MISSION
You previously matched jobs based on brief email snippets. Now you have the FULL job description.
Your job is to VERIFY and ENRICH the match information.

## CRITICAL: BE INCLUSIVE, NOT STRICT

**The user EXPLICITLY wants to see ALL potentially relevant IT/software jobs.**
They prefer FALSE POSITIVES over missing opportunities.
They can filter manually - your job is to NOT miss good opportunities.

### REJECT if ANY of these DISQUALIFIERS are found:

**EXPERIENCE DISQUALIFIERS (CHECK THE FULL JOB DESCRIPTION!):**
1. Requires 5+ years experience → REJECT
2. Requires "Senior" level explicitly → REJECT  
3. Requires "Lead", "Principal", "Architect" experience → REJECT
4. Danish: "5+ års erfaring", "erfaren senior" → REJECT

**EXPERIENCE BORDERLINE (Include with LOW confidence 0.5-0.6):**
- Requires 3-5 years → Include but flag, confidence 0.5-0.6
- Danish: "erfaren" (experienced) without years → Assume 3-5, include with low confidence

**JOB TYPE DISQUALIFIERS:**
1. PLC programming with Siemens S7/TIA Portal (industrial automation controllers)
2. SCADA systems (industrial control software)
3. Embedded firmware/RTOS with microcontrollers (STM32, Arduino, bare-metal)
4. Hardware/electronic/PCB design
5. Mechanical/mechatronic engineering

### ⚠️ COMPANY DOMAIN DOES NOT MATTER!
A software developer job at ABB, Siemens, Grundfos, Vestas, or ANY industrial company is VALID.
What matters is the JOB ROLE and EXPERIENCE LEVEL.

✅ "Software Developer at ABB using C#, 2-3 years" → INCLUDE (software role, good experience)
⚠️ "Software Developer at ABB, 3-5 years" → INCLUDE with LOW confidence (borderline experience)
❌ "Senior Software Developer at ABB, 5+ years" → REJECT (too much experience)
❌ "PLC Programmer at ABB using Siemens S7" → REJECT (PLC programming)

### DO NOT REJECT for:
- The company's industry (manufacturing, utilities, healthcare, etc.)
- Technologies user doesn't know yet (they can learn)
- Uncertainty about the role (include with lower confidence)

## CHAIN-OF-THOUGHT VERIFICATION

### Step 1: IS THIS AN IT/SOFTWARE JOB?
<thinking>
- Does this involve coding, software, IT, automation, data, or development?
- Types that ARE valid: Software, DevOps, RPA, BI, Cloud, Data, Web, Mobile, IT-udvikler
- Types that are NOT valid: PLC/SCADA, Hardware, Embedded firmware, Mechanical
</thinking>

### Step 2: EXPERIENCE CHECK (CRITICAL - READ CAREFULLY!)
<thinking>
- Search the FULL job description for experience requirements
- Look for: "X years", "X+ years", "X-Y years", "års erfaring", "senior", "lead"
- Apply these rules:
  * 0-3 years → GOOD, normal confidence
  * 3-5 years → BORDERLINE, reduce confidence to 0.5-0.6, flag it
  * 5+ years → REJECT! Too senior
  * "Senior" in title/requirements → Usually means 5+, REJECT
  * "Lead", "Principal", "Architect" → REJECT
</thinking>

### Step 3: TECHNOLOGY ENRICHMENT
<thinking>
- What technologies are required?
- What are nice-to-have?
- Extract for user reference
</thinking>

### Step 4: FINAL DECISION
- CONFIRMED MATCH (0.7-1.0): IT/software job with 0-3 years experience
- BORDERLINE MATCH (0.5-0.6): IT/software job with 3-5 years - include but flag
- REJECTED: Experience is 5+ years OR job type is PLC/SCADA/embedded/hardware

## USER'S MATCH CRITERIA
${config.matchCriteria}

## USER'S INTENT
${config.userIntent || 'Find relevant job opportunities'}

## EXTRACTION FIELDS
${config.extractionFields}

## DANISH TERMS
- "erfaring" = experience, "års erfaring" = years of experience
- "krav" = requirements, "ønsket" = desired/nice-to-have
- "IT-udvikler" = IT developer, "softwareudvikler" = software developer
- "automatisering" = automation, "RPA" = robotic process automation

## OUTPUT FORMAT
Respond with a JSON object:
\`\`\`json
{
  "stillMatches": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of your decision",
  "changedReason": "ONLY if rejecting - e.g. 'Requires 5+ years experience' or 'PLC programming role'",
  "extractedFields": {
    "deadline": "extracted deadline or null",
    "experience_level": "junior/mid/senior/lead/not specified",
    "experience_years": "X-Y years or X+ years or null (EXTRACT THIS CAREFULLY!)",
    "technologies": ["required", "technologies"],
    "nice_to_have_technologies": ["optional", "technologies"],
    "competencies": ["soft", "skills"],
    "work_type": "remote/hybrid/onsite/not specified",
    "location": "extracted location",
    "salary": "if mentioned or null"
  }
}
\`\`\`

REMEMBER: 
- 5+ years experience = REJECT
- 3-5 years = include with confidence 0.5-0.6
- When in doubt about experience, include with lower confidence`
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
      newConfidence: job.confidence * 0.9, // Slightly reduce confidence without verification
      newReasoning: job.matchReasoning + ' [Note: Could not verify - no full description available]',
      extractedFields: job.extractedData || {},
    }
  }

  const model = new ChatOpenAI({
    modelName: RE_EVALUATE_MODEL,
    temperature: 0.1,
  })

  const systemPrompt = buildReEvaluationPrompt(config)

  // Truncate job description if too long
  const maxDescLength = 12000
  const jobDescription = research.jobDescription.length > maxDescLength
    ? research.jobDescription.substring(0, maxDescLength) + '\n... [truncated]'
    : research.jobDescription

  const userPrompt = `## JOB TO RE-VERIFY

### Original Match Information
- **Company**: ${job.company}
- **Position**: ${job.position}
- **Location**: ${job.location || 'Not specified'}
- **Original Match**: ${job.matched ? 'Yes' : 'No'} (${(job.confidence * 100).toFixed(0)}% confidence)
- **Original Reasoning**: ${job.matchReasoning}
- **Technologies from Email**: ${job.technologies.join(', ') || 'None specified'}

### Source Information
- **Source Type**: ${research.primarySource?.sourceType || 'Unknown'}
- **Source URL**: ${research.primarySource?.url || 'N/A'}

---

## FULL JOB DESCRIPTION

${jobDescription}

---

Now perform your chain-of-thought verification.

First, go through each verification step in your <thinking>:
1. EXPERIENCE VERIFICATION - Check years and level required
2. TECHNOLOGY VERIFICATION - Check required vs nice-to-have
3. JOB TYPE VERIFICATION - Confirm it's software development
4. OTHER CRITERIA - Location, work type, etc.

Then provide your final decision as JSON.`

  try {
    const response = await model.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])

    // Parse the response
    const content = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content)

    // Extract JSON from response (might be wrapped in markdown code block)
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/)
    
    if (!jsonMatch) {
      console.warn(`   ⚠️ Could not parse re-evaluation response for ${job.company}`)
      return {
        jobId: job.id,
        originalMatch: job.matched,
        newMatch: job.matched,
        newConfidence: job.confidence,
        newReasoning: job.matchReasoning + ' [Re-evaluation parse error]',
        extractedFields: job.extractedData || {},
      }
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0]
    const parsed = JSON.parse(jsonStr)

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
  console.log('\n' + '═'.repeat(70))
  console.log('🔄 RE-EVALUATION NODE - STRICT VERIFICATION')
  console.log('═'.repeat(70))
  
  const startTime = Date.now()

  try {
    const matchedJobs = state.jobs.filter(j => j.matched)
    
    if (matchedJobs.length === 0) {
      console.log('   No matched jobs to re-evaluate')
      return {}
    }

    console.log(`📋 Re-evaluating ${matchedJobs.length} job(s) with full descriptions...`)
    console.log('─'.repeat(70))

    // Use config from state or fallback to hardcoded
    const evalConfig = {
      matchCriteria: state.config.matchCriteria || JOB_SEARCH_CONFIG.matchCriteria,
      extractionFields: state.config.extractionFields || JOB_SEARCH_CONFIG.extractionFields,
      userIntent: state.config.userIntent || JOB_SEARCH_CONFIG.userIntent,
    }

    const results: ReEvaluationResult[] = []
    let confirmedCount = 0
    let rejectedCount = 0
    let downgradedCount = 0

    // Re-evaluate each matched job
    for (const job of matchedJobs) {
      const research = state.researchResults.find(r => r.jobId === job.id)
      
      console.log(`\n📋 Verifying: ${job.position} at ${job.company}`)
      console.log(`   Original: ✅ Match (${(job.confidence * 100).toFixed(0)}%)`)
      console.log(`   Full description: ${research?.found ? 'Available (' + (research.jobDescription?.length || 0) + ' chars)' : 'Not available'}`)

      const result = await reEvaluateSingleJob(job, research, evalConfig)
      results.push(result)

      // Log the result with details
      if (!result.newMatch && result.originalMatch) {
        rejectedCount++
        console.log(`   ❌ REJECTED after verification`)
        console.log(`   📝 Reason: ${result.changedReason || result.newReasoning}`)
      } else if (result.newMatch && result.newConfidence < job.confidence) {
        downgradedCount++
        console.log(`   ⚠️ DOWNGRADED to ${(result.newConfidence * 100).toFixed(0)}%`)
        console.log(`   📝 Reason: ${result.newReasoning}`)
      } else {
        confirmedCount++
        console.log(`   ✅ CONFIRMED (${(result.newConfidence * 100).toFixed(0)}%)`)
      }

      // Log extracted fields
      if (result.extractedFields && Object.keys(result.extractedFields).length > 0) {
        const ef = result.extractedFields
        if (ef.experience_level || ef.experience_years) {
          console.log(`   📊 Experience: ${ef.experience_level || ''} ${ef.experience_years || ''}`)
        }
        if (ef.technologies && Array.isArray(ef.technologies) && ef.technologies.length > 0) {
          console.log(`   💻 Technologies: ${(ef.technologies as string[]).slice(0, 5).join(', ')}...`)
        }
        if (ef.deadline) {
          console.log(`   📅 Deadline: ${ef.deadline}`)
        }
      }
      
      // Debug log this re-evaluation
      await debugLog.logReEvaluation(
        job.company,
        result.originalMatch,
        result.newMatch,
        research?.jobDescription,
        result.newReasoning
      )
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
          _originalMatch: reEvalResult.originalMatch,
          _changedReason: reEvalResult.changedReason,
        },
      }
    })

    // Recalculate hasMatches
    const hasMatches = updatedJobs.some(j => j.matched)

    const duration = Date.now() - startTime
    
    console.log('\n' + '─'.repeat(70))
    console.log('📊 RE-EVALUATION SUMMARY')
    console.log('─'.repeat(70))
    console.log(`   ⏱️ Duration: ${(duration / 1000).toFixed(1)}s`)
    console.log(`   ✅ Confirmed: ${confirmedCount}`)
    console.log(`   ⚠️ Downgraded: ${downgradedCount}`)
    console.log(`   ❌ Rejected: ${rejectedCount}`)
    console.log(`   📋 Final matches: ${updatedJobs.filter(j => j.matched).length}/${matchedJobs.length}`)
    console.log('═'.repeat(70) + '\n')

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

export { buildReEvaluationPrompt }
export default reEvaluateNode
