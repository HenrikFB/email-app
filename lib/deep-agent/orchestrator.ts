/**
 * Deep Agent Orchestrator
 * 
 * Main orchestrator for the Deep Agent email analysis pipeline.
 * Uses the deepagents library with sub-agents for:
 * - Email analysis
 * - Web research (Tavily)
 * - Knowledge base search
 * - Draft generation
 */

import { createDeepAgent, StateBackend } from 'deepagents'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage } from '@langchain/core/messages'
import { MODEL_CONFIG, LOG_CONFIG } from './config'
import { allSubAgents } from './subagents'
import type {
  DeepAgentInput,
  DeepAgentResult,
} from './types'
import * as fs from 'fs'
import * as path from 'path'

// ============================================
// Debug Logging System
// ============================================

const DEBUG_DIR = path.join(process.cwd(), 'debug-deep-agent')

function ensureDebugDir(): string {
  if (!fs.existsSync(DEBUG_DIR)) {
    fs.mkdirSync(DEBUG_DIR, { recursive: true })
  }
  return DEBUG_DIR
}

function createRunDir(runId: string): string {
  const runDir = path.join(ensureDebugDir(), runId)
  if (!fs.existsSync(runDir)) {
    fs.mkdirSync(runDir, { recursive: true })
  }
  return runDir
}

function logToFile(runDir: string, filename: string, content: string | object): void {
  const filePath = path.join(runDir, filename)
  const data = typeof content === 'object' ? JSON.stringify(content, null, 2) : content
  fs.writeFileSync(filePath, data, 'utf-8')
}

function appendToLog(runDir: string, content: string): void {
  const filePath = path.join(runDir, 'execution.log')
  const timestamp = new Date().toISOString()
  fs.appendFileSync(filePath, `[${timestamp}] ${content}\n`, 'utf-8')
}

// ============================================
// Singleton Agent (Required due to LangGraph channel registry)
// ============================================

/**
 * CRITICAL: LangGraph channels are registered globally.
 * We MUST use a singleton pattern - creating multiple agents causes
 * "Channel already exists" errors because sub-agents register "files" channel.
 * 
 * StateBackend handles per-invocation state, so reusing the agent is safe.
 */

// Use process-level storage (survives hot reloads better than global)
// This is a workaround for LangGraph's global channel registry issue
const AGENT_STORAGE_KEY = '__deepAgentSingleton'

// Type declarations for global storage
declare global {
  // eslint-disable-next-line no-var
  var __deepAgentSingleton: ReturnType<typeof createDeepAgent> | null | undefined
}

/**
 * Get or create the singleton deep agent instance
 * This MUST be a singleton to avoid LangGraph channel conflicts
 * 
 * CRITICAL ISSUE: LangGraph registers channels globally. Each sub-agent creates
 * a "files" channel, and if we try to create multiple agents, they conflict.
 * 
 * This is a known limitation of LangGraph/deepagents in Next.js dev mode.
 */
function getOrCreateAgent(): ReturnType<typeof createDeepAgent> {
  // Check process-level storage first (survives hot reloads)
  // Use type assertion since we're storing on process object
  const processStorage = process as typeof process & { [key: string]: any }
  if (processStorage[AGENT_STORAGE_KEY]) {
    return processStorage[AGENT_STORAGE_KEY]
  }
  
  // Also check global as fallback
  if (global.__deepAgentSingleton) {
    return global.__deepAgentSingleton
  }

  // Create the agent once
  const model = new ChatOpenAI({
    modelName: MODEL_CONFIG.orchestrator,
    temperature: 0.3,
  })

  const orchestratorPrompt = `You are an intelligent email analysis orchestrator. Your job is to coordinate specialized sub-agents to analyze emails based on USER-DEFINED criteria provided in each task.

WORKFLOW:
1. Delegate email analysis to the email-analyzer sub-agent
2. If the email matches criteria, delegate web research to find relevant public sources
3. Search the user's knowledge base for content matching the extracted data
4. If draft generation is enabled, delegate to the draft-writer sub-agent

IMPORTANT:
- Use the task() tool to delegate work to sub-agents
- Keep your context clean by letting sub-agents handle detailed work
- Return concise summaries from each phase
- Always respect the user's match_criteria and extraction_fields provided in the task

Return a final summary with:
- Match decision (yes/no) with confidence
- Extracted data (matching the user's extraction_fields)
- Sources found (web + KB)
- Generated draft (if applicable)`

  // Convert sub-agents to deepagents format
  const subagents = allSubAgents.map(sa => {
    let genericPrompt = sa.systemPrompt
    
    genericPrompt = genericPrompt
      .replace(/\{\{match_criteria\}\}/g, 'the user\'s match criteria (provided in the task)')
      .replace(/\{\{extraction_fields\}\}/g, 'the user\'s extraction fields (provided in the task)')
      .replace(/\{\{user_intent\}\}/g, 'the user\'s intent (provided in the task)')
      .replace(/\{\{draft_enabled\}\}/g, 'draft generation status (provided in the task)')
      .replace(/\{\{draft_instructions\}\}/g, 'draft instructions (provided in the task)')
    
    return {
      name: sa.name,
      description: sa.description,
      systemPrompt: genericPrompt,
      tools: sa.tools,
      model: sa.model,
    }
  })

  // Use StateBackend - stores files in state per-invocation
  // The agent itself is a singleton, but StateBackend ensures per-invocation isolation
  try {
    const agent = createDeepAgent({
      model,
      systemPrompt: orchestratorPrompt,
      subagents,
      backend: (config) => new StateBackend(config),
    })

    // Store in both process and global for maximum persistence
    const processStorage = process as typeof process & { [key: string]: any }
    processStorage[AGENT_STORAGE_KEY] = agent
    global.__deepAgentSingleton = agent
    return agent
  } catch (error) {
    // If channel conflict, it means channels were registered in a previous run
    // This is a KNOWN BUG/LIMITATION of LangGraph in Next.js dev mode
    if (error instanceof Error && error.message.includes('Channel') && error.message.includes('already exists')) {
      const errorMsg = `❌ LangGraph Channel Conflict (Known Issue)

This is a known limitation of LangGraph/deepagents in Next.js development mode.

ROOT CAUSE:
- LangGraph registers channels in a global registry
- Each sub-agent creates a "files" channel  
- These channels persist even after module reload
- Next.js hot reload clears variables but NOT LangGraph's global registry

SOLUTIONS:
1. Restart dev server: Ctrl+C then 'npm run dev'
2. Use production build: 'npm run build && npm start' (no hot reload)
3. This is a deepagents/LangGraph limitation, not our code

The deepagents library (v1.3.0) has this issue with Next.js dev mode.
Consider reporting to: https://github.com/langchain-ai/deepagentsjs/issues`
      
      console.error('\n' + '═'.repeat(70))
      console.error('❌ DEEP AGENT CREATION FAILED')
      console.error('═'.repeat(70))
      console.error(errorMsg)
      console.error('═'.repeat(70) + '\n')
      
      throw new Error(errorMsg)
    }
    throw error
  }
}

// ============================================
// Main Pipeline Function
// ============================================

/**
 * Run the deep agent pipeline for email analysis
 */
export async function runDeepAgentPipeline(input: DeepAgentInput): Promise<DeepAgentResult> {
  const startTime = Date.now()
  const runId = `${Date.now()}-${input.emailId.substring(0, 16).replace(/[^a-zA-Z0-9]/g, '')}`
  const runDir = createRunDir(runId)

  console.log('\n' + '═'.repeat(70))
  console.log('🤖 DEEP AGENT PIPELINE - START')
  console.log('═'.repeat(70))
  console.log(`📧 Email ID: ${input.emailId}`)
  console.log(`🎯 Match Criteria: ${input.config.matchCriteria}`)
  console.log(`📝 Draft Enabled: ${input.config.draftGenerationEnabled}`)
  console.log(`📁 Debug Dir: ${runDir}`)
  console.log('─'.repeat(70))

  // Log input to file
  appendToLog(runDir, `Starting deep agent pipeline`)
  appendToLog(runDir, `Email ID: ${input.emailId}`)
  appendToLog(runDir, `Draft Enabled: ${input.config.draftGenerationEnabled}`)
  logToFile(runDir, '01-input.json', input)

  try {
    // Get or create the singleton agent instance
    // MUST be singleton to avoid LangGraph channel conflicts
    appendToLog(runDir, 'Getting or creating singleton deep agent...')
    let agent: ReturnType<typeof createDeepAgent>
    
    try {
      agent = getOrCreateAgent()
      appendToLog(runDir, 'Agent retrieved/created successfully')
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      appendToLog(runDir, `Agent creation FAILED: ${errorMsg}`)
      logToFile(runDir, 'agent-creation-error.txt', `${errorMsg}\n\n${error instanceof Error ? error.stack : ''}`)
      throw error // Re-throw - no fallback!
    }

    appendToLog(runDir, 'Building orchestration task...')

    // Build the orchestration task
    const task = buildOrchestrationTask(input)
    logToFile(runDir, '02-task.txt', task)
    appendToLog(runDir, `Task built (${task.length} chars)`)

    if (LOG_CONFIG.verbose) {
      console.log('\n📋 Orchestration Task:')
      console.log(task.substring(0, 500) + '...')
    }

    // Run the agent
    appendToLog(runDir, 'Invoking deep agent...')
    
    const result = await agent.invoke(
      { 
        messages: [new HumanMessage(task)] 
      },
      { 
        recursionLimit: 50,
      }
    )

    logToFile(runDir, '03-raw-result.json', result)
    appendToLog(runDir, `Agent completed, got ${result?.messages?.length || 0} messages`)

    // Parse the result
    const parsedResult = parseAgentResult(result, input)
    logToFile(runDir, '04-parsed-result.json', parsedResult)
    
    const processingTime = Date.now() - startTime
    appendToLog(runDir, `Pipeline complete in ${processingTime}ms`)

    console.log('\n' + '═'.repeat(70))
    console.log(`✅ DEEP AGENT PIPELINE COMPLETE (${(processingTime / 1000).toFixed(1)}s)`)
    console.log('═'.repeat(70))
    console.log(`Result: ${parsedResult.matched ? '✓ MATCHED' : '✗ No match'}`)
    console.log(`Confidence: ${(parsedResult.confidence * 100).toFixed(0)}%`)
    if (parsedResult.generatedDraft) {
      console.log(`Draft: Generated (${parsedResult.generatedDraft.content.length} chars)`)
    }
    console.log('═'.repeat(70) + '\n')

    // Write summary
    logToFile(runDir, 'SUMMARY.md', `# Deep Agent Run Summary

**Run ID:** ${runId}
**Email ID:** ${input.emailId}
**Processing Time:** ${(processingTime / 1000).toFixed(1)}s

## Configuration
- Match Criteria: ${input.config.matchCriteria.substring(0, 100)}...
- Extraction Fields: ${input.config.extractionFields}
- Draft Enabled: ${input.config.draftGenerationEnabled}
- Draft Instructions: ${input.config.draftInstructions || 'None'}
- KB IDs: ${input.config.knowledgeBaseIds.join(', ') || 'None'}

## Result
- **Matched:** ${parsedResult.matched}
- **Confidence:** ${(parsedResult.confidence * 100).toFixed(0)}%
- **Success:** ${parsedResult.success}

## Reasoning
${parsedResult.reasoning}

## Extracted Data
\`\`\`json
${JSON.stringify(parsedResult.extractedData, null, 2)}
\`\`\`

## Sources
- Web Sources: ${parsedResult.webSourcesSearched.length}
- KB Sources: ${parsedResult.kbSourcesFound.length}

${parsedResult.generatedDraft ? `## Generated Draft
${parsedResult.generatedDraft.content.substring(0, 500)}...
` : ''}
`)

    return {
      ...parsedResult,
      processingTimeMs: processingTime,
    }
  } catch (error) {
    const processingTime = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    
    appendToLog(runDir, `ERROR: ${errorMsg}`)
    logToFile(runDir, 'ERROR.txt', `${errorMsg}\n\n${error instanceof Error ? error.stack : ''}`)
    
    console.error('\n❌ DEEP AGENT PIPELINE FAILED:', error)
    
    return {
      success: false,
      emailId: input.emailId,
      matched: false,
      extractedData: {},
      confidence: 0,
      reasoning: 'Pipeline failed: ' + errorMsg,
      webSourcesSearched: [],
      kbSourcesFound: [],
      processingTimeMs: processingTime,
      error: errorMsg,
    }
  }
}

// ============================================
// Task Building
// ============================================

function buildOrchestrationTask(input: DeepAgentInput): string {
  const { config, emailId, userId, agentConfigId } = input

  return `Analyze email and potentially generate a draft.

== CONFIGURATION ==
User ID: ${userId}
Agent Config ID: ${agentConfigId}
Email ID: ${emailId}

Match Criteria: ${config.matchCriteria}
Extraction Fields: ${config.extractionFields}
${config.userIntent ? `User Intent: ${config.userIntent}` : ''}
Knowledge Base IDs: ${config.knowledgeBaseIds.join(', ') || 'None assigned'}
Draft Generation: ${config.draftGenerationEnabled ? 'ENABLED' : 'Disabled'}
${config.draftInstructions ? `Draft Instructions: ${config.draftInstructions}` : ''}

== YOUR WORKFLOW ==

STEP 1: EMAIL ANALYSIS
Delegate to email-analyzer sub-agent:
- Parse the email to extract content
- Extract entities (companies, technologies, locations, skills)
- Determine if email matches the criteria
- Get structured extracted data
- Get search terms for research

If the email does NOT match, return early with the analysis results.

STEP 2: WEB RESEARCH (if matched)
Delegate to web-researcher sub-agent:
- Search for companies mentioned in the email
- Find public job postings or career pages
- Gather additional context
- Return concise summaries

STEP 3: KB RESEARCH (if matched and KBs assigned)
Delegate to kb-researcher sub-agent:
- Search for relevant content from user's knowledge base
- Search EACH technology/skill SEPARATELY
- Find cover letters, project descriptions, past applications
- Analyze coverage (what content exists vs. gaps)

STEP 4: DRAFT GENERATION (if enabled and matched)
Delegate to draft-writer sub-agent:
- Generate draft based on user's instructions
- Use KB content as style reference
- Incorporate extracted data
- Self-critique and refine

== OUTPUT FORMAT ==
Return a JSON summary with:
{
  "matched": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "explanation",
  "extractedData": { ... },
  "entities": {
    "companies": [],
    "technologies": [],
    "locations": [],
    "skills": []
  },
  "webResearch": {
    "sources": [{ "url": "", "summary": "" }]
  },
  "kbResearch": {
    "documentsFound": [],
    "coverage": { "found": [], "missing": [] }
  },
  "draft": {
    "content": "...",
    "sourcesUsed": []
  }
}

Begin by delegating email analysis to the email-analyzer sub-agent.`
}

// ============================================
// Result Parsing
// ============================================

function parseAgentResult(agentResult: { messages?: Array<{ content?: string }> }, input: DeepAgentInput): Omit<DeepAgentResult, 'processingTimeMs'> {
  try {
    const messages = agentResult.messages || []
    const lastMessage = messages[messages.length - 1]
    const content = lastMessage?.content || ''

    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      
      return {
        success: true,
        emailId: input.emailId,
        matched: parsed.matched || false,
        extractedData: parsed.extractedData || {},
        confidence: parsed.confidence || 0,
        reasoning: parsed.reasoning || '',
        webSourcesSearched: (parsed.webResearch?.sources || []).map((s: { url?: string; title?: string; summary?: string; content?: string; score?: number }) => ({
          url: s.url || '',
          title: s.title || '',
          content: s.summary || s.content || '',
          score: s.score || 0,
        })),
        kbSourcesFound: (parsed.kbResearch?.documentsFound || []).map((d: { documentId?: string; id?: string; title?: string; documentTitle?: string; knowledgeBaseId?: string; knowledgeBaseName?: string; chunkId?: string; content?: string; snippet?: string; similarity?: number; sourceQuery?: string; matchType?: string }) => ({
          documentId: d.documentId || d.id || '',
          documentTitle: d.title || d.documentTitle || '',
          knowledgeBaseId: d.knowledgeBaseId || '',
          knowledgeBaseName: d.knowledgeBaseName || '',
          chunkId: d.chunkId || '',
          content: d.snippet || d.content?.substring(0, 500) || '',
          similarity: d.similarity || 0,
          matchType: (d.matchType as 'hybrid' | 'semantic' | 'fulltext') || 'hybrid',
          sourceQuery: d.sourceQuery || '',
        })),
        generatedDraft: parsed.draft ? {
          content: parsed.draft.content || '',
          kbSourcesUsed: parsed.draft.sourcesUsed || [],
          metadata: {
            reasoning: parsed.draft.reasoning || 'Generated by deep agent',
            iterations: parsed.draft.iterations || 1,
            searchQueries: [],
            confidence: parsed.draft.confidence || parsed.confidence || 0.8,
            modelUsed: MODEL_CONFIG.draftWriter,
            processingTimeMs: 0,
            webSourcesSearched: [],
          },
        } : undefined,
      }
    }

    // Fallback: extract what we can from the text
    return {
      success: true,
      emailId: input.emailId,
      matched: content.toLowerCase().includes('matched: true') || 
               content.toLowerCase().includes('"matched": true'),
      extractedData: {},
      confidence: 0.5,
      reasoning: content.substring(0, 500),
      webSourcesSearched: [],
      kbSourcesFound: [],
    }
  } catch (error) {
    console.error('Failed to parse agent result:', error)
    
    return {
      success: false,
      emailId: input.emailId,
      matched: false,
      extractedData: {},
      confidence: 0,
      reasoning: 'Failed to parse result',
      webSourcesSearched: [],
      kbSourcesFound: [],
      error: error instanceof Error ? error.message : 'Parse error',
    }
  }
}

// ============================================
// Exports
// ============================================

/**
 * Create a deep agent instance (for testing/external use)
 * Returns the singleton instance
 */
export function createEmailDeepAgent() {
  return getOrCreateAgent()
}

