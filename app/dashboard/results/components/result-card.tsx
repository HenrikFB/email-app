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
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
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
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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

        {/* Extracted Data - Collapsible */}
        {/* Extracted Data by Source Section (NEW!) */}
        {result.matched && result.data_by_source && result.data_by_source.length > 0 && (
          <Collapsible open={showExtractedData} onOpenChange={setShowExtractedData}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="font-medium">📊 Extracted Data by Source ({result.data_by_source.length} sources)</span>
                {showExtractedData ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-3">
              {result.data_by_source.map((sourceData, sourceIdx) => {
                const sourceKey = `${result.id}-${sourceIdx}`
                const isSelected = selectedSourceIds.includes(sourceKey)

                return (
                  <div key={sourceKey} className="border-2 rounded-lg p-4 bg-gradient-to-br from-blue-50 to-purple-50">
                  {/* Source Header */}
                  <div className="flex items-start justify-between mb-3 pb-3 border-b-2 border-blue-200">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-xl">
                          {sourceData.source === 'Email' ? '📧' : '🌐'}
                        </span>
                        <p className="text-base font-bold text-gray-900">
                          {sourceData.source === 'Email' ? 'From Email' : 'From URL'}
                        </p>
                      </div>
                      {sourceData.source !== 'Email' && (
                        <a
                          href={sourceData.source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center space-x-1 ml-8 mt-1"
                        >
                          <span className="truncate max-w-md">{sourceData.source}</span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      )}
                    </div>
                    <Badge variant="outline" className={getConfidenceColor(sourceData.confidence)}>
                      {(sourceData.confidence * 100).toFixed(0)}%
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
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <p className="text-xs text-gray-600 italic">
                        💭 {sourceData.reasoning}
                      </p>
                    </div>
                  )}
                  </div>
                )
              })}
              {onSourceSearch && selectedSourceIds.length > 0 && (
                <div className="flex justify-end pt-2">
                  <Button size="sm" onClick={triggerSourceSearch}>
                    Search Selected Sources ({selectedSourceIds.length})
                  </Button>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
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
                  Scraped URLs ({result.scraped_urls.length}):
                </p>
                <ul className="space-y-1">
                  {result.scraped_urls.map((url, index) => (
                    <li key={index} className="flex items-center gap-1 text-xs text-green-800">
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

