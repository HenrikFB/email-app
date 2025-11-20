'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Database } from 'lucide-react'
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
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
        <CardTitle>{config ? 'Edit Configuration' : 'New Agent Configuration'}</CardTitle>
        <CardDescription>
          {config
            ? 'Update your email monitoring configuration'
            : 'Create a new email monitoring configuration'}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
          
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
              A unique name to identify this configuration (used for selection in UI)
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
              The email address you want to analyze/listen to
            </p>
          </div>

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
              Describe what emails you want to match/filter - your criteria for triggering analysis
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
              What information to extract if the email matches your criteria above
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="buttonTextPattern">Button Text Pattern (Optional)</Label>
            <Input
              id="buttonTextPattern"
              placeholder="E.g., Se jobbet|Apply|View Job|Read More"
              value={buttonTextPattern}
              onChange={(e) => setButtonTextPattern(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Regex pattern to boost link ranking (not a filter). Use pipe | for multiple patterns. Example: "Se jobbet|Apply"
            </p>
          </div>

          {knowledgeBases.length > 0 && (
            <div className="space-y-2">
              <Label>
                <Database className="inline h-4 w-4 mr-1" />
                Assign Knowledge Bases (Optional - for RAG)
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
                Selected KBs will provide context examples during email analysis (RAG). The AI will search these KBs for similar content to improve extraction accuracy.
              </p>
            </div>
          )}

          <div className="space-y-4">
            <Label>Analysis Options</Label>
            
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
                  Include analysis of email attachments in addition to email content
                </p>
              </div>
            </div>

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
                  Follow links with Firecrawl
                </label>
                <p className="text-xs text-muted-foreground">
                  Open and scrape links found in emails using Firecrawl
                </p>
              </div>
            </div>
          </div>
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

