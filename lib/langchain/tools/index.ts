/**
 * LangChain Tools Index
 * 
 * Export all tools for the email workflow agents.
 */

export { tavilySearchTool, smartJobSearchTool, searchTools } from './tavily-search'
export { tavilyExtractTool, extractJobDescriptionTool, extractTools } from './tavily-extract'

import { searchTools } from './tavily-search'
import { extractTools } from './tavily-extract'

/**
 * All research tools combined
 * Used by the research agent for iterative job research
 */
export const allResearchTools = [
  ...searchTools,
  ...extractTools,
]

