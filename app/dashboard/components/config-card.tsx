'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { deleteConfiguration, type AgentConfiguration } from '../actions'
import ConfigForm from './config-form'

interface ConfigCardProps {
  config: AgentConfiguration
}

export default function ConfigCard({ config }: ConfigCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteConfiguration(config.id)
    } catch (error) {
      console.error('Error deleting configuration:', error)
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  if (isEditing) {
    return (
      <ConfigForm
        config={config}
        onSuccess={() => setIsEditing(false)}
        onCancel={() => setIsEditing(false)}
      />
    )
  }

  if (showDeleteConfirm) {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardHeader>
          <CardTitle className="text-red-900">Confirm Deletion</CardTitle>
          <CardDescription className="text-red-700">
            Are you sure you want to delete this configuration? This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="font-medium text-red-900">{config.email_address}</p>
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
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{config.email_address}</CardTitle>
            <CardDescription>
              Created {new Date(config.created_at).toLocaleDateString()}
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            {config.analyze_attachments && (
              <Badge variant="secondary">Attachments</Badge>
            )}
            {config.follow_links && (
              <Badge variant="secondary">
                {config.content_retrieval_strategy === 'search_only' && '🔍 Search Only'}
                {config.content_retrieval_strategy === 'scrape_and_search' && '🔀 Scrape + Search'}
                {(!config.content_retrieval_strategy || config.content_retrieval_strategy === 'scrape_only') && '🌐 Firecrawl'}
                {' (max: '}{config.max_links_to_scrape ?? 10})
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {config.match_criteria && (
            <div className="space-y-2">
              <p className="text-sm font-medium">What I'm interested in:</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {config.match_criteria}
              </p>
            </div>
          )}
          {config.extraction_fields && (
            <div className="space-y-2">
              <p className="text-sm font-medium">What to extract:</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {config.extraction_fields}
              </p>
            </div>
          )}
          {config.user_intent && (
            <div className="space-y-2">
              <p className="text-sm font-medium">My goal/intent:</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {config.user_intent}
              </p>
            </div>
          )}
          {config.button_text_pattern && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Button text pattern:</p>
              <p className="text-sm text-muted-foreground font-mono">
                {config.button_text_pattern}
              </p>
            </div>
          )}
          {config.link_selection_guidance && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Link selection guidance:</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {config.link_selection_guidance}
              </p>
            </div>
          )}
          {config.extraction_examples && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Extraction examples:</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap font-mono text-xs">
                {config.extraction_examples}
              </p>
            </div>
          )}
          {config.analysis_feedback && (
            <div className="space-y-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm font-medium text-yellow-900">📝 Feedback/Notes:</p>
              <p className="text-sm text-yellow-800 whitespace-pre-wrap">
                {config.analysis_feedback}
              </p>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-end space-x-2">
        <Button variant="outline" onClick={() => setIsEditing(true)}>
          Edit
        </Button>
        <Button
          variant="destructive"
          onClick={() => setShowDeleteConfirm(true)}
        >
          Delete
        </Button>
      </CardFooter>
    </Card>
  )
}

