'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { createConfiguration, updateConfiguration, type AgentConfiguration } from '../actions'

interface ConfigFormProps {
  config?: AgentConfiguration
  onSuccess?: () => void
  onCancel?: () => void
}

export default function ConfigForm({ config, onSuccess, onCancel }: ConfigFormProps) {
  const [emailAddress, setEmailAddress] = useState(config?.email_address || '')
  const [matchCriteria, setMatchCriteria] = useState(config?.match_criteria || '')
  const [extractionFields, setExtractionFields] = useState(config?.extraction_fields || '')
  const [analyzeAttachments, setAnalyzeAttachments] = useState(config?.analyze_attachments || false)
  const [followLinks, setFollowLinks] = useState(config?.follow_links || false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const formData = {
        email_address: emailAddress,
        match_criteria: matchCriteria,
        extraction_fields: extractionFields,
        analyze_attachments: analyzeAttachments,
        follow_links: followLinks,
      }

      if (config) {
        await updateConfiguration(config.id, formData)
      } else {
        await createConfiguration(formData)
      }

      // Reset form if creating new
      if (!config) {
        setEmailAddress('')
        setMatchCriteria('')
        setExtractionFields('')
        setAnalyzeAttachments(false)
        setFollowLinks(false)
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

