/**
 * Research Node
 * 
 * Orchestrates the research agent to find public job descriptions
 * for matched jobs. Uses the ReAct agent for iterative research.
 */

import { researchJob, researchJobsBatch } from '../agents/research-agent'
import { debugLog } from '../utils/debug-logger'
import type { EmailWorkflowState, JobResearchResult } from '../types'

// ============================================
// Configuration
// ============================================

const MAX_CONCURRENT_RESEARCH = 3 // Research up to 3 jobs at once

// ============================================
// Research Node
// ============================================

/**
 * Research node function
 * Uses the ReAct research agent to find public job descriptions
 * 
 * @param state - Current workflow state
 * @returns Updated state with research results
 */
export async function researchNode(
  state: EmailWorkflowState
): Promise<Partial<EmailWorkflowState>> {
  console.log('\n🔬 [Research Node] Starting research phase...')
  
  const startTime = Date.now()
  
  try {
    // Get matched jobs that need research
    const matchedJobs = state.jobs.filter(job => job.matched)
    
    if (matchedJobs.length === 0) {
      console.log('   No matched jobs to research')
      return {
        researchResults: [],
        currentPhase: 'complete',
      }
    }

    console.log(`   Researching ${matchedJobs.length} matched job(s)...`)

    // Use batch research for parallel processing
    const researchResults = await researchJobsBatch(
      matchedJobs,
      state.config,
      MAX_CONCURRENT_RESEARCH
    )

    // Calculate statistics
    const successCount = researchResults.filter(r => r.found).length
    const totalIterations = researchResults.reduce((sum, r) => sum + r.iterations, 0)
    const avgIterations = totalIterations / researchResults.length

    const processingTime = Date.now() - startTime
    console.log(`\n✅ [Research Node] Completed in ${(processingTime / 1000).toFixed(1)}s`)
    console.log(`   Success rate: ${successCount}/${matchedJobs.length} (${Math.round(successCount / matchedJobs.length * 100)}%)`)
    console.log(`   Average iterations: ${avgIterations.toFixed(1)}`)

    // Debug log each research result
    for (const result of researchResults) {
      await debugLog.logResearchResult(
        result.company,
        result.position,
        {
          found: result.found,
          jobDescriptionLength: result.jobDescription?.length || 0,
          jobDescriptionPreview: result.jobDescription?.substring(0, 500) || '[NO CONTENT]',
          primarySource: result.primarySource?.url,
          sourceType: result.primarySource?.sourceType,
          technologies: result.technologies,
          deadline: result.deadline,
          iterations: result.iterations,
          reasoning: result.reasoning,
        }
      )
    }
    
    // Log full research step
    await debugLog.logStep('research', 
      { matchedJobsCount: matchedJobs.length }, 
      { 
        results: researchResults.map(r => ({
          company: r.company,
          position: r.position,
          found: r.found,
          jobDescriptionLength: r.jobDescription?.length || 0,
          primarySource: r.primarySource?.url,
        })),
        successCount,
        avgIterations: avgIterations.toFixed(1),
      },
      processingTime
    )

    return {
      researchResults,
      currentPhase: 'aggregating',
      processingTimeMs: state.processingTimeMs + processingTime,
    }
  } catch (error) {
    console.error('❌ [Research Node] Error:', error)
    
    return {
      researchResults: [],
      errors: [...state.errors, `Research failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      currentPhase: 'error',
    }
  }
}

/**
 * Research a single job (for use with Send API / dynamic parallelism)
 */
export async function researchSingleJobNode(
  state: EmailWorkflowState & { currentJobIndex: number }
): Promise<Partial<EmailWorkflowState>> {
  const job = state.jobs[state.currentJobIndex]
  
  if (!job || !job.matched) {
    return { researchResults: state.researchResults }
  }

  console.log(`\n🔬 [Research] Job ${state.currentJobIndex + 1}: ${job.position} at ${job.company}`)
  
  const result = await researchJob(job, state.config)
  
  return {
    researchResults: [...state.researchResults, result],
  }
}

// researchNode and researchSingleJobNode are exported inline above
