'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { generateCoverLetter } from '../actions'
import { Copy, Check, Loader2, FileText, Sparkles } from 'lucide-react'

export function DraftingForm() {
  const [jobDescription, setJobDescription] = useState('')
  const [coverLetter, setCoverLetter] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError('')
    setCoverLetter('')

    const result = await generateCoverLetter(jobDescription)

    if (result.success && result.coverLetter) {
      setCoverLetter(result.coverLetter)
    } else {
      setError(result.error || 'Failed to generate cover letter')
    }

    setIsGenerating(false)
  }

  const handleCopy = async () => {
    if (coverLetter) {
      await navigator.clipboard.writeText(coverLetter)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Job Description
          </CardTitle>
          <CardDescription>
            Paste the job description here. The AI will extract the tech stack and apply relevant rules.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Paste the job description here..."
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            className="min-h-[400px] font-mono text-sm"
          />
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !jobDescription.trim()}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Cover Letter
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Output Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Generated Cover Letter
              </CardTitle>
              <CardDescription>
                Your generated cover letter will appear here.
              </CardDescription>
            </div>
            {coverLetter && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="rounded-md bg-destructive/10 p-4 text-destructive text-sm">
              {error}
            </div>
          )}
          {coverLetter ? (
            <div className="whitespace-pre-wrap rounded-md bg-muted p-4 font-mono text-sm min-h-[400px]">
              {coverLetter}
            </div>
          ) : (
            <div className="flex items-center justify-center min-h-[400px] rounded-md border border-dashed text-muted-foreground">
              {isGenerating ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span>Generating your cover letter...</span>
                </div>
              ) : (
                <span>Your cover letter will appear here</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

