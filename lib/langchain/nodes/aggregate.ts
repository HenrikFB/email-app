/**
 * Aggregate Node
 * 
 * Combines research results into final output.
 * Enriches job listings with found information.
 */

import type { EmailWorkflowState, JobListing, JobResearchResult } from '../types'

// ============================================
// Aggregate Node
// ============================================

/**
 * Aggregate node function
 * Combines research results and enriches job data
 * 
 * @param state - Current workflow state
 * @returns Updated state with aggregated results
 */
export async function aggregateNode(
  state: EmailWorkflowState
): Promise<Partial<EmailWorkflowState>> {
  console.log('\n📊 [Aggregate] Combining results...')
  
  const startTime = Date.now()
  
  try {
    // Create a map of research results by job ID
    const researchMap = new Map<string, JobResearchResult>()
    for (const result of state.researchResults) {
      researchMap.set(result.jobId, result)
    }

    // Enrich jobs with research data
    const enrichedJobs: JobListing[] = state.jobs.map(job => {
      const research = researchMap.get(job.id)
      
      if (!research) {
        return job // No research for this job
      }

      // Merge research data into job
      return {
        ...job,
        // Enrich with found technologies
        technologies: [
          ...new Set([
            ...job.technologies,
            ...(research.technologies || []),
          ]),
        ],
        // Update extracted data with research findings
        extractedData: {
          ...job.extractedData,
          // Research results
          researchFound: research.found,
          researchSource: research.primarySource?.url,
          researchSourceType: research.primarySource?.sourceType,
          jobDescription: research.jobDescription?.substring(0, 2000), // Truncate for storage
          requirements: research.requirements,
          deadline: research.deadline,
          // Research metadata
          researchIterations: research.iterations,
          sourcesSearched: research.sourcesSearched.length,
        },
      }
    })

    // Calculate final statistics
    const matchedJobs = enrichedJobs.filter(j => j.matched)
    const researchedJobs = matchedJobs.filter(j => {
      const research = researchMap.get(j.id)
      return research?.found
    })

    const processingTime = Date.now() - startTime
    console.log(`✅ [Aggregate] Completed in ${processingTime}ms`)
    console.log(`   Total jobs: ${enrichedJobs.length}`)
    console.log(`   Matched: ${matchedJobs.length}`)
    console.log(`   Successfully researched: ${researchedJobs.length}`)

    // Build final summary
    const summary = buildSummary(enrichedJobs, state.researchResults)
    console.log(`\n📝 Summary:`)
    console.log(summary)

    return {
      jobs: enrichedJobs,
      currentPhase: 'complete',
      processingTimeMs: state.processingTimeMs + processingTime,
    }
  } catch (error) {
    console.error('❌ [Aggregate] Error:', error)
    
    return {
      errors: [...state.errors, `Aggregation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      currentPhase: 'error',
    }
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Build a human-readable summary of the analysis
 */
function buildSummary(jobs: JobListing[], researchResults: JobResearchResult[]): string {
  const matchedJobs = jobs.filter(j => j.matched)
  const researchMap = new Map(researchResults.map(r => [r.jobId, r]))
  
  if (matchedJobs.length === 0) {
    return 'No matching jobs found in this email.'
  }

  const lines: string[] = [
    `Found ${matchedJobs.length} matching job(s):`,
    '',
  ]

  for (const job of matchedJobs) {
    const research = researchMap.get(job.id)
    const status = research?.found ? '✓' : '✗'
    const source = research?.primarySource?.url 
      ? ` (${research.primarySource.sourceType})`
      : ''
    
    lines.push(`${status} ${job.position} at ${job.company}`)
    lines.push(`   Location: ${job.location || 'Not specified'}`)
    lines.push(`   Confidence: ${Math.round(job.confidence * 100)}%`)
    
    if (research?.found) {
      lines.push(`   Source: ${research.primarySource?.url?.substring(0, 50)}...${source}`)
      if (research.deadline) {
        lines.push(`   Deadline: ${research.deadline}`)
      }
      if (research.technologies && research.technologies.length > 0) {
        lines.push(`   Technologies: ${research.technologies.slice(0, 5).join(', ')}`)
      }
    } else if (research) {
      lines.push(`   Research: No public listing found after ${research.iterations} iterations`)
    }
    
    lines.push('')
  }

  return lines.join('\n')
}

// ============================================
// Exports
// ============================================

export { buildSummary }

