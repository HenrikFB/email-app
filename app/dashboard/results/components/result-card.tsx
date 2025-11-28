'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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

interface ResultCardProps {
  result: AnalyzedEmailResult
  onSourceSearch?: (sources: SourceSelectionPayload[]) => void
}

export default function ResultCard({ result, onSourceSearch }: ResultCardProps) {
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

  // NEW: Separate matched and rejected sources
  const matchedSources = result.data_by_source?.filter((s: any) => s.matched !== false) || []
  const rejectedSources = result.data_by_source?.filter((s: any) => s.matched === false) || []

  return (
    <Card className={cardClassName}>
      <CardHeader>
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
              onClick={() => setShowDetails(!showDetails)}
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
                  Query: "{result.kb_search_results.query}"
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
                      ✅ Matched Sources ({matchedSources.length})
                    </span>
                    {showMatchedSources ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-3">
                  {matchedSources.map((sourceData, sourceIdx) => {
                    const sourceKey = `${result.id}-matched-${sourceIdx}`
                    const isSelected = selectedSourceIds.includes(sourceKey)
                    const sourceMatched = true

                    return (
                      <div key={sourceKey} className="border-2 rounded-lg p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-green-300">
                        {/* Source Header */}
                        <div className="flex items-start justify-between mb-3 pb-3 border-b-2 border-green-200">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-xl">✅</span>
                              <span className="text-xl">
                                {sourceData.source === 'Email' ? '📧' : '🌐'}
                              </span>
                              <p className="text-base font-bold text-gray-900">
                                {sourceData.source === 'Email' ? 'From Email' : 'From URL'}
                              </p>
                              <Badge variant="default" className="ml-2 bg-green-600">
                                Matched
                              </Badge>
                            </div>
                            {sourceData.source !== 'Email' && (
                              <div className="ml-8 mt-2 space-y-1">
                                <a
                                  href={sourceData.source}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-700 hover:text-blue-900 hover:underline flex items-center space-x-1 font-medium"
                                >
                                  <span className="truncate max-w-lg font-mono text-xs">{sourceData.source}</span>
                                  <ExternalLink className="h-4 w-4 flex-shrink-0" />
                                </a>
                                <p className="text-xs text-gray-500 italic">
                                  ✓ Actual URL (resolved from SafeLinks redirect)
                                </p>
                              </div>
                            )}
                          </div>
                          <Badge 
                            variant="outline" 
                            className={`${getConfidenceColor(sourceData.confidence)} font-bold text-base px-3 py-1`}
                          >
                            {(sourceData.confidence * 100).toFixed(0)}% sure this matches
                          </Badge>
                          {onSourceSearch && (
                            <div className="ml-4 flex items-center space-x-1">
                              <Checkbox
                                id={`${sourceKey}-select`}
                                checked={isSelected}
                                onCheckedChange={() => toggleSourceSelection(sourceKey)}
                              />
                              <label
                                htmlFor={`${sourceKey}-select`}
                                className="text-xs text-muted-foreground cursor-pointer"
                              >
                                Include
                              </label>
                            </div>
                          )}
                        </div>

                        {/* Extracted Fields */}
                        <div className="space-y-3">
                          {Object.entries(sourceData.data).map(([key, value]) => (
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
                          ))}
                        </div>

                        {/* Reasoning */}
                        {sourceData.reasoning && (
                          <div className="mt-3 pt-3 border-t border-green-200">
                            <p className="text-xs text-gray-600 italic">
                              💭 {sourceData.reasoning}
                            </p>
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
                      ❌ Rejected Sources ({rejectedSources.length})
                    </span>
                    {showRejectedSources ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-3">
                  {rejectedSources.map((sourceData, sourceIdx) => {
                    const sourceKey = `${result.id}-rejected-${sourceIdx}`
                    const isSelected = selectedSourceIds.includes(sourceKey)
                    const sourceMatched = false

                    return (
                      <div key={sourceKey} className="border-2 rounded-lg p-4 bg-gradient-to-br from-red-50 to-orange-50 border-red-300">
                        {/* Source Header */}
                        <div className="flex items-start justify-between mb-3 pb-3 border-b-2 border-red-200">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-xl">❌</span>
                              <span className="text-xl">
                                {sourceData.source === 'Email' ? '📧' : '🌐'}
                              </span>
                              <p className="text-base font-bold text-gray-900">
                                {sourceData.source === 'Email' ? 'From Email' : 'From URL'}
                              </p>
                              <Badge variant="destructive" className="ml-2">
                                Rejected
                              </Badge>
                            </div>
                            {sourceData.source !== 'Email' && (
                              <div className="ml-8 mt-2 space-y-1">
                                <a
                                  href={sourceData.source}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-700 hover:text-blue-900 hover:underline flex items-center space-x-1 font-medium"
                                >
                                  <span className="truncate max-w-lg font-mono text-xs">{sourceData.source}</span>
                                  <ExternalLink className="h-4 w-4 flex-shrink-0" />
                                </a>
                                <p className="text-xs text-gray-500 italic">
                                  ✓ Actual URL (resolved from SafeLinks redirect)
                                </p>
                              </div>
                            )}
                          </div>
                          <Badge 
                            variant="outline" 
                            className="bg-red-100 text-red-800 font-bold text-base px-3 py-1"
                          >
                            {(sourceData.confidence * 100).toFixed(0)}% sure this doesn't match
                          </Badge>
                          {onSourceSearch && (
                            <div className="ml-4 flex items-center space-x-1">
                              <Checkbox
                                id={`${sourceKey}-select`}
                                checked={isSelected}
                                onCheckedChange={() => toggleSourceSelection(sourceKey)}
                              />
                              <label
                                htmlFor={`${sourceKey}-select`}
                                className="text-xs text-muted-foreground cursor-pointer"
                              >
                                Include
                              </label>
                            </div>
                          )}
                        </div>

                        {/* Extracted Fields */}
                        <div className="space-y-3">
                          {Object.entries(sourceData.data).map(([key, value]) => (
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
                          ))}
                        </div>

                        {/* Reasoning */}
                        {sourceData.reasoning && (
                          <div className="mt-3 pt-3 border-t border-red-200">
                            <p className="text-xs text-gray-600 italic">
                              💭 {sourceData.reasoning}
                            </p>
                          </div>
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

