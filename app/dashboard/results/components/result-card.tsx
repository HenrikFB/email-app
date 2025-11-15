'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { runAnalysis } from '../actions'

interface ResultCardProps {
  result: {
    id: string
    email_subject: string
    email_from: string
    email_date: string
    email_snippet: string | null
    has_attachments: boolean
    extracted_data: any
    matched: boolean
    analysis_status: string
    error_message: string | null
    scraped_urls: string[] | null
    agent_configurations: {
      email_address: string
      match_criteria: string | null
      extraction_fields: string | null
    } | null
  }
}

export default function ResultCard({ result }: ResultCardProps) {
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const handleAnalyze = async () => {
    setAnalyzing(true)
    setError(null)

    const response = await runAnalysis(result.id)

    if (!response.success) {
      setError(response.error || 'Failed to analyze email')
    }

    setAnalyzing(false)
  }

  return (
    <Card>
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
        {result.email_snippet && (
          <div>
            <p className="text-sm text-muted-foreground">{result.email_snippet}</p>
          </div>
        )}

        {result.agent_configurations && (
          <div className="rounded-md bg-muted p-3">
            <p className="text-sm font-medium">Agent Configuration:</p>
            <p className="text-sm text-muted-foreground">
              {result.agent_configurations.email_address}
            </p>
          </div>
        )}

        {result.analysis_status === 'completed' && result.extracted_data && (
          <div className="space-y-3">
            <div className="rounded-md border p-4">
              <p className="mb-3 text-sm font-medium">Extracted Data:</p>
              {result.extracted_data.reasoning && (
                <div className="mb-3 rounded-md bg-muted p-2">
                  <p className="text-xs font-medium">Reasoning:</p>
                  <p className="text-xs text-muted-foreground">{result.extracted_data.reasoning}</p>
                </div>
              )}
              {result.extracted_data.confidence !== undefined && (
                <div className="mb-3">
                  <p className="text-xs">
                    Confidence: {(result.extracted_data.confidence * 100).toFixed(0)}%
                  </p>
                </div>
              )}
              <pre className="overflow-x-auto text-xs">
                {JSON.stringify(result.extracted_data, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {result.analysis_status === 'pending' && (
          <div className="space-y-3">
            <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">
              This email is queued for analysis. Click the button below to analyze it now.
            </div>
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}
            <Button 
              onClick={handleAnalyze} 
              disabled={analyzing}
              className="w-full"
            >
              {analyzing ? 'Analyzing...' : 'Analyze Email'}
            </Button>
          </div>
        )}

        {result.analysis_status === 'analyzing' && (
          <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
            Analysis in progress... This may take a minute.
          </div>
        )}

        {result.error_message && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            Error: {result.error_message}
          </div>
        )}

        {result.scraped_urls && result.scraped_urls.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">Scraped URLs:</p>
            <ul className="list-inside list-disc text-sm text-muted-foreground">
              {result.scraped_urls.map((url, index) => (
                <li key={index}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          Queued: {new Date(result.email_date).toLocaleString()}
        </p>
      </CardFooter>
    </Card>
  )
}

