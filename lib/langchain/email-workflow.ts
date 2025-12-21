/**
 * Email Workflow
 * 
 * Main LangGraph StateGraph orchestrating the email analysis pipeline.
 * 
 * Workflow:
 * 1. Clean Email - Convert HTML to plain text
 * 2. Analyze Email - Find jobs, extract entities, determine matches (based on email)
 * 3. Research - For matched jobs, use ReAct agent to find public descriptions
 * 4. Re-Evaluate - Re-check matches against full job descriptions
 * 5. Aggregate - Combine results into final output
 * 
 * The workflow uses conditional edges to skip research if no matches found.
 */

import { StateGraph, Annotation, START, END } from '@langchain/langgraph'
import { cleanEmailNode } from './nodes/clean-email'
import { analyzeEmailNode } from './nodes/analyze-email'
import { researchNode } from './nodes/research'
import { reEvaluateNode } from './nodes/re-evaluate'
import { aggregateNode } from './nodes/aggregate'
import { debugLog } from './utils/debug-logger'
import type { 
  EmailWorkflowState, 
  EmailInput, 
  AgentConfig,
  CleanedEmail,
  ExtractedEntities,
  JobListing,
  SearchQuery,
  JobResearchResult,
} from './types'

// ============================================
// State Annotation (LangGraph State Schema)
// ============================================

/**
 * Define the state schema using LangGraph Annotations
 * This defines how state is updated across nodes
 */
const EmailWorkflowAnnotation = Annotation.Root({
  // Input (set once at start)
  email: Annotation<EmailInput>,
  config: Annotation<AgentConfig>,
  userId: Annotation<string>,
  
  // Processing state (updated by nodes)
  cleanedEmail: Annotation<CleanedEmail | undefined>,
  entities: Annotation<ExtractedEntities | undefined>,
  jobs: Annotation<JobListing[]>({
    default: () => [],
    reducer: (current, update) => update, // Replace on update
  }),
  searchQueries: Annotation<SearchQuery[]>({
    default: () => [],
    reducer: (current, update) => update,
  }),
  
  // Research results
  researchResults: Annotation<JobResearchResult[]>({
    default: () => [],
    reducer: (current, update) => [...current, ...update], // Append results
  }),
  
  // Output state
  hasMatches: Annotation<boolean>({
    default: () => false,
    reducer: (_current, update) => update, // Replace
  }),
  processingTimeMs: Annotation<number>({
    default: () => 0,
    reducer: (current, update) => current + update, // Accumulate
  }),
  errors: Annotation<string[]>({
    default: () => [],
    reducer: (current, update) => [...current, ...update], // Append
  }),
  currentPhase: Annotation<EmailWorkflowState['currentPhase']>({
    default: () => 'init' as const,
    reducer: (_current, update) => update, // Replace
  }),
})

// Type for the annotated state
type AnnotatedState = typeof EmailWorkflowAnnotation.State

// ============================================
// Workflow Definition
// ============================================

/**
 * Build the email workflow graph
 * 
 * Graph structure:
 * START → cleanEmail → analyzeEmail → [conditional] → research → reEvaluate → aggregate → END
 *                                   ↘ (no matches) → END
 */
function buildEmailWorkflow() {
  // Create the workflow graph
  const workflow = new StateGraph(EmailWorkflowAnnotation)
    // Add nodes
    .addNode('cleanEmail', async (state: AnnotatedState) => {
      return cleanEmailNode(state as unknown as EmailWorkflowState)
    })
    .addNode('analyzeEmail', async (state: AnnotatedState) => {
      return analyzeEmailNode(state as unknown as EmailWorkflowState)
    })
    .addNode('research', async (state: AnnotatedState) => {
      return researchNode(state as unknown as EmailWorkflowState)
    })
    .addNode('reEvaluate', async (state: AnnotatedState) => {
      return reEvaluateNode(state as unknown as EmailWorkflowState)
    })
    .addNode('aggregate', async (state: AnnotatedState) => {
      return aggregateNode(state as unknown as EmailWorkflowState)
    })
    
    // Define edges
    .addEdge(START, 'cleanEmail')
    .addEdge('cleanEmail', 'analyzeEmail')
    
    // Conditional edge after analysis
    .addConditionalEdges('analyzeEmail', (state: AnnotatedState) => {
      // If there are matches, continue to research
      // Otherwise, skip to end
      if (state.hasMatches && state.jobs.filter(j => j.matched).length > 0) {
        console.log('\n🔀 [Router] Matches found → proceeding to research')
        return 'research'
      } else {
        console.log('\n🔀 [Router] No matches → completing workflow')
        return 'complete'
      }
    }, {
      research: 'research',
      complete: END,
    })
    
    // Research → Re-Evaluate → Aggregate
    .addEdge('research', 'reEvaluate')
    .addEdge('reEvaluate', 'aggregate')
    .addEdge('aggregate', END)

  // Compile and return
  return workflow.compile()
}

// ============================================
// Compiled Workflow (Singleton)
// ============================================

let compiledWorkflow: ReturnType<typeof buildEmailWorkflow> | null = null

/**
 * Get the compiled workflow (creates if not exists)
 */
function getWorkflow() {
  if (!compiledWorkflow) {
    console.log('📦 Building email workflow graph...')
    compiledWorkflow = buildEmailWorkflow()
    console.log('✅ Workflow compiled successfully')
  }
  return compiledWorkflow
}

// ============================================
// Main Entry Point
// ============================================

/**
 * Input for running the email workflow
 */
export interface RunEmailWorkflowInput {
  /** Raw email data from Microsoft Graph */
  email: EmailInput
  /** User's agent configuration */
  config: AgentConfig
  /** User ID for database operations */
  userId: string
}

/**
 * Result from the email workflow
 */
export interface EmailWorkflowResult {
  /** Whether the workflow completed successfully */
  success: boolean
  /** Jobs found in the email */
  jobs: JobListing[]
  /** Whether any jobs matched user criteria */
  hasMatches: boolean
  /** Research results for matched jobs */
  researchResults: JobResearchResult[]
  /** Extracted entities from email */
  entities?: ExtractedEntities
  /** Total processing time in milliseconds */
  processingTimeMs: number
  /** Any errors encountered */
  errors: string[]
  /** Final workflow phase */
  phase: string
}

/**
 * Run the email analysis workflow
 * 
 * This is the main entry point for analyzing an email.
 * 
 * @param input - Email and configuration
 * @returns Workflow result with jobs, matches, and research
 * 
 * @example
 * ```typescript
 * const result = await runEmailWorkflow({
 *   email: {
 *     id: 'msg-123',
 *     subject: 'New job opportunities',
 *     from: 'jobs@recruiter.com',
 *     to: ['you@email.com'],
 *     date: '2024-01-15',
 *     htmlBody: '<html>...</html>',
 *   },
 *   config: {
 *     id: 'config-123',
 *     matchCriteria: 'Software developer, React, TypeScript...',
 *     extractionFields: 'deadline, technologies, location...',
 *     draftGenerationEnabled: false,
 *     knowledgeBaseIds: [],
 *   },
 *   userId: 'user-123',
 * })
 * ```
 */
export async function runEmailWorkflow(
  input: RunEmailWorkflowInput
): Promise<EmailWorkflowResult> {
  const startTime = Date.now()
  
  // Initialize debug logging if enabled
  await debugLog.init(input.email.id, input.email.subject)
  
  console.log('\n' + '═'.repeat(70))
  console.log('🚀 EMAIL WORKFLOW - START')
  console.log('═'.repeat(70))
  console.log(`📧 Email: ${input.email.subject}`)
  console.log(`👤 From: ${input.email.from}`)
  console.log(`🎯 Config: ${input.config.id}`)
  console.log(`📏 Content: ${input.email.htmlBody.length} characters`)
  console.log('═'.repeat(70))
  
  // Log initial input
  await debugLog.logStep('workflow_start', {
    emailId: input.email.id,
    subject: input.email.subject,
    from: input.email.from,
    to: input.email.to,
    date: input.email.date,
    htmlBodyLength: input.email.htmlBody.length,
    config: {
      id: input.config.id,
      matchCriteria: input.config.matchCriteria,
      extractionFields: input.config.extractionFields,
      userIntent: input.config.userIntent,
    },
  }, null)

  try {
    // Get the compiled workflow
    const workflow = getWorkflow()

    // Run the workflow
    const result = await workflow.invoke({
      email: input.email,
      config: input.config,
      userId: input.userId,
      // Initialize empty arrays
      jobs: [],
      searchQueries: [],
      researchResults: [],
      errors: [],
      hasMatches: false,
      processingTimeMs: 0,
      currentPhase: 'init',
    })

    const totalTime = Date.now() - startTime

    // Count re-evaluated jobs
    const reEvaluatedJobs = result.jobs.filter((j: JobListing) => j.extractedData?._reEvaluated)
    const rejectedAfterReEval = result.jobs.filter((j: JobListing) => 
      j.extractedData?._reEvaluated && !j.matched && j.extractedData?._changedReason
    )

    console.log('\n' + '═'.repeat(70))
    console.log('✅ EMAIL WORKFLOW - COMPLETE')
    console.log('═'.repeat(70))
    console.log(`⏱️ Total time: ${(totalTime / 1000).toFixed(2)}s`)
    console.log(`📋 Jobs found: ${result.jobs.length}`)
    console.log(`✓ Final matches: ${result.jobs.filter((j: JobListing) => j.matched).length}`)
    console.log(`🔬 Researched: ${result.researchResults.length}`)
    console.log(`📊 Research success: ${result.researchResults.filter((r: JobResearchResult) => r.found).length}`)
    if (reEvaluatedJobs.length > 0) {
      console.log(`🔄 Re-evaluated: ${reEvaluatedJobs.length}`)
      if (rejectedAfterReEval.length > 0) {
        console.log(`❌ Rejected after full review: ${rejectedAfterReEval.length}`)
      }
    }
    console.log('═'.repeat(70) + '\n')

    const finalResult = {
      success: true,
      jobs: result.jobs,
      hasMatches: result.hasMatches,
      researchResults: result.researchResults,
      entities: result.entities,
      processingTimeMs: totalTime,
      errors: result.errors,
      phase: result.currentPhase,
    }
    
    // Log final result and finish debug session
    await debugLog.finish(finalResult)
    
    return finalResult
  } catch (error) {
    const totalTime = Date.now() - startTime
    console.error('\n❌ EMAIL WORKFLOW - ERROR:', error)
    
    const errorResult = {
      success: false,
      jobs: [],
      hasMatches: false,
      researchResults: [],
      processingTimeMs: totalTime,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      phase: 'error',
    }
    
    // Log error and finish debug session
    await debugLog.finish(errorResult)
    
    return errorResult
  }
}

// ============================================
// Utility: Stream Workflow (for real-time updates)
// ============================================

/**
 * Stream the email workflow with real-time updates
 * 
 * @param input - Email and configuration
 * @param onUpdate - Callback for state updates
 * @returns Final workflow result
 */
export async function streamEmailWorkflow(
  input: RunEmailWorkflowInput,
  onUpdate: (state: Partial<AnnotatedState>, nodeName: string) => void
): Promise<EmailWorkflowResult> {
  const startTime = Date.now()
  
  console.log('\n🌊 Starting workflow stream...')

  try {
    const workflow = getWorkflow()

    // Stream the workflow
    const stream = await workflow.stream({
      email: input.email,
      config: input.config,
      userId: input.userId,
      jobs: [],
      searchQueries: [],
      researchResults: [],
      errors: [],
      hasMatches: false,
      processingTimeMs: 0,
      currentPhase: 'init',
    })

    let finalState: AnnotatedState | null = null

    // Process stream chunks
    for await (const chunk of stream) {
      const [nodeName, state] = Object.entries(chunk)[0]
      console.log(`📍 [Stream] Node: ${nodeName}`)
      onUpdate(state as Partial<AnnotatedState>, nodeName)
      finalState = state as AnnotatedState
    }

    const totalTime = Date.now() - startTime

    if (!finalState) {
      throw new Error('Workflow produced no output')
    }

    return {
      success: true,
      jobs: finalState.jobs || [],
      hasMatches: finalState.hasMatches || false,
      researchResults: finalState.researchResults || [],
      entities: finalState.entities,
      processingTimeMs: totalTime,
      errors: finalState.errors || [],
      phase: finalState.currentPhase || 'complete',
    }
  } catch (error) {
    const totalTime = Date.now() - startTime
    console.error('❌ Stream error:', error)
    
    return {
      success: false,
      jobs: [],
      hasMatches: false,
      researchResults: [],
      processingTimeMs: totalTime,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      phase: 'error',
    }
  }
}

// ============================================
// Exports
// ============================================

export { 
  buildEmailWorkflow,
  getWorkflow,
  EmailWorkflowAnnotation,
}
export type { AnnotatedState }

