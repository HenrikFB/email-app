'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronDown, ChevronUp, ExternalLink, Database, Sparkles } from 'lucide-react'
import { deleteAnalyzedEmail } from '../actions'
import { EmailBodyViewer, ScrapedContentViewer } from '@/components/content-viewer'

interface SourcedData {
  source: string
  data: Record<string, unknown>
  reasoning: string
  confidence: number
}

// LangChain format for matched jobs
interface LangChainJobData {
  source_name?: string
  source_url?: string | null
  matched?: boolean
  company?: string
  position?: string
  location?: string
  confidence?: number
  matchReasoning?: string
  technologies?: string[]
  deadline?: string | null
  found?: boolean
  sourceType?: string
  iterations?: number
  // Additional extracted fields
  experience_level?: string
  competencies?: string[]
  company_domains?: string
  work_type?: string
  raw_content?: string
  // Re-evaluation fields
  reEvaluated?: boolean
  rejectedAfterReEval?: boolean
  rejectionReason?: string | null
}

interface SourceSelectionPayload {
  emailId: string
  sourceId: string
  label: string
  data: Record<string, unknown>
}

interface KBSearchResult {
  title: string
  kb_name: string
  similarity: number
  preview: string
}

interface AutoKBSearchResults {
  searchPerformedAt: string
  query: string
  results: KBSearchResult[]
  totalResults: number
}

export interface AnalyzedEmailResult {
  id: string
  email_subject: string
  email_from: string
  email_date: string
  email_snippet: string | null
  has_attachments: boolean
  extracted_data: Record<string, unknown>
  data_by_source?: SourcedData[]
  matched: boolean
  analysis_status: string
  error_message: string | null
  scraped_urls: string[] | null
  all_links_found: string[] | null
  email_html_body: string | null
  reasoning: string | null
  confidence: number | null
  analyzed_at: string | null
  agent_configuration_id?: string | null
  agent_configurations: {
    name: string
    email_address: string
    match_criteria: string | null
    extraction_fields: string | null
    button_text_pattern: string | null
  } | null
  scraped_content?: Record<string, { markdown: string; title?: string; scraped_at?: string }> | null
  // Auto KB search results
  kb_search_results?: AutoKBSearchResults | null
  kb_search_performed_at?: string | null
  auto_saved_to_kb_id?: string | null
}

interface JobData {
  id?: string
  source_name?: string
  source_url?: string | null
  matched?: boolean
  company?: string
  position?: string
  location?: string
  confidence?: number
  matchReasoning?: string
  technologies?: string[]
  deadline?: string | null
  found?: boolean
  sourceType?: string
  iterations?: number
  experience_level?: string
  competencies?: string[]
  company_domains?: string
  work_type?: string
  raw_content?: string
}

interface ResultCardProps {
  result: AnalyzedEmailResult
  onSourceSearch?: (sources: SourceSelectionPayload[]) => void
  onEmailClick?: () => void
  onJobClick?: (job: JobData) => void
  isSelected?: boolean
}

export default function ResultCard({ result, onSourceSearch, onEmailClick, onJobClick, isSelected }: ResultCardProps) {
  const [showExtractedData, setShowExtractedData] = useState(false)
  const [showRawData, setShowRawData] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([])
  const [showDetails, setShowDetails] = useState(false) // For collapsing entire result
  const [showMatchedSources, setShowMatchedSources] = useState(true) // For matched sources
  const [showRejectedSources, setShowRejectedSources] = useState(false) // For rejected sources
  const [showKBResults, setShowKBResults] = useState(true) // For KB search results

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const deleteResult = await deleteAnalyzedEmail(result.id)
      if (!deleteResult.success) {
        console.error('Failed to delete:', deleteResult.error)
        setIsDeleting(false)
        setShowDeleteConfirm(false)
      } else {
        // Force page reload to refresh the list
        window.location.reload()
      }
    } catch (error) {
      console.error('Error deleting:', error)
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default'
      case 'analyzing':
        return 'secondary'
      case 'failed':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const getConfidenceColor = (confidence: number | null) => {
    if (confidence === null) return 'text-gray-500'
    if (confidence >= 0.8) return 'text-green-600'
    if (confidence >= 0.5) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getConfidenceLabel = (confidence: number | null) => {
    if (confidence === null) return 'N/A'
    if (confidence >= 0.8) return 'High'
    if (confidence >= 0.5) return 'Medium'
    return 'Low'
  }

  // Determine card border and background based on match status
  const cardClassName = result.matched 
    ? 'border-green-200 bg-green-50/30' 
    : 'border-gray-200'

  const toggleSourceSelection = (sourceId: string) => {
    setSelectedSourceIds(prev => {
      const isSelected = prev.includes(sourceId)
      const newSelection = isSelected
        ? prev.filter(id => id !== sourceId)
        : [...prev, sourceId]
      
      console.log(`📋 [Result Card] Source selection toggled:`, {
        sourceId,
        action: isSelected ? 'deselected' : 'selected',
        totalSelected: newSelection.length
      })
      
      return newSelection
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const triggerSourceSearch = () => {
    if (!onSourceSearch || !result.data_by_source) {
      console.log('⚠️ [Result Card] Cannot trigger source search:', {
        hasOnSourceSearch: !!onSourceSearch,
        hasDataBySource: !!result.data_by_source
      })
      return
    }

    const payload = result.data_by_source
      .map((sourceData, idx) => ({
        emailId: result.id,
        sourceId: `${result.id}-${idx}`,
        label: sourceData.source === 'Email' ? 'Email' : sourceData.source,
        data: sourceData.data,
      }))
      .filter(item => selectedSourceIds.includes(item.sourceId))

    console.log('🔍 [Result Card] Triggering source search:', {
      selectedSourceIds,
      payloadCount: payload.length,
      sources: payload.map(p => ({ label: p.label, emailId: p.emailId }))
    })

    if (payload.length === 0) {
      console.log('⚠️ [Result Card] No sources selected')
      return
    }

    onSourceSearch(payload)
    setSelectedSourceIds([])
  }

  // Show delete confirmation dialog
  if (showDeleteConfirm) {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardHeader>
          <CardTitle className="text-red-900">Confirm Deletion</CardTitle>
          <CardDescription className="text-red-700">
            Are you sure you want to delete this analyzed email? This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="font-medium text-red-900">{result.email_subject}</p>
          <p className="text-sm text-red-800">From: {result.email_from}</p>
        </CardContent>
        <CardFooter className="flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={() => setShowDeleteConfirm(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </CardFooter>
      </Card>
    )
  }

  // Normalize data_by_source to always be an array
  // Handles both old format { results: [...] } and new format [...]
  const normalizedSources: (SourcedData | LangChainJobData)[] = (() => {
    if (Array.isArray(result.data_by_source)) {
      return result.data_by_source
    }
    if (result.data_by_source && typeof result.data_by_source === 'object') {
      const obj = result.data_by_source as Record<string, unknown>
      if (Array.isArray(obj.results)) {
        return obj.results as (SourcedData | LangChainJobData)[]
      }
    }
    return []
  })()
  
  // Separate matched and rejected sources
  const matchedSources = normalizedSources.filter((s) => (s as LangChainJobData).matched !== false) || []
  const rejectedSources = normalizedSources.filter((s) => (s as LangChainJobData).matched === false) || []

  return (
    <Card className={`${cardClassName} ${isSelected ? 'ring-2 ring-primary' : ''} ${onEmailClick ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}>
      <CardHeader onClick={onEmailClick}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{result.email_subject}</CardTitle>
            <CardDescription>
              From: {result.email_from} • {new Date(result.email_date).toLocaleString()}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant={getStatusColor(result.analysis_status)}>
              {result.analysis_status}
            </Badge>
            {result.matched && (
              <Badge variant="default">Matched</Badge>
            )}
            {result.has_attachments && (
              <Badge variant="secondary">📎 Attachments</Badge>
            )}
            {/* NEW: Add collapse/expand button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation() // Prevent email click when toggling details
                setShowDetails(!showDetails)
              }}
              className="ml-2"
            >
              {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {/* NEW: Make entire content collapsible */}
      {showDetails && (
      <CardContent className="space-y-4">
        {/* Email Summary - Top Section */}
        {result.agent_configurations && (
          <div className="rounded-md border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-4">
            <h3 className="text-lg font-bold text-indigo-900 mb-2">📋 Email Analysis Summary</h3>
            
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-semibold text-indigo-800">Agent Config:</span>
                <span className="ml-2 text-indigo-700">{result.agent_configurations.name}</span>
              </div>
              
              {result.agent_configurations.match_criteria && (
                <div>
                  <span className="font-semibold text-indigo-800">Match Criteria:</span>
                  <p className="mt-1 text-indigo-700 whitespace-pre-wrap">{result.agent_configurations.match_criteria}</p>
                </div>
              )}
              
              {result.agent_configurations.extraction_fields && (
                <div>
                  <span className="font-semibold text-indigo-800">Extraction Fields:</span>
                  <span className="ml-2 text-indigo-700">{result.agent_configurations.extraction_fields}</span>
                </div>
              )}
              
              {result.reasoning && (
                <div>
                  <span className="font-semibold text-indigo-800">Overall Reasoning:</span>
                  <p className="mt-1 text-indigo-700 italic">{result.reasoning}</p>
                </div>
              )}
              
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-indigo-200">
                <div>
                  <span className="font-semibold text-indigo-800">Scraped URLs:</span>
                  <span className="ml-2 text-indigo-700">{result.scraped_urls?.length || 0}</span>
                </div>
                <div>
                  <span className="font-semibold text-indigo-800">Data Sources:</span>
                  <span className="ml-2 text-indigo-700">{result.data_by_source?.length || 0}</span>
                </div>
                {result.confidence !== null && (
                  <div>
                    <span className="font-semibold text-indigo-800">Overall Confidence:</span>
                    <span className={`ml-2 font-bold ${getConfidenceColor(result.confidence)}`}>
                      {(result.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Reasoning - Prominent display */}
        {result.reasoning && (
          <div className="rounded-md border-l-4 border-blue-500 bg-blue-50 p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="mb-1 text-sm font-semibold text-blue-900">AI Reasoning</p>
                <p className="text-sm text-blue-800">{result.reasoning}</p>
              </div>
              {result.confidence !== null && (
                <Badge 
                  variant="outline" 
                  className={`ml-2 ${getConfidenceColor(result.confidence)}`}
                >
                  {getConfidenceLabel(result.confidence)} ({(result.confidence * 100).toFixed(0)}%)
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Auto KB Search Results */}
        {result.kb_search_results && result.kb_search_results.results.length > 0 && (
          <Collapsible open={showKBResults} onOpenChange={setShowKBResults}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 border-indigo-300">
                <span className="font-medium text-indigo-900 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                  Similar Content Found ({result.kb_search_results.totalResults})
                </span>
                {showKBResults ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="rounded-lg border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 p-4 space-y-3">
                <div className="text-xs text-indigo-700 flex items-center gap-2">
                  <Database className="h-3 w-3" />
                  <span>Auto-searched from Knowledge Bases</span>
                  {result.kb_search_performed_at && (
                    <span className="text-indigo-500">
                      • {new Date(result.kb_search_performed_at).toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="text-xs text-indigo-600 bg-indigo-100 px-2 py-1 rounded font-mono">
                  Query: &quot;{result.kb_search_results.query}&quot;
                </p>
                <div className="space-y-2">
                  {result.kb_search_results.results.slice(0, 5).map((kbResult, idx) => (
                    <div key={idx} className="bg-white rounded-md p-3 shadow-sm border border-indigo-100">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 text-sm">{kbResult.title}</p>
                          <p className="text-xs text-indigo-600">{kbResult.kb_name}</p>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            kbResult.similarity >= 0.7 ? 'text-green-600 border-green-300 bg-green-50' :
                            kbResult.similarity >= 0.5 ? 'text-yellow-600 border-yellow-300 bg-yellow-50' :
                            'text-gray-600'
                          }`}
                        >
                          {(kbResult.similarity * 100).toFixed(0)}%
                        </Badge>
                      </div>
                      {kbResult.preview && (
                        <p className="mt-2 text-xs text-gray-600 line-clamp-2">{kbResult.preview}</p>
                      )}
                    </div>
                  ))}
                </div>
                {result.auto_saved_to_kb_id && (
                  <div className="text-xs text-green-700 bg-green-50 p-2 rounded flex items-center gap-2">
                    ✅ Auto-saved to Knowledge Base
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Error message */}
        {result.error_message && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            <p className="font-medium">Error:</p>
            <p>{result.error_message}</p>
          </div>
        )}

        {/* Agent Configuration Reference */}
        {result.agent_configurations && (
          <div className="rounded-md bg-muted p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Agent Config: {result.agent_configurations?.name || result.agent_configurations?.email_address || 'N/A'}
            </p>
          </div>
        )}

        {/* Extracted Data - Separate Matched and Rejected */}
        {result.data_by_source && result.data_by_source.length > 0 && (
          <div className="space-y-4">
            {/* Matched Sources Section */}
            {matchedSources.length > 0 && (
              <Collapsible open={showMatchedSources} onOpenChange={setShowMatchedSources}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between bg-green-50 hover:bg-green-100 border-green-300">
                    <span className="font-medium text-green-900">
                      ✅ Matched Jobs ({matchedSources.length})
                    </span>
                    {showMatchedSources ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-3">
                  {matchedSources.map((sourceData: SourcedData | LangChainJobData, sourceIdx) => {
                    const sourceKey = `${result.id}-matched-${sourceIdx}`
                    const isSelected = selectedSourceIds.includes(sourceKey)
                    
                    // Handle both LangChain and legacy formats
                    const isLangChain = 'company' in sourceData || 'position' in sourceData
                    const langChainData = sourceData as LangChainJobData
                    const legacyData = sourceData as SourcedData
                    const company = isLangChain ? langChainData.company : ((legacyData.data?.company as string) || 'Unknown')
                    const position = isLangChain ? langChainData.position : ((legacyData.data?.position as string) || 'Unknown Position')
                    const location = isLangChain ? langChainData.location : (legacyData.data?.location as string | undefined)
                    const technologies = isLangChain ? langChainData.technologies : (legacyData.data?.technologies as string[] | undefined)
                    const deadline = isLangChain ? langChainData.deadline : (legacyData.data?.deadline as string | undefined)
                    const confidence = sourceData.confidence || 0
                    const reasoning = isLangChain ? langChainData.matchReasoning : legacyData.reasoning
                    const sourceUrl = isLangChain ? langChainData.source_url : legacyData.source
                    const found = langChainData.found
                    const sourceType = langChainData.sourceType
                    const iterations = langChainData.iterations

                    // Create job data for click handler
                    const jobDataForClick: JobData = {
                      id: sourceKey,
                      source_name: company || undefined,
                      source_url: sourceUrl || null,
                      matched: true,
                      company: company || undefined,
                      position: position || undefined,
                      location: location || undefined,
                      confidence: confidence,
                      matchReasoning: reasoning || undefined,
                      technologies: technologies,
                      deadline: deadline || null,
                      found: found,
                      sourceType: sourceType || undefined,
                      iterations: iterations,
                      experience_level: langChainData.experience_level,
                      competencies: langChainData.competencies,
                      company_domains: langChainData.company_domains,
                      work_type: langChainData.work_type,
                      raw_content: langChainData.raw_content,
                    }

                    return (
                      <div 
                        key={sourceKey} 
                        className="border-2 rounded-lg p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-green-300 cursor-pointer hover:border-green-400 hover:shadow-md transition-all"
                        onClick={() => onJobClick?.(jobDataForClick)}
                      >
                        {/* Job Header */}
                        <div className="flex items-start justify-between mb-4 pb-3 border-b-2 border-green-200">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="text-2xl">💼</span>
                              <div>
                                <h4 className="text-lg font-bold text-gray-900">{position}</h4>
                                <p className="text-sm text-gray-600">at <span className="font-semibold">{company}</span></p>
                            </div>
                            </div>
                            {sourceUrl && (
                                <a
                                href={sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline mt-1"
                                onClick={(e) => e.stopPropagation()}
                                >
                                <ExternalLink className="h-3 w-3" />
                                View Job Posting
                                </a>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                          <Badge 
                            variant="outline" 
                              className={`${getConfidenceColor(confidence)} font-bold text-sm px-3 py-1`}
                          >
                              {(confidence * 100).toFixed(0)}% match
                          </Badge>
                            {found !== undefined && (
                              <Badge variant={found ? "default" : "secondary"} className="text-xs">
                                {found ? '🔍 Researched' : '📧 From Email'}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Extraction Fields Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                          {location && (
                            <div className="bg-white rounded-md p-3 shadow-sm">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">📍 Location</p>
                              <p className="text-sm font-medium text-gray-900">{location}</p>
                            </div>
                          )}
                          
                          {deadline && (
                            <div className="bg-white rounded-md p-3 shadow-sm">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">📅 Deadline</p>
                              <p className="text-sm font-medium text-gray-900">{deadline}</p>
                        </div>
                          )}
                          
                          {sourceType && (
                            <div className="bg-white rounded-md p-3 shadow-sm">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">🌐 Source</p>
                              <p className="text-sm font-medium text-gray-900 capitalize">{sourceType}</p>
                            </div>
                          )}
                          
                          {langChainData.experience_level && (
                            <div className="bg-white rounded-md p-3 shadow-sm">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">📊 Experience</p>
                              <p className="text-sm font-medium text-gray-900">{langChainData.experience_level}</p>
                            </div>
                          )}
                          
                          {langChainData.work_type && (
                            <div className="bg-white rounded-md p-3 shadow-sm">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">🏢 Work Type</p>
                              <p className="text-sm font-medium text-gray-900">{langChainData.work_type}</p>
                            </div>
                          )}
                          
                          {iterations !== undefined && iterations > 0 && (
                            <div className="bg-white rounded-md p-3 shadow-sm">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">🔄 Research Iterations</p>
                              <p className="text-sm font-medium text-gray-900">{iterations}</p>
                            </div>
                          )}
                        </div>
                        
                        {/* Technologies */}
                        {technologies && technologies.length > 0 && (
                          <div className="bg-white rounded-md p-3 shadow-sm mb-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">🛠️ Technologies & Skills</p>
                            <div className="flex flex-wrap gap-2">
                              {technologies.map((tech: string, idx: number) => (
                                <Badge key={idx} variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                                  {tech}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Competencies */}
                        {langChainData.competencies && langChainData.competencies.length > 0 && (
                          <div className="bg-white rounded-md p-3 shadow-sm mb-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">🎯 Competencies</p>
                            <div className="flex flex-wrap gap-2">
                              {langChainData.competencies.map((comp: string, idx: number) => (
                                <Badge key={idx} variant="outline" className="text-gray-700">
                                  {comp}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Legacy format: show all data fields */}
                        {!isLangChain && legacyData.data && (
                          <div className="space-y-3 mb-4">
                            {Object.entries(legacyData.data).map(([key, value]) => {
                              // Skip fields we've already shown
                              if (['company', 'position', 'location', 'technologies', 'deadline'].includes(key)) return null
                              return (
                            <div key={key} className="bg-white rounded-md shadow-sm p-3">
                              <p className="text-sm font-semibold text-gray-800 mb-2 capitalize">
                                {key.replace(/_/g, ' ')}:
                              </p>
                              <div className="text-sm text-gray-900">
                                {Array.isArray(value) ? (
                                  <ul className="list-disc list-inside space-y-1 pl-2">
                                    {value.map((item, idx) => (
                                      <li key={idx} className="text-gray-800">{String(item)}</li>
                                    ))}
                                  </ul>
                                ) : typeof value === 'object' && value !== null ? (
                                  <pre className="text-xs overflow-x-auto bg-gray-100 p-2 rounded font-mono">
                                    {JSON.stringify(value, null, 2)}
                                  </pre>
                                ) : (
                                  <p className="text-gray-800">{String(value)}</p>
                                )}
                              </div>
                            </div>
                              )
                            })}
                        </div>
                        )}

                        {/* AI Reasoning */}
                        {reasoning && (
                          <div className="bg-blue-50 rounded-md p-3 border-l-4 border-blue-400">
                            <p className="text-xs font-semibold text-blue-800 mb-1">💭 Why this matches:</p>
                            <p className="text-sm text-blue-900">{reasoning}</p>
                          </div>
                        )}
                        
                        {/* Selection checkbox */}
                        {onSourceSearch && (
                          <div className="mt-3 pt-3 border-t border-green-200 flex items-center space-x-2">
                            <Checkbox
                              id={`${sourceKey}-select`}
                              checked={isSelected}
                              onCheckedChange={() => toggleSourceSelection(sourceKey)}
                            />
                            <label
                              htmlFor={`${sourceKey}-select`}
                              className="text-sm text-gray-600 cursor-pointer"
                            >
                              Include in knowledge base search
                            </label>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Rejected Sources Section */}
            {rejectedSources.length > 0 && (
              <Collapsible open={showRejectedSources} onOpenChange={setShowRejectedSources}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between bg-red-50 hover:bg-red-100 border-red-300">
                    <span className="font-medium text-red-900">
                      ❌ Rejected Jobs ({rejectedSources.length})
                    </span>
                    {showRejectedSources ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-3">
                  {rejectedSources.map((sourceData: SourcedData | LangChainJobData, sourceIdx) => {
                    const sourceKey = `${result.id}-rejected-${sourceIdx}`
                    
                    // Handle both LangChain and legacy formats
                    const isLangChain = 'company' in sourceData || 'position' in sourceData
                    const langChainData = sourceData as LangChainJobData
                    const legacyData = sourceData as SourcedData
                    const company = isLangChain ? langChainData.company : ((legacyData.data?.company as string) || 'Unknown')
                    const position = isLangChain ? langChainData.position : ((legacyData.data?.position as string) || 'Unknown Position')
                    const location = isLangChain ? langChainData.location : (legacyData.data?.location as string | undefined)
                    const technologies = isLangChain ? langChainData.technologies : (legacyData.data?.technologies as string[] | undefined)
                    const reasoning = isLangChain ? langChainData.matchReasoning : legacyData.reasoning
                    
                    // Create job data for click handler
                    const rejectedJobData: JobData = {
                      id: sourceKey,
                      source_name: company || undefined,
                      source_url: langChainData.source_url || null,
                      matched: false,
                      company: company || undefined,
                      position: position || undefined,
                      location: location || undefined,
                      confidence: sourceData.confidence || 0,
                      matchReasoning: reasoning || undefined,
                      technologies: technologies,
                      deadline: langChainData.deadline || null,
                      found: langChainData.found,
                      sourceType: langChainData.sourceType || undefined,
                      iterations: langChainData.iterations,
                      experience_level: langChainData.experience_level,
                      competencies: langChainData.competencies,
                      company_domains: langChainData.company_domains,
                      work_type: langChainData.work_type,
                      raw_content: langChainData.raw_content,
                    }

                    return (
                      <div 
                        key={sourceKey} 
                        className={`border rounded-lg p-3 cursor-pointer hover:shadow-md transition-all ${
                          langChainData.rejectedAfterReEval 
                            ? 'bg-orange-50 border-orange-300 hover:border-orange-400' 
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => onJobClick?.(rejectedJobData)}
                      >
                        {/* Job Header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{langChainData.rejectedAfterReEval ? '🔄' : '❌'}</span>
                            <div>
                              <p className="font-medium text-gray-700">{position}</p>
                              <p className="text-xs text-gray-500">at {company}</p>
                            </div>
                              </div>
                          <div className="flex flex-col items-end gap-1">
                          <Badge 
                            variant="outline" 
                              className={langChainData.rejectedAfterReEval 
                                ? 'text-orange-600 border-orange-400 bg-orange-100' 
                                : 'text-gray-500'
                              }
                          >
                              {langChainData.rejectedAfterReEval ? 'Rejected after review' : 'Not a match'}
                          </Badge>
                            {langChainData.reEvaluated && (
                              <span className="text-xs text-gray-400">✓ Full description reviewed</span>
                            )}
                          </div>
                        </div>

                        {/* Quick info */}
                        <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-2">
                          {location && <span>📍 {location}</span>}
                          {langChainData.experience_level && (
                            <span className={langChainData.rejectedAfterReEval ? 'text-orange-600 font-medium' : ''}>
                              📊 {langChainData.experience_level}
                            </span>
                          )}
                          {technologies && technologies.length > 0 && (
                            <span>🛠️ {technologies.slice(0, 3).join(', ')}{technologies.length > 3 ? '...' : ''}</span>
                          )}
                        </div>

                        {/* Re-evaluation Rejection Reason - Prominent */}
                        {langChainData.rejectedAfterReEval && langChainData.rejectionReason && (
                          <div className="bg-orange-100 rounded-md p-2 mb-2 border-l-4 border-orange-500">
                            <p className="text-xs font-semibold text-orange-800 mb-1">
                              🔍 Why this was rejected after reading full job description:
                            </p>
                            <p className="text-xs text-orange-900">
                              {langChainData.rejectionReason}
                            </p>
                          </div>
                        )}

                        {/* General Rejection Reasoning */}
                        {reasoning && !langChainData.rejectedAfterReEval && (
                          <p className="text-xs text-red-600 mt-2 italic">
                            💭 {reasoning}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}

        {/* Fallback: Show old aggregated data if data_by_source is not available */}
        {result.analysis_status === 'completed' && !result.data_by_source && result.extracted_data && Object.keys(result.extracted_data).length > 0 && (
          <Collapsible open={showExtractedData} onOpenChange={setShowExtractedData}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="font-medium">Extracted Data ({Object.keys(result.extracted_data).length} fields)</span>
                {showExtractedData ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="rounded-md border bg-white p-4">
                <pre className="overflow-x-auto text-xs">
                  {JSON.stringify(result.extracted_data, null, 2)}
                </pre>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Raw Data Section - Collapsible */}
        <Collapsible open={showRawData} onOpenChange={setShowRawData}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between text-muted-foreground">
              <span className="text-xs">View Raw Data & Debugging Info</span>
              {showRawData ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-3">
            {/* Links Found */}
            {result.all_links_found && result.all_links_found.length > 0 && (
              <div className="rounded-md border bg-gray-50 p-3">
                <p className="mb-2 text-xs font-medium">All Links Found ({result.all_links_found.length}):</p>
                <ul className="space-y-1">
                  {result.all_links_found.map((url, index) => (
                    <li key={index} className="flex items-center gap-1 text-xs">
                      <ExternalLink className="h-3 w-3" />
                      <a 
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="truncate hover:underline"
                      >
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Scraped URLs */}
            {result.scraped_urls && result.scraped_urls.length > 0 && (
              <div className="rounded-md border bg-green-50 p-3">
                <p className="mb-2 text-xs font-medium text-green-900">
                  ✓ Successfully Scraped URLs ({result.scraped_urls.length}):
                </p>
                <p className="mb-2 text-xs text-green-700 italic">
                  These are the actual URLs from Firecrawl (after following redirects)
                </p>
                <ul className="space-y-2">
                  {result.scraped_urls.map((url, index) => (
                    <li key={index} className="bg-white rounded p-2">
                      <div className="flex items-start gap-2">
                        <ExternalLink className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
                        <div className="flex-1 min-w-0">
                          <a 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-sm text-green-800 hover:underline font-medium break-all"
                          >
                            {url}
                          </a>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Email Body Viewer */}
            {result.email_html_body && (
              <div className="flex gap-2">
                <EmailBodyViewer
                  htmlBody={result.email_html_body}
                  triggerLabel="View Full Email Body"
                  triggerVariant="outline"
                  triggerSize="sm"
                />
              </div>
            )}

            {/* Scraped Content Viewer */}
            {result.scraped_content && Object.keys(result.scraped_content).length > 0 && (
              <ScrapedContentViewer
                scrapedContent={result.scraped_content}
                triggerLabel="View Scraped URLs"
                triggerVariant="outline"
                triggerSize="sm"
              />
            )}

            {/* Email Snippet */}
            {result.email_snippet && (
              <div className="rounded-md border bg-gray-50 p-3">
                <p className="mb-1 text-xs font-medium">Email Snippet:</p>
                <p className="text-xs text-muted-foreground">{result.email_snippet}</p>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
      )}
      <CardFooter className="flex justify-between items-center">
        <div className="text-xs text-muted-foreground">
          <span>Analyzed: {result.analyzed_at ? new Date(result.analyzed_at).toLocaleString() : 'N/A'}</span>
          {result.has_attachments && <span className="ml-2">📎 Has Attachments</span>}
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setShowDeleteConfirm(true)}
        >
          Delete
        </Button>
      </CardFooter>
    </Card>
  )
}

