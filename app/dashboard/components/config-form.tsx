'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Database, ChevronDown, ChevronUp, Sparkles, Zap } from 'lucide-react'
import { createConfiguration, updateConfiguration, type AgentConfiguration } from '../actions'
import { listKnowledgeBases, assignKBsToAgentConfig, getAssignedKBs, type KnowledgeBase } from '../knowledge-base/actions'

interface ConfigFormProps {
  config?: AgentConfiguration
  onSuccess?: () => void
  onCancel?: () => void
}

export default function ConfigForm({ config, onSuccess, onCancel }: ConfigFormProps) {
  const [name, setName] = useState(config?.name || '')
  const [emailAddress, setEmailAddress] = useState(config?.email_address || '')
  const [matchCriteria, setMatchCriteria] = useState(config?.match_criteria || '')
  const [extractionFields, setExtractionFields] = useState(config?.extraction_fields || '')
  const [analyzeAttachments, setAnalyzeAttachments] = useState(config?.analyze_attachments || false)
  const [followLinks, setFollowLinks] = useState(config?.follow_links || false)
  const [buttonTextPattern, setButtonTextPattern] = useState(config?.button_text_pattern || '')
  const [userIntent, setUserIntent] = useState(config?.user_intent || '')
  const [linkGuidance, setLinkGuidance] = useState(config?.link_selection_guidance || '')
  const [maxLinksToScrape, setMaxLinksToScrape] = useState<number>(config?.max_links_to_scrape ?? 10)
  const [contentStrategy, setContentStrategy] = useState<'scrape_only' | 'scrape_and_search' | 'search_only' | 'intelligent_discovery'>(
    config?.content_retrieval_strategy || 'scrape_only'
  )
  const [extractionExamples, setExtractionExamples] = useState(config?.extraction_examples || '')
  const [analysisFeedback, setAnalysisFeedback] = useState(config?.analysis_feedback || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Automation fields
  const [autoSearchKbOnMatch, setAutoSearchKbOnMatch] = useState(config?.auto_search_kb_on_match || false)
  const [autoSaveMatchesToKbId, setAutoSaveMatchesToKbId] = useState(config?.auto_save_matches_to_kb_id || '')
  const [autoSaveConfidenceThreshold, setAutoSaveConfidenceThreshold] = useState(config?.auto_save_confidence_threshold ?? 0.8)
  const [autoSearchQueryTemplate, setAutoSearchQueryTemplate] = useState(config?.auto_search_query_template || '')
  
  // Collapsible sections state
  const [matchingOpen, setMatchingOpen] = useState(true)
  const [linksOpen, setLinksOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [automationOpen, setAutomationOpen] = useState(false)
  
  // Knowledge base assignment
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [selectedKBIds, setSelectedKBIds] = useState<string[]>([])
  const [loadingKBs, setLoadingKBs] = useState(false)

  useEffect(() => {
    loadKnowledgeBases()
    if (config) {
      loadAssignedKBs()
    }
  }, [config?.id])

  const loadKnowledgeBases = async () => {
    setLoadingKBs(true)
    try {
      const result = await listKnowledgeBases()
      if (result.success) {
        setKnowledgeBases(result.data || [])
      }
    } catch (error) {
      console.error('Error loading KBs:', error)
    } finally {
      setLoadingKBs(false)
    }
  }

  const loadAssignedKBs = async () => {
    if (!config) return
    try {
      const result = await getAssignedKBs(config.id)
      if (result.success) {
        setSelectedKBIds(result.data || [])
      }
    } catch (error) {
      console.error('Error loading assigned KBs:', error)
    }
  }

  const toggleKBSelection = (kbId: string) => {
    setSelectedKBIds(prev =>
      prev.includes(kbId)
        ? prev.filter(id => id !== kbId)
        : [...prev, kbId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (!name.trim()) {
        setError('Name is required')
        return
      }

      const formData = {
        name: name.trim(),
        email_address: emailAddress,
        match_criteria: matchCriteria,
        extraction_fields: extractionFields,
        analyze_attachments: analyzeAttachments,
        follow_links: followLinks,
        button_text_pattern: buttonTextPattern || undefined,
        user_intent: userIntent || undefined,
        link_selection_guidance: linkGuidance || undefined,
        max_links_to_scrape: maxLinksToScrape,
        content_retrieval_strategy: contentStrategy,
        extraction_examples: extractionExamples || undefined,
        analysis_feedback: analysisFeedback || undefined,
        // Automation fields
        auto_search_kb_on_match: autoSearchKbOnMatch,
        auto_save_matches_to_kb_id: autoSaveMatchesToKbId || undefined,
        auto_save_confidence_threshold: autoSaveConfidenceThreshold,
        auto_search_query_template: autoSearchQueryTemplate || undefined,
      }

      let configId: string
      if (config) {
        await updateConfiguration(config.id, formData)
        configId = config.id
      } else {
        const result = await createConfiguration(formData)
        configId = result.id
      }

      // Assign knowledge bases
      await assignKBsToAgentConfig(configId, selectedKBIds)

      // Reset form if creating new
      if (!config) {
        setName('')
        setEmailAddress('')
        setMatchCriteria('')
        setExtractionFields('')
        setAnalyzeAttachments(false)
        setFollowLinks(false)
        setButtonTextPattern('')
        setUserIntent('')
        setLinkGuidance('')
        setMaxLinksToScrape(10)
        setContentStrategy('scrape_only')
        setExtractionExamples('')
        setAnalysisFeedback('')
        setSelectedKBIds([])
        // Reset automation fields
        setAutoSearchKbOnMatch(false)
        setAutoSaveMatchesToKbId('')
        setAutoSaveConfidenceThreshold(0.8)
        setAutoSearchQueryTemplate('')
      }

      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{config ? 'Edit Configuration' : 'New Agent Configuration'}</CardTitle>
        <CardDescription>
          {config
            ? 'Update your email monitoring configuration'
            : 'Create a new email monitoring configuration'}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
          
          {/* SECTION 1: Basic Information */}
          <div className="space-y-4 pb-4 border-b">
            <h3 className="text-lg font-semibold">Basic Information</h3>
          
          <div className="space-y-2">
            <Label htmlFor="name">Configuration Name *</Label>
            <Input
              id="name"
              type="text"
              placeholder="E.g., Jobs - Software Developer"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
                A unique name to identify this configuration
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="emailAddress">Email Address to Monitor</Label>
            <Input
              id="emailAddress"
              type="email"
              placeholder="incoming@example.com"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              required
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
                The email address you want to analyze
            </p>
            </div>
          </div>

          {/* SECTION 2: Matching & Extraction Rules (Collapsible) */}
          <Collapsible open={matchingOpen} onOpenChange={setMatchingOpen}>
            <div className="space-y-4 pb-4 border-b">
              <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-70 transition-opacity">
                <h3 className="text-lg font-semibold">
                  Matching & Extraction Rules
                  <Badge variant="outline" className="ml-2 text-xs">6 fields</Badge>
                </h3>
                {matchingOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="matchCriteria">What are you interested in?</Label>
            <Textarea
              id="matchCriteria"
              placeholder="E.g., Software developer jobs with less than 5 years experience, .NET, TypeScript, JavaScript, or RPA/automation. Avoid PLC/SCADA, hardware, electronic engineering."
              value={matchCriteria}
              onChange={(e) => setMatchCriteria(e.target.value)}
              rows={5}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
                    Describe what emails you want to match/filter
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="extractionFields">What to extract if matched?</Label>
            <Textarea
              id="extractionFields"
              placeholder="E.g., deadline, technologies, competencies, experience level, company domains, location, work type"
              value={extractionFields}
              onChange={(e) => setExtractionFields(e.target.value)}
              rows={4}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
                    What information to extract if the email matches
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="userIntent">
                    User Intent <Badge variant="secondary" className="ml-1 text-xs">Optional - Recommended</Badge>
                  </Label>
                  <Textarea
                    id="userIntent"
                    placeholder="E.g., I want to track .NET developer jobs in healthcare or fintech with 3-5 years experience"
                    value={userIntent}
                    onChange={(e) => setUserIntent(e.target.value)}
                    rows={3}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Explain your goal to help the AI understand WHY you want this data
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="extractionExamples">
                    Extraction Examples <Badge variant="secondary" className="ml-1 text-xs">Optional</Badge>
                  </Label>
                  <Textarea
                    id="extractionExamples"
                    placeholder='E.g., {"technologies": [".NET", "C#", "Python"], "location": "Copenhagen", "experience": "3-5 years"}'
                    value={extractionExamples}
                    onChange={(e) => setExtractionExamples(e.target.value)}
                    rows={4}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Provide examples of expected extraction format (JSON or natural language)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="analysisFeedback">
                    Analysis Feedback/Notes <Badge variant="secondary" className="ml-1 text-xs">Optional</Badge>
                  </Label>
                  <Textarea
                    id="analysisFeedback"
                    placeholder="E.g., Always extracts 'Java' even though I only want .NET jobs. Needs better filtering for PLC/SCADA positions."
                    value={analysisFeedback}
                    onChange={(e) => setAnalysisFeedback(e.target.value)}
                    rows={3}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Note what works or fails to improve accuracy over time
                  </p>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* SECTION 3: Link & Content Options (Collapsible) */}
          <Collapsible open={linksOpen} onOpenChange={setLinksOpen}>
            <div className="space-y-4 pb-4 border-b">
              <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-70 transition-opacity">
                <h3 className="text-lg font-semibold">
                  Link & Content Options
                  <Badge variant="outline" className="ml-2 text-xs">6 fields</Badge>
                </h3>
                {linksOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-4 pt-2">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="followLinks"
                    checked={followLinks}
                    onCheckedChange={(checked) => setFollowLinks(checked as boolean)}
                    disabled={loading}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="followLinks"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Follow and analyze links in emails
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Extract and analyze content from links found in emails
                    </p>
                  </div>
                </div>

                {followLinks && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="contentStrategy">Content Retrieval Strategy</Label>
                      <Select
                        value={contentStrategy}
                        onValueChange={(value: any) => setContentStrategy(value)}
                        disabled={loading}
                      >
                        <SelectTrigger id="contentStrategy">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scrape_only">
                            <div className="flex flex-col items-start">
                              <span className="font-medium">Scrape Only</span>
                              <span className="text-xs text-muted-foreground">Use Firecrawl only (for public URLs)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="search_only">
                            <div className="flex flex-col items-start">
                              <span className="font-medium">Search Only</span>
                              <span className="text-xs text-muted-foreground">Find alternative public URLs (for LinkedIn, auth-required)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="scrape_and_search">
                            <div className="flex flex-col items-start">
                              <span className="font-medium">Scrape + Search</span>
                              <span className="text-xs text-muted-foreground">Both methods (most thorough, higher cost)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="intelligent_discovery">
                            <div className="flex flex-col items-start">
                              <span className="font-medium">Intelligent Discovery</span>
                              <span className="text-xs text-muted-foreground">AI-driven discovery of alternative public URLs (best for expired links)</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {contentStrategy === 'scrape_only' && 'Best for public URLs that Firecrawl can access directly'}
                        {contentStrategy === 'search_only' && 'Best for authenticated content like LinkedIn jobs - finds public alternatives'}
                        {contentStrategy === 'scrape_and_search' && 'Most comprehensive - combines both approaches for best results'}
                        {contentStrategy === 'intelligent_discovery' && 'Smart web discovery - searches for alternative public URLs then scrapes them (ideal for expired tokens)'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxLinksToScrape">Max Links to Analyze</Label>
                      <Input
                        id="maxLinksToScrape"
                        type="number"
                        min="1"
                        max="50"
                        value={maxLinksToScrape}
                        onChange={(e) => setMaxLinksToScrape(parseInt(e.target.value) || 10)}
                        disabled={loading}
                      />
                      <p className="text-xs text-muted-foreground">
                        Maximum number of links to analyze per email (default: 10). Controls cost and time.
            </p>
          </div>

          <div className="space-y-2">
                      <Label htmlFor="buttonTextPattern">
                        Button Text Pattern <Badge variant="secondary" className="ml-1 text-xs">Optional</Badge>
                      </Label>
            <Input
              id="buttonTextPattern"
              placeholder="E.g., Se jobbet|Apply|View Job|Read More"
              value={buttonTextPattern}
              onChange={(e) => setButtonTextPattern(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
                        Regex pattern to boost link ranking. Use pipe | for multiple patterns.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="linkGuidance">
                        Link Selection Guidance <Badge variant="secondary" className="ml-1 text-xs">Optional</Badge>
                      </Label>
                      <Textarea
                        id="linkGuidance"
                        placeholder="E.g., Include generic job titles like 'Software Developer' - the specific technologies (.NET, JavaScript) are inside the links, not in the link text"
                        value={linkGuidance}
                        onChange={(e) => setLinkGuidance(e.target.value)}
                        rows={3}
                        disabled={loading}
                      />
                      <p className="text-xs text-muted-foreground">
                        Help the AI understand that link text is often generic
                      </p>
                    </div>
                  </>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* SECTION 4: Automation Settings (Collapsible) */}
          <Collapsible open={automationOpen} onOpenChange={setAutomationOpen}>
            <div className="space-y-4 pb-4 border-b">
              <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-70 transition-opacity">
                <h3 className="text-lg font-semibold flex items-center">
                  <Zap className="h-5 w-5 mr-2 text-amber-500" />
                  Automation Settings
                  <Badge variant="outline" className="ml-2 text-xs bg-amber-50">New</Badge>
                </h3>
                {automationOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  Configure automatic actions when emails match your criteria.
                </p>
                
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="autoSearchKb"
                    checked={autoSearchKbOnMatch}
                    onCheckedChange={(checked) => setAutoSearchKbOnMatch(checked as boolean)}
                    disabled={loading || selectedKBIds.length === 0}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="autoSearchKb"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                    >
                      <Sparkles className="h-4 w-4 text-indigo-500" />
                      Auto-search KB on match
                    </label>
                    <p className="text-xs text-muted-foreground">
                      When an email matches, automatically search assigned KBs for similar content
                    </p>
                  </div>
                </div>
                
                {selectedKBIds.length === 0 && (
                  <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                    Assign at least one Knowledge Base (in Advanced Options) to enable automation
                  </p>
                )}
                
                {autoSearchKbOnMatch && selectedKBIds.length > 0 && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="autoSaveKb">
                        Auto-save matches to KB <Badge variant="secondary" className="ml-1 text-xs">Optional</Badge>
                      </Label>
                      <Select
                        value={autoSaveMatchesToKbId}
                        onValueChange={setAutoSaveMatchesToKbId}
                        disabled={loading}
                      >
                        <SelectTrigger id="autoSaveKb">
                          <SelectValue placeholder="Don't auto-save" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Don't auto-save</SelectItem>
                          {knowledgeBases.filter(kb => selectedKBIds.includes(kb.id)).map(kb => (
                            <SelectItem key={kb.id} value={kb.id}>
                              {kb.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Automatically save matched emails to this KB when confidence is high enough
                      </p>
                    </div>
                    
                    {autoSaveMatchesToKbId && (
                      <div className="space-y-2">
                        <Label>
                          Confidence Threshold: {Math.round(autoSaveConfidenceThreshold * 100)}%
                        </Label>
                        <Slider
                          value={[autoSaveConfidenceThreshold * 100]}
                          onValueChange={([value]) => setAutoSaveConfidenceThreshold(value / 100)}
                          min={50}
                          max={100}
                          step={5}
                          disabled={loading}
                        />
                        <p className="text-xs text-muted-foreground">
                          Only auto-save when AI confidence meets this threshold
                        </p>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <Label htmlFor="queryTemplate">
                        Search Query Template <Badge variant="secondary" className="ml-1 text-xs">Optional</Badge>
                      </Label>
                      <Textarea
                        id="queryTemplate"
                        placeholder="E.g., {{job_title}} {{technologies}} {{location}}"
                        value={autoSearchQueryTemplate}
                        onChange={(e) => setAutoSearchQueryTemplate(e.target.value)}
                        rows={2}
                        disabled={loading}
                      />
                      <p className="text-xs text-muted-foreground">
                        Use {`{{field_name}}`} placeholders to customize search query generation from extracted data
                      </p>
                    </div>
                  </>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* SECTION 5: Advanced Options (Collapsible) */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <div className="space-y-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-70 transition-opacity">
                <h3 className="text-lg font-semibold">
                  Advanced Options
                  <Badge variant="outline" className="ml-2 text-xs">
                    {knowledgeBases.length > 0 ? '2 sections' : '1 section'}
                  </Badge>
                </h3>
                {advancedOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-4 pt-2">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="analyzeAttachments"
                    checked={analyzeAttachments}
                    onCheckedChange={(checked) => setAnalyzeAttachments(checked as boolean)}
                    disabled={loading}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="analyzeAttachments"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Analyze email attachments
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Include analysis of email attachments (PDFs, documents, etc.)
                    </p>
                  </div>
          </div>

          {knowledgeBases.length > 0 && (
                  <div className="space-y-2 pt-4 border-t">
              <Label>
                <Database className="inline h-4 w-4 mr-1" />
                      Assign Knowledge Bases <Badge variant="secondary" className="ml-1 text-xs">Optional - for RAG</Badge>
              </Label>
              <div className="border rounded-md p-3 space-y-2 max-h-60 overflow-y-auto">
                {loadingKBs ? (
                  <p className="text-sm text-muted-foreground">Loading knowledge bases...</p>
                ) : knowledgeBases.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No knowledge bases yet. Create one from the Knowledge Base page.
                  </p>
                ) : (
                  knowledgeBases.map(kb => (
                    <div key={kb.id} className="flex items-start space-x-2">
                      <Checkbox
                        id={`kb-${kb.id}`}
                        checked={selectedKBIds.includes(kb.id)}
                        onCheckedChange={() => toggleKBSelection(kb.id)}
                        disabled={loading}
                      />
                      <div className="flex-1">
                        <label
                          htmlFor={`kb-${kb.id}`}
                          className="text-sm font-medium cursor-pointer flex items-center gap-2"
                        >
                          {kb.name}
                          <Badge variant="outline" className="text-xs">
                            {kb.type}
                          </Badge>
                        </label>
                        {kb.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {kb.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {kb.document_count} docs • {kb.total_chunks} chunks
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                      Selected KBs provide context to improve extraction accuracy (RAG)
              </p>
            </div>
          )}

              </CollapsibleContent>
            </div>
          </Collapsible>
        </CardContent>
        <CardFooter className="flex justify-between">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={loading} className={!onCancel ? 'w-full' : ''}>
            {loading ? 'Saving...' : config ? 'Update Configuration' : 'Create Configuration'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

