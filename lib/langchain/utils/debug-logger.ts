/**
 * Debug Logger for LangChain Workflow
 * 
 * Saves detailed debug information to files for analysis.
 * Files are saved to /debug-langchain-runs/ which is gitignored.
 * 
 * Usage:
 *   import { debugLog } from './utils/debug-logger'
 *   await debugLog.init(emailId)
 *   await debugLog.logStep('analyze', inputData, outputData)
 *   await debugLog.finish()
 */

import * as fs from 'fs/promises'
import * as path from 'path'

const DEBUG_DIR = 'debug-langchain-runs'

interface DebugSession {
  sessionId: string
  emailId: string
  startTime: Date
  steps: DebugStep[]
}

interface DebugStep {
  stepName: string
  timestamp: Date
  durationMs?: number
  input: unknown
  output: unknown
  error?: string
}

class DebugLogger {
  private session: DebugSession | null = null
  private sessionDir: string = ''
  private enabled: boolean = false

  /**
   * Check if debug logging is enabled
   */
  isEnabled(): boolean {
    return process.env.DEBUG_LANGCHAIN === 'true' || process.env.NODE_ENV === 'development'
  }

  /**
   * Initialize a new debug session for an email analysis
   */
  async init(emailId: string, emailSubject?: string): Promise<void> {
    if (!this.isEnabled()) {
      return
    }

    this.enabled = true
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const sessionId = `${timestamp}_${emailId.substring(0, 8)}`

    // Create debug directory
    this.sessionDir = path.join(process.cwd(), DEBUG_DIR, sessionId)
    
    try {
      await fs.mkdir(this.sessionDir, { recursive: true })
      
      this.session = {
        sessionId,
        emailId,
        startTime: new Date(),
        steps: [],
      }

      // Save session metadata
      await this.saveFile('_session.json', {
        sessionId,
        emailId,
        emailSubject,
        startTime: this.session.startTime.toISOString(),
      })

      console.log(`📝 Debug logging enabled: ${this.sessionDir}`)
    } catch (error) {
      console.warn('⚠️ Could not initialize debug logging:', error)
      this.enabled = false
    }
  }

  /**
   * Log a workflow step with input and output
   */
  async logStep(
    stepName: string,
    input: unknown,
    output: unknown,
    durationMs?: number,
    error?: string
  ): Promise<void> {
    if (!this.enabled || !this.session) {
      return
    }

    const step: DebugStep = {
      stepName,
      timestamp: new Date(),
      durationMs,
      input,
      output,
      error,
    }

    this.session.steps.push(step)

    // Save step to individual file for easy inspection
    const stepIndex = this.session.steps.length.toString().padStart(2, '0')
    const fileName = `${stepIndex}_${stepName}.json`

    await this.saveFile(fileName, {
      step: stepName,
      timestamp: step.timestamp.toISOString(),
      durationMs,
      error,
      input: this.sanitizeForJson(input),
      output: this.sanitizeForJson(output),
    })
  }

  /**
   * Log just research results for detailed inspection
   */
  async logResearchResult(
    jobCompany: string,
    jobPosition: string,
    researchResult: unknown
  ): Promise<void> {
    if (!this.enabled || !this.session) {
      return
    }

    const safeCompany = jobCompany.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)
    const fileName = `research_${safeCompany}.json`

    await this.saveFile(fileName, {
      company: jobCompany,
      position: jobPosition,
      timestamp: new Date().toISOString(),
      result: this.sanitizeForJson(researchResult),
    })
  }

  /**
   * Log re-evaluation details
   */
  async logReEvaluation(
    jobCompany: string,
    originalMatch: boolean,
    newMatch: boolean,
    fullDescription: string | undefined,
    reasoning: string
  ): Promise<void> {
    if (!this.enabled || !this.session) {
      return
    }

    const safeCompany = jobCompany.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)
    const fileName = `reeval_${safeCompany}.json`

    await this.saveFile(fileName, {
      company: jobCompany,
      timestamp: new Date().toISOString(),
      originalMatch,
      newMatch,
      matchChanged: originalMatch !== newMatch,
      descriptionLength: fullDescription?.length || 0,
      descriptionPreview: fullDescription?.substring(0, 2000) || '[NO DESCRIPTION]',
      reasoning,
    })
  }

  /**
   * Finish the debug session and save summary
   */
  async finish(finalResult: unknown): Promise<void> {
    if (!this.enabled || !this.session) {
      return
    }

    const endTime = new Date()
    const totalDuration = endTime.getTime() - this.session.startTime.getTime()

    // Save final summary
    await this.saveFile('_summary.json', {
      sessionId: this.session.sessionId,
      emailId: this.session.emailId,
      startTime: this.session.startTime.toISOString(),
      endTime: endTime.toISOString(),
      totalDurationMs: totalDuration,
      totalDurationReadable: `${(totalDuration / 1000).toFixed(1)}s`,
      stepsCount: this.session.steps.length,
      steps: this.session.steps.map(s => ({
        name: s.stepName,
        durationMs: s.durationMs,
        hasError: !!s.error,
      })),
      finalResult: this.sanitizeForJson(finalResult),
    })

    console.log(`📝 Debug session saved: ${this.sessionDir}`)
    this.session = null
    this.enabled = false
  }

  /**
   * Save a file to the session directory
   */
  private async saveFile(fileName: string, data: unknown): Promise<void> {
    if (!this.sessionDir) return

    try {
      const filePath = path.join(this.sessionDir, fileName)
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
    } catch (error) {
      console.warn(`⚠️ Could not save debug file ${fileName}:`, error)
    }
  }

  /**
   * Sanitize data for JSON serialization
   * Handles circular references, functions, etc.
   */
  private sanitizeForJson(data: unknown): unknown {
    if (data === null || data === undefined) {
      return data
    }

    if (typeof data === 'function') {
      return '[Function]'
    }

    if (typeof data === 'symbol') {
      return '[Symbol]'
    }

    if (data instanceof Date) {
      return data.toISOString()
    }

    if (data instanceof Error) {
      return {
        name: data.name,
        message: data.message,
        stack: data.stack,
      }
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeForJson(item))
    }

    if (typeof data === 'object') {
      const sanitized: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        // Skip internal/private keys and very large content
        if (key.startsWith('_') && key !== '_reEvaluated' && key !== '_changedReason') {
          continue
        }
        
        // Truncate very long strings
        if (typeof value === 'string' && value.length > 10000) {
          sanitized[key] = value.substring(0, 10000) + `\n... [TRUNCATED - original ${value.length} chars]`
        } else {
          sanitized[key] = this.sanitizeForJson(value)
        }
      }
      return sanitized
    }

    return data
  }
}

// Export singleton instance
export const debugLog = new DebugLogger()

// Export type for external use
export type { DebugSession, DebugStep }

