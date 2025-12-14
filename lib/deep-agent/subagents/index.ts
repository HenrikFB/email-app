/**
 * Sub-Agents Index
 * 
 * Exports all sub-agent configurations for the deep agent pipeline.
 */

export { emailAnalyzerSubAgent } from './email-analyzer'
export { webResearcherSubAgent } from './web-researcher'
export { kbResearcherSubAgent } from './kb-researcher'
export { draftWriterSubAgent } from './draft-writer'

// Export all sub-agents as array
import { emailAnalyzerSubAgent } from './email-analyzer'
import { webResearcherSubAgent } from './web-researcher'
import { kbResearcherSubAgent } from './kb-researcher'
import { draftWriterSubAgent } from './draft-writer'

export const allSubAgents = [
  emailAnalyzerSubAgent,
  webResearcherSubAgent,
  kbResearcherSubAgent,
  draftWriterSubAgent,
]

