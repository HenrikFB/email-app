'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Database, ChevronDown, ChevronUp, Sparkles, Brain } from 'lucide-react'
import { createConfiguration, updateConfiguration, type AgentConfiguration } from '../actions'
import { listKnowledgeBases, assignKBsToAgentConfig, getAssignedKBs, type KnowledgeBase } from '../knowledge-base/actions'

interface ConfigFormProps {
  config?: AgentConfiguration
  onSuccess?: () => void
  onCancel?: () => void
}

export default function ConfigForm({ config, onSuccess, onCancel }: ConfigFormProps) {
  // Basic Information
  const [name, setName] = useState(config?.name || '')
  const [emailAddress, setEmailAddress] = useState(config?.email_address || '')
  
  // Matching & Extraction (LangChain relevant)
  const [matchCriteria, setMatchCriteria] = useState(config?.match_criteria || '')
  const [extractionFields, setExtractionFields] = useState(config?.extraction_fields || '')
  const [userIntent, setUserIntent] = useState(config?.user_intent || '')
  const [extractionExamples, setExtractionExamples] = useState(config?.extraction_examples || '')
  const [analysisFeedback, setAnalysisFeedback] = useState(config?.analysis_feedback || '')
  
  // Draft Generation (Phase 2 - keep for future)
  const [draftGenerationEnabled, setDraftGenerationEnabled] = useState(config?.draft_generation_enabled || false)
  const [draftInstructions, setDraftInstructions] = useState(config?.draft_instructions || '')
  
  // Form state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Collapsible sections state
  const [matchingOpen, setMatchingOpen] = useState(true)
  const [draftOpen, setDraftOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  
  // Knowledge base assignment (Phase 2 - keep for future)
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

      // Only send LangChain-relevant fields
      const formData = {
        name: name.trim(),
        email_address: emailAddress,
        match_criteria: matchCriteria,
        extraction_fields: extractionFields,
        user_intent: userIntent || undefined,
        extraction_examples: extractionExamples || undefined,
        analysis_feedback: analysisFeedback || undefined,
        // Draft generation (Phase 2)
        draft_generation_enabled: draftGenerationEnabled,
        draft_instructions: draftInstructions || undefined,
        // Deprecated fields - set to defaults
        analyze_attachments: false,
        follow_links: false,
        button_text_pattern: undefined,
        link_selection_guidance: undefined,
        max_links_to_scrape: 10,
        content_retrieval_strategy: 'scrape_only' as const, // deprecated but keep for backwards compat
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
        setUserIntent('')
        setExtractionExamples('')
        setAnalysisFeedback('')
        setDraftGenerationEnabled(false)
        setDraftInstructions('')
        setSelectedKBIds([])
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
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-indigo-500" />
          {config ? 'Edit Configuration' : 'New Agent Configuration'}
        </CardTitle>
        <CardDescription>
          {config
            ? 'Update your LangChain email analysis configuration'
            : 'Create a new LangChain email analysis agent'}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
          
          {/* How it works banner */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-2">
            <h4 className="font-medium text-indigo-900 flex items-center gap-2">
              <Brain className="h-4 w-4" />
              LangChain ReAct Agent
            </h4>
            <ul className="text-sm text-indigo-800 space-y-1">
              <li>• <strong>Email Analysis:</strong> Extracts jobs from email plain text</li>
              <li>• <strong>Web Research:</strong> Uses Tavily Search + Extract to find full job descriptions</li>
              <li>• <strong>Re-Evaluation:</strong> Validates matches against your criteria with full context</li>
              <li>• <strong>Coming Soon:</strong> KB Search + Draft Generation</li>
            </ul>
          </div>
          
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
                  <Badge variant="outline" className="ml-2 text-xs">5 fields</Badge>
                </h3>
                {matchingOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-4 pt-2">
          <div className="space-y-2">
                  <Label htmlFor="matchCriteria">What are you interested in? *</Label>
            <Textarea
              id="matchCriteria"
                    placeholder="E.g., Software developer jobs with less than 5 years experience, .NET, TypeScript, JavaScript, or RPA/automation. Avoid PLC/SCADA, hardware, electronic engineering, embedded systems."
              value={matchCriteria}
              onChange={(e) => setMatchCriteria(e.target.value)}
              rows={5}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
                    Describe what emails/jobs you want to match. Be specific about what to include AND exclude.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="extractionFields">What to extract if matched?</Label>
            <Textarea
              id="extractionFields"
                    placeholder="E.g., deadline, technologies, competencies, experience level, company domains, location, work type (remote/hybrid/onsite)"
              value={extractionFields}
              onChange={(e) => setExtractionFields(e.target.value)}
                    rows={3}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
                    Fields to extract from matching jobs. The AI will populate these from email and web research.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="userIntent">
                    User Intent <Badge variant="secondary" className="ml-1 text-xs">Recommended</Badge>
                  </Label>
                  <Textarea
                    id="userIntent"
                    placeholder="E.g., I want to find .NET developer jobs in Denmark, preferably in fintech or healthcare. I have 3 years experience so I'm looking for mid-level roles."
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
                    placeholder='E.g., {"technologies": [".NET", "C#", "TypeScript"], "location": "Copenhagen", "experience_level": "3-5 years", "work_type": "hybrid"}'
                    value={extractionExamples}
                    onChange={(e) => setExtractionExamples(e.target.value)}
                    rows={3}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Show the AI the expected output format (JSON or natural language)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="analysisFeedback">
                    Analysis Feedback <Badge variant="secondary" className="ml-1 text-xs">Optional</Badge>
                  </Label>
                  <Textarea
                    id="analysisFeedback"
                    placeholder="E.g., Often matches embedded systems jobs even though I said no hardware. Be stricter about experience level - I don't want senior roles."
                    value={analysisFeedback}
                    onChange={(e) => setAnalysisFeedback(e.target.value)}
                    rows={2}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Note what works or fails to improve accuracy over time
                  </p>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* SECTION 3: Draft Generation (Phase 2 - Coming Soon) */}
          <Collapsible open={draftOpen} onOpenChange={setDraftOpen}>
            <div className="space-y-4 pb-4 border-b">
              <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-70 transition-opacity">
                <h3 className="text-lg font-semibold flex items-center">
                  <Sparkles className="mr-2 h-5 w-5 text-amber-500" />
                  Draft Generation
                  <Badge variant="outline" className="ml-2 text-xs bg-amber-50">Coming Soon</Badge>
                </h3>
                {draftOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-4 pt-2">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800">
                    <strong>Phase 2 Feature:</strong> After the LangChain agent finds matching jobs and researches them, 
                    it will search your Knowledge Base for relevant content (e.g., cover letter templates) and 
                    generate customized drafts.
                </p>
                </div>
                
                <div className="flex items-start space-x-2 opacity-50">
                  <Checkbox
                    id="draftGenerationEnabled"
                    checked={draftGenerationEnabled}
                    onCheckedChange={(checked) => setDraftGenerationEnabled(checked as boolean)}
                    disabled={true}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="draftGenerationEnabled"
                      className="text-sm font-medium leading-none"
                    >
                      Enable Draft Generation
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Coming in Phase 2: Auto-generate cover letters, responses, etc.
                    </p>
                  </div>
                </div>
                
                  {draftGenerationEnabled && (
                  <div className="space-y-2 pt-2 opacity-50">
                      <Label htmlFor="draftInstructions">
                        Draft Instructions
                      </Label>
                      <Textarea
                        id="draftInstructions"
                      placeholder="E.g., Generate a cover letter for each matching job using my KB content as a style reference."
                        value={draftInstructions}
                        onChange={(e) => setDraftInstructions(e.target.value)}
                      rows={4}
                      disabled={true}
                    />
                    </div>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>

          {/* SECTION 4: Knowledge Base (Phase 2) */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <div className="space-y-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-70 transition-opacity">
                <h3 className="text-lg font-semibold flex items-center">
                  <Database className="mr-2 h-5 w-5 text-emerald-500" />
                  Knowledge Base
                  <Badge variant="outline" className="ml-2 text-xs bg-emerald-50">Phase 2</Badge>
                </h3>
                {advancedOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-4 pt-2">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-emerald-800">
                    <strong>Phase 2 Feature:</strong> Assign knowledge bases (e.g., cover letter templates) 
                    to be searched when jobs match. Found snippets will be used for draft generation.
                  </p>
          </div>

          {knowledgeBases.length > 0 && (
                  <div className="space-y-2">
              <Label>
                      Assign Knowledge Bases <Badge variant="secondary" className="ml-1 text-xs">Optional</Badge>
              </Label>
              <div className="border rounded-md p-3 space-y-2 max-h-60 overflow-y-auto">
                {loadingKBs ? (
                  <p className="text-sm text-muted-foreground">Loading knowledge bases...</p>
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
                      These KBs will be searched for relevant content when jobs match (Phase 2)
              </p>
            </div>
          )}

                {knowledgeBases.length === 0 && !loadingKBs && (
                  <p className="text-sm text-muted-foreground">
                    No knowledge bases yet. Create one from the Knowledge Base page.
                  </p>
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
