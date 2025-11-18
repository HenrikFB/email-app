'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, ExternalLink, Database, Mail } from 'lucide-react'
import { searchSimilar } from '../actions'
import { listKnowledgeBases, getAssignedKBs, type KnowledgeBase } from '../../knowledge-base/actions'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'

type SelectedSource = {
  emailId: string
  sourceId: string
  label: string
  data: any
}

interface SearchModalProps {
  open: boolean
  onClose: () => void
  selectedEmailIds: string[]
  emails: any[]
  agentConfigId?: string
  selectedSources?: SelectedSource[]
}

export default function SearchModal({
  open,
  onClose,
  selectedEmailIds,
  emails,
  agentConfigId,
  selectedSources = [],
}: SearchModalProps) {
  const [query, setQuery] = useState('')
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [selectedKBIds, setSelectedKBIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingKBs, setLoadingKBs] = useState(false)
  const [kbResults, setKBResults] = useState<any[]>([])
  const [emailResults, setEmailResults] = useState<any[]>([])
  const [searched, setSearched] = useState(false)
  const [similarityThreshold, setSimilarityThreshold] = useState(0.3)
  const [expandedKBResults, setExpandedKBResults] = useState<Record<string, boolean>>({})
  const [expandedEmailResults, setExpandedEmailResults] = useState<Record<string, boolean>>({})
  const thresholdPercent = Math.round(similarityThreshold * 100)
  const selectedKBs = knowledgeBases.filter(kb => selectedKBIds.includes(kb.id))

  useEffect(() => {
    if (open) {
      loadKnowledgeBases()
      generateQuery(selectedSources)
    } else {
      setSearched(false)
      setKBResults([])
      setEmailResults([])
      setExpandedKBResults({})
      setExpandedEmailResults({})
    }
  }, [open, selectedEmailIds, selectedSources])

  const loadKnowledgeBases = async () => {
    setLoadingKBs(true)
    try {
      const result = await listKnowledgeBases()
      if (result.success) {
        setKnowledgeBases(result.data || [])
        
        // Auto-select KBs assigned to agent config
        if (agentConfigId) {
          const assignedResult = await getAssignedKBs(agentConfigId)
          if (assignedResult.success && assignedResult.data) {
            setSelectedKBIds(assignedResult.data)
          }
        }
      }
    } catch (error) {
      console.error('Error loading KBs:', error)
    } finally {
      setLoadingKBs(false)
    }
  }

  const formatValue = (value: any): string => {
    if (!value && value !== 0) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'number') return value.toString()
    if (Array.isArray(value)) {
      return value.map(item => formatValue(item)).filter(Boolean).join(', ')
    }
    if (typeof value === 'object') {
      return Object.entries(value)
        .map(([key, val]) => `${key}: ${formatValue(val)}`)
        .join('; ')
    }
    return String(value)
  }

  const generateQuery = (sourceSelections: SelectedSource[] = selectedSources) => {
    const queryParts: string[] = []

    console.log('🔍 [Search Modal] Generating query...')
    
    if (sourceSelections && sourceSelections.length > 0) {
      console.log(`   📍 Source-based query: ${sourceSelections.length} source(s) selected`)
      sourceSelections.forEach((source, idx) => {
        const formatted = formatValue(source.data)
        if (formatted) {
          queryParts.push(`${source.label}: ${formatted}`.substring(0, 400))
          console.log(`   ${idx + 1}. ${source.label}: ${formatted.substring(0, 100)}...`)
        }
      })
      const finalQuery = queryParts.slice(0, 3).join('. ')
      setQuery(finalQuery)
      console.log(`   ✅ Generated query: "${finalQuery.substring(0, 100)}..."`)
      return
    }

    if (selectedEmailIds.length === 0) {
      setQuery('')
      console.log('   ⚠️  No emails selected, query cleared')
      return
    }

    // Build query from selected emails' extracted data
    const selectedEmails = emails.filter(e => selectedEmailIds.includes(e.id))
    console.log(`   📧 Email-based query: ${selectedEmails.length} email(s) selected`)

    selectedEmails.forEach((email, emailIdx) => {
      console.log(`   📨 Email ${emailIdx + 1}: ${email.email_subject}`)
      if (email.extracted_data) {
        if (email.extracted_data.technologies) {
          const techs = Array.isArray(email.extracted_data.technologies)
            ? email.extracted_data.technologies
            : [email.extracted_data.technologies]
          queryParts.push(`Technologies: ${techs.join(', ')}`)
          console.log(`      Technologies: ${techs.join(', ')}`)
        }
        
        Object.entries(email.extracted_data).forEach(([key, value]) => {
          if (key !== 'technologies' && value && key !== 'deadlines') {
            const valStr = Array.isArray(value) ? value.join(', ') : formatValue(value)
            queryParts.push(`${key}: ${valStr}`)
            console.log(`      ${key}: ${valStr.substring(0, 80)}...`)
          }
        })
      }
    })

    const finalQuery = queryParts.slice(0, 3).join('. ')
    setQuery(finalQuery)
    console.log(`   ✅ Generated query: "${finalQuery.substring(0, 100)}..."`)
  }

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const keywordList = useMemo(
    () =>
      query
        .split(/\W+/)
        .map(part => part.trim())
        .filter(part => part.length >= 3)
        .slice(0, 5)
        .map(part => part.toLowerCase()),
    [query]
  )

  const renderSnippet = (text?: string | null, expanded: boolean = false) => {
    if (!text) {
      return <span className="text-muted-foreground">No preview available.</span>
    }

    const needsEllipsis = text.length > 400 && !expanded
    const snippet = expanded || text.length <= 400 ? text : text.substring(0, 400)

    if (keywordList.length === 0) {
      return (
        <>
          {snippet}
          {needsEllipsis && '…'}
        </>
      )
    }

    const regex = new RegExp(`(${keywordList.map(escapeRegExp).join('|')})`, 'gi')
    const parts = snippet.split(regex)

    return (
      <>
        {parts.map((part, idx) => {
          const isMatch = keywordList.includes(part.toLowerCase())
          return isMatch ? (
            <mark key={idx} className="rounded bg-yellow-200/80 px-0.5 text-foreground">
              {part}
            </mark>
          ) : (
            <span key={idx}>{part}</span>
          )
        })}
        {needsEllipsis && '…'}
      </>
    )
  }

  const hasMoreContent = (text?: string | null) => Boolean(text && text.length > 400)

  const toggleKBResult = (key: string) => {
    setExpandedKBResults(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleEmailResult = (key: string) => {
    setExpandedEmailResults(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleKBSelection = (kbId: string) => {
    setSelectedKBIds(prev => {
      const kb = knowledgeBases.find(k => k.id === kbId)
      const isSelected = prev.includes(kbId)
      const newSelection = isSelected
        ? prev.filter(id => id !== kbId)
        : [...prev, kbId]
      
      console.log(`📚 [Search Modal] KB selection changed:`)
      console.log(`   ${isSelected ? '❌ Removed' : '✅ Added'}: ${kb?.name || kbId}`)
      console.log(`   Total selected: ${newSelection.length} KB(s)`)
      
      return newSelection
    })
  }

  const handleSearch = async () => {
    if (!query.trim()) {
      alert('Please enter a search query')
      return
    }

    console.log('\n' + '═'.repeat(70))
    console.log('🔍 [Search Modal] Search initiated')
    console.log('═'.repeat(70))
    console.log(`📝 Query: "${query.trim()}"`)
    console.log(`📊 Query length: ${query.trim().length} characters`)
    console.log(`🎯 Similarity threshold: ${similarityThreshold} (${(similarityThreshold * 100).toFixed(0)}%)`)
    console.log(`📋 Result limit: 10 per source`)
    console.log(`🗂️  KBs selected: ${selectedKBIds.length}`)
    if (selectedKBIds.length > 0) {
      const selectedKBNames = knowledgeBases
        .filter(kb => selectedKBIds.includes(kb.id))
        .map(kb => kb.name)
      console.log(`   KB Names: ${selectedKBNames.join(', ')}`)
    } else {
      console.log(`   ⚠️  No KBs selected - will search all KBs`)
    }
    console.log(`📧 Include emails: Yes`)
    console.log(`🔎 Include KBs: Yes`)
    console.log('═'.repeat(70) + '\n')

    setLoading(true)
    setSearched(false)

    try {
      const result = await searchSimilar(
        query.trim(),
        selectedKBIds,
        true, // include emails
        true, // include KBs
        10,
        similarityThreshold
      )

      console.log('✅ [Search Modal] Search completed')
      console.log(`   KB Results: ${result.kbResults?.length || 0}`)
      console.log(`   Email Results: ${result.emailResults?.length || 0}`)
      if (result.debugRunId) {
        console.log(`   📁 Debug folder: debug-search-runs/${result.debugRunId}`)
      }

      if (result.success) {
        setKBResults(result.kbResults || [])
        setEmailResults(result.emailResults || [])
        setSearched(true)
      } else {
        alert(`Search failed: ${result.error}`)
      }
    } catch (error) {
      console.error('❌ [Search Modal] Search error:', error)
      alert('Search failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Find Similar Content</DialogTitle>
          <DialogDescription>
            Search knowledge bases and saved emails for similar content using semantic search
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="query">Search Query</Label>
            <div className="flex gap-2">
              <Input
                id="query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., Python backend developer with 3 years experience..."
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={loading || !query.trim()}>
                <Search className="mr-2 h-4 w-4" />
                {loading ? 'Searching...' : 'Search'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedSources.length > 0
                ? `Auto-generated from ${selectedSources.length} selected source${selectedSources.length === 1 ? '' : 's'}. Edit as needed.`
                : selectedEmailIds.length > 0
                ? 'Auto-generated from selected emails. Edit as needed.'
                : 'Enter a search query or select emails/sources to auto-generate.'}
            </p>
            {selectedSources.length > 0 && (
              <p className="text-xs text-green-700 font-medium">
                ✓ Using {selectedSources.length} selected source{selectedSources.length === 1 ? '' : 's'} from your results.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Search in Knowledge Bases</Label>
            <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
              {loadingKBs ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : knowledgeBases.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No knowledge bases available. Create one first.
                </p>
              ) : (
                knowledgeBases.map(kb => (
                  <div key={kb.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`kb-${kb.id}`}
                      checked={selectedKBIds.includes(kb.id)}
                      onCheckedChange={() => toggleKBSelection(kb.id)}
                    />
                    <label htmlFor={`kb-${kb.id}`} className="text-sm flex-1 cursor-pointer">
                      {kb.name}
                      <Badge variant="outline" className="ml-2 text-xs">
                        {kb.document_count} docs
                      </Badge>
                    </label>
                  </div>
                ))
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {agentConfigId ? 'Pre-selected from agent configuration. ' : ''}
              Select which knowledge bases to search.
            </p>
          </div>

        <div className="space-y-2">
          <Label>Similarity Threshold ({Math.round(similarityThreshold * 100)}%)</Label>
          <Slider
            value={[Math.round(similarityThreshold * 100)]}
            min={10}
            max={100}
            step={5}
            onValueChange={(value) => {
              const nextValue = (value[0] || 10) / 100
              setSimilarityThreshold(nextValue)
              console.log(`🎯 [Search Modal] Threshold changed: ${(nextValue * 100).toFixed(0)}% (${nextValue.toFixed(2)})`)
            }}
          />
          <p className="text-xs text-muted-foreground">
            Lower threshold = more matches (broader search). Higher threshold = stricter matches.
          </p>
        </div>

        {searched && (
          <div className="rounded-md border bg-muted/50 p-3 text-sm space-y-1">
            <p>
              <span className="font-medium">Knowledge bases searched:</span>{' '}
              {selectedKBs.length > 0
                ? selectedKBs.map(kb => kb.name).join(', ')
                : 'None (only saved emails)'}
            </p>
            <p>
              <span className="font-medium">Similarity threshold:</span> {thresholdPercent}%
            </p>
          </div>
        )}

          {searched && (
            <Tabs defaultValue="kb" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="kb">
                  <Database className="mr-2 h-4 w-4" />
                  Knowledge Bases ({kbResults.length})
                </TabsTrigger>
                <TabsTrigger value="emails">
                  <Mail className="mr-2 h-4 w-4" />
                  Saved Emails ({emailResults.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="kb" className="space-y-4 mt-4">
                {kbResults.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-muted-foreground text-center">No similar documents found</p>
                    </CardContent>
                  </Card>
                ) : (
                  kbResults.map((result, idx) => {
                    const resultKey = `${result.document_id || 'kb'}-${result.chunk_index ?? idx}`
                    const isExpanded = !!expandedKBResults[resultKey]

                    return (
                      <Card key={resultKey}>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-base">{result.document_title}</CardTitle>
                              <CardDescription className="flex flex-wrap items-center gap-2 mt-1">
                                <Badge variant="outline">{result.kb_name}</Badge>
                                <Badge variant="secondary">
                                  {Math.round(result.similarity * 100)}% similar
                                </Badge>
                                {typeof result.chunk_index === 'number' && (
                                  <Badge variant="outline">Chunk {result.chunk_index + 1}</Badge>
                                )}
                                {result.document_type && (
                                  <Badge variant="outline">{result.document_type}</Badge>
                                )}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {renderSnippet(result.content, isExpanded)}
                          </div>

                          {hasMoreContent(result.content) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="px-0 text-xs"
                              onClick={() => toggleKBResult(resultKey)}
                            >
                              {isExpanded ? 'Show less context' : 'Show more context'}
                            </Button>
                          )}

                          {result.context_tags && result.context_tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {result.context_tags.map((tag: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </TabsContent>

              <TabsContent value="emails" className="space-y-4 mt-4">
                {emailResults.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-muted-foreground text-center">No similar emails found</p>
                    </CardContent>
                  </Card>
                ) : (
                  emailResults.map((result, idx) => {
                    const resultKey = `${result.analyzed_email_id || 'email'}-${result.source_url || idx}`
                    const isExpanded = !!expandedEmailResults[resultKey]

                    return (
                      <Card key={resultKey}>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-base">{result.email_subject}</CardTitle>
                              <CardDescription className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-xs">{result.email_from}</span>
                                <Badge variant="secondary">
                                  {Math.round(result.similarity * 100)}% similar
                                </Badge>
                                {result.matched && <Badge variant="outline">Matched</Badge>}
                                {result.content_type && (
                                  <Badge variant="outline">{result.content_type}</Badge>
                                )}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {result.source_url && (
                            <p className="text-muted-foreground text-sm">
                              <strong>Source:</strong> {result.source_url}
                            </p>
                          )}

                          <div className="border-t pt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                            {renderSnippet(result.embedded_text, isExpanded)}
                          </div>

                          {hasMoreContent(result.embedded_text) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="px-0 text-xs"
                              onClick={() => toggleEmailResult(resultKey)}
                            >
                              {isExpanded ? 'Show less context' : 'Show more context'}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

