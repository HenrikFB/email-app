'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Mail, Briefcase, ExternalLink, ArrowLeft, Code, FileText } from 'lucide-react'

interface JobData {
  id?: string
  source_name?: string
  source_url?: string | null
  matched?: boolean
  company?: string
  position?: string
  location?: string
  confidence?: number
  matchReasoning?: string
  technologies?: string[]
  deadline?: string | null
  found?: boolean
  sourceType?: string
  iterations?: number
  experience_level?: string
  competencies?: string[]
  company_domains?: string
  work_type?: string
  raw_content?: string
}

interface EmailPreviewPanelProps {
  email: {
    id: string
    email_subject: string
    email_from: string
    email_date: string
    email_html_body?: string
    email_snippet?: string | null
  } | null
  selectedJob: JobData | null
  onBackToEmail: () => void
  onOpenDebug: () => void
}

// Simple HTML to text converter
function htmlToPlainText(html: string): string {
  // Remove script and style elements
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  
  // Replace common elements with appropriate spacing
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/p>/gi, '\n\n')
  text = text.replace(/<\/div>/gi, '\n')
  text = text.replace(/<\/li>/gi, '\n')
  text = text.replace(/<\/tr>/gi, '\n')
  text = text.replace(/<\/h[1-6]>/gi, '\n\n')
  
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '')
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#39;/g, "'")
  
  // Clean up whitespace
  text = text.replace(/[ \t]+/g, ' ')
  text = text.replace(/\n{3,}/g, '\n\n')
  text = text.trim()
  
  return text
}

export function EmailPreviewPanel({ 
  email, 
  selectedJob, 
  onBackToEmail,
  onOpenDebug 
}: EmailPreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'raw'>('preview')
  
  // Convert HTML to plain text for the raw view
  const plainTextContent = useMemo(() => {
    if (!email?.email_html_body) return email?.email_snippet || 'No content available'
    return htmlToPlainText(email.email_html_body)
  }, [email?.email_html_body, email?.email_snippet])
  
  if (!email) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground p-8">
        <div className="text-center">
          <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No email selected</p>
          <p className="text-sm">Click on an analysis result to view details</p>
        </div>
      </div>
    )
  }

  // Show job details if a job is selected
  if (selectedJob) {
    return (
      <div className="h-full flex flex-col">
        {/* Header - Fixed */}
        <div className="flex-shrink-0 flex items-center justify-between border-b p-4 bg-background">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onBackToEmail}
              className="gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Email
            </Button>
          </div>
          <Badge variant="outline" className="gap-1">
            <Briefcase className="h-3 w-3" />
            Job Details
          </Badge>
        </div>

        {/* Job Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Job Header */}
          <div>
            <h2 className="text-xl font-semibold">{selectedJob.position || 'Unknown Position'}</h2>
            <p className="text-muted-foreground">{selectedJob.company || 'Unknown Company'}</p>
          </div>

          {/* Match Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Match Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={selectedJob.matched ? 'default' : 'destructive'}>
                  {selectedJob.matched ? 'Matched' : 'Rejected'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Confidence</span>
                <span>{((selectedJob.confidence || 0) * 100).toFixed(0)}%</span>
              </div>
              {selectedJob.found !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Research</span>
                  <Badge variant={selectedJob.found ? 'secondary' : 'outline'}>
                    {selectedJob.found ? 'Found' : 'Not Found'}
                  </Badge>
                </div>
              )}
              {selectedJob.iterations !== undefined && selectedJob.iterations > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Research Iterations</span>
                  <span>{selectedJob.iterations}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Job Details */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {selectedJob.location ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Location</span>
                  <span>{selectedJob.location}</span>
                </div>
              ) : (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Location</span>
                  <span className="text-muted-foreground/50">Not specified</span>
                </div>
              )}
              {selectedJob.experience_level ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Experience</span>
                  <span>{selectedJob.experience_level}</span>
                </div>
              ) : (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Experience</span>
                  <span className="text-muted-foreground/50">Not specified</span>
                </div>
              )}
              {selectedJob.work_type ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Work Type</span>
                  <span>{selectedJob.work_type}</span>
                </div>
              ) : (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Work Type</span>
                  <span className="text-muted-foreground/50">Not specified</span>
                </div>
              )}
              {selectedJob.deadline && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deadline</span>
                  <span>{selectedJob.deadline}</span>
                </div>
              )}
              {selectedJob.source_url && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Source</span>
                  <a 
                    href={selectedJob.source_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    View Job <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              {selectedJob.sourceType && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Source Type</span>
                  <span className="capitalize">{selectedJob.sourceType}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Technologies */}
          {selectedJob.technologies && selectedJob.technologies.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Technologies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {selectedJob.technologies.map((tech, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {tech}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Competencies */}
          {selectedJob.competencies && selectedJob.competencies.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Competencies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {selectedJob.competencies.map((comp, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {comp}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reasoning */}
          {selectedJob.matchReasoning && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">AI Reasoning</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {selectedJob.matchReasoning}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Raw Content Preview */}
          {selectedJob.raw_content && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Job Description (from research)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[400px] overflow-y-auto">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 p-3 rounded-md">
                    {selectedJob.raw_content}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Debug Button */}
          <Button 
            variant="outline" 
            className="w-full gap-2"
            onClick={onOpenDebug}
          >
            <Code className="h-4 w-4" />
            View Full Debug Data
          </Button>
        </div>
      </div>
    )
  }

  // Show email preview (default)
  return (
    <div className="h-full flex flex-col">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 flex items-center justify-between border-b p-4 bg-background">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium truncate">{email.email_subject}</h3>
          <p className="text-sm text-muted-foreground truncate">From: {email.email_from}</p>
        </div>
        <Badge variant="outline" className="gap-1 flex-shrink-0 ml-2">
          <Mail className="h-3 w-3" />
          Email Preview
        </Badge>
      </div>

      {/* Tabs - Fixed */}
      <div className="flex-shrink-0 border-b">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'preview' | 'raw')}>
          <TabsList className="m-2">
            <TabsTrigger value="preview">Rendered</TabsTrigger>
            <TabsTrigger value="raw">Plain Text</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'preview' ? (
          email.email_html_body ? (
            <div 
              className="p-4 prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: email.email_html_body }}
            />
          ) : (
            <div className="p-4 text-muted-foreground">
              No HTML content available
            </div>
          )
        ) : (
          <pre className="p-4 text-sm whitespace-pre-wrap font-mono">
            {plainTextContent}
          </pre>
        )}
      </div>

      {/* Debug Button - Fixed */}
      <div className="flex-shrink-0 border-t p-4 bg-background">
        <Button 
          variant="outline" 
          className="w-full gap-2"
          onClick={onOpenDebug}
        >
          <Code className="h-4 w-4" />
          View Full Debug Data
        </Button>
      </div>
    </div>
  )
}

export default EmailPreviewPanel
