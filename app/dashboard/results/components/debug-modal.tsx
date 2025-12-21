'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Copy, Check, Code, Database, FileJson } from 'lucide-react'

interface DebugModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  email: {
    id: string
    email_subject: string
    extracted_data?: Record<string, unknown>
    data_by_source?: unknown[]
    reasoning?: string
    confidence?: number
    scraped_urls?: string[]
    scraped_content?: unknown
    kb_search_results?: unknown
  } | null
  selectedJobData?: unknown
}

export function DebugModal({ 
  open, 
  onOpenChange, 
  email,
  selectedJobData 
}: DebugModalProps) {
  const [activeTab, setActiveTab] = useState('all')
  const [copied, setCopied] = useState(false)

  if (!email) return null

  const copyToClipboard = (data: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatJson = (data: unknown) => {
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  }

  // Normalize data_by_source to array
  const dataBySource = Array.isArray(email.data_by_source) 
    ? email.data_by_source 
    : email.data_by_source && typeof email.data_by_source === 'object' && 'results' in email.data_by_source
      ? (email.data_by_source as { results: unknown[] }).results
      : []

  const fullDebugData = {
    emailId: email.id,
    subject: email.email_subject,
    confidence: email.confidence,
    reasoning: email.reasoning,
    extractedData: email.extracted_data,
    dataBySources: dataBySource,
    selectedJob: selectedJobData,
    scrapedUrls: email.scraped_urls,
    scrapedContent: email.scraped_content,
    kbSearchResults: email.kb_search_results,
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:w-[800px] sm:max-w-[90vw]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Debug Data
          </SheetTitle>
          <SheetDescription className="truncate">
            {email.email_subject}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-2">
            <Badge variant="outline">
              {dataBySource.length} job(s)
            </Badge>
            {email.confidence !== undefined && (
              <Badge variant="secondary">
                {(email.confidence * 100).toFixed(0)}% confidence
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => copyToClipboard(fullDebugData)}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy All
              </>
            )}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList>
            <TabsTrigger value="all" className="gap-1">
              <FileJson className="h-3 w-3" />
              All Data
            </TabsTrigger>
            <TabsTrigger value="jobs" className="gap-1">
              <Database className="h-3 w-3" />
              Jobs ({dataBySource.length})
            </TabsTrigger>
            {selectedJobData !== undefined && selectedJobData !== null && (
              <TabsTrigger value="selected" className="gap-1">
                Selected Job
              </TabsTrigger>
            )}
            <TabsTrigger value="reasoning">
              Reasoning
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 h-[calc(100vh-280px)]">
            <TabsContent value="all" className="h-full m-0">
              <ScrollArea className="h-full rounded-md border bg-muted/30">
                <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
                  {formatJson(fullDebugData)}
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="jobs" className="h-full m-0">
              <ScrollArea className="h-full rounded-md border bg-muted/30">
                <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
                  {formatJson(dataBySource)}
                </pre>
              </ScrollArea>
            </TabsContent>

            {selectedJobData !== undefined && selectedJobData !== null && (
              <TabsContent value="selected" className="h-full m-0">
                <ScrollArea className="h-full rounded-md border bg-muted/30">
                  <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
                    {formatJson(selectedJobData)}
                  </pre>
                </ScrollArea>
              </TabsContent>
            )}

            <TabsContent value="reasoning" className="h-full m-0">
              <ScrollArea className="h-full rounded-md border bg-muted/30">
                <div className="p-4 space-y-4">
                  <div>
                    <h4 className="font-medium text-sm mb-2">Overall Reasoning</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {email.reasoning || 'No reasoning available'}
                    </p>
                  </div>
                  
                  {dataBySource.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">Per-Job Reasoning</h4>
                      <div className="space-y-3">
                        {dataBySource.map((job: unknown, idx: number) => {
                          const jobData = job as { company?: string; position?: string; matchReasoning?: string }
                          return (
                            <div key={idx} className="border rounded-md p-3 bg-background">
                              <p className="font-medium text-sm">
                                {jobData.position || 'Unknown'} at {jobData.company || 'Unknown'}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {jobData.matchReasoning || 'No reasoning'}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

export default DebugModal

