'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronRight, Loader2 } from 'lucide-react'
import { getFullEmailDetails } from '../actions'
import type { Email } from '@/lib/email-provider/types'

interface EmailDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  emailId: string | null
  connectionId: string
  initialEmail?: Email // Optional: if email is already loaded, use it
}

export function EmailDetailSheet({
  open,
  onOpenChange,
  emailId,
  connectionId,
  initialEmail,
}: EmailDetailSheetProps) {
  const [email, setEmail] = useState<Email | null>(initialEmail || null)
  const [rawResponse, setRawResponse] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Always fetch full email details when sheet opens, even if we have initialEmail
    // because initialEmail from list view doesn't have body content
    if (open && emailId) {
      setLoading(true)
      setError(null)
      
      console.log('Fetching full email details for:', { emailId, connectionId })
      
      getFullEmailDetails(connectionId, emailId)
        .then((result) => {
          console.log('Full email details result:', {
            hasEmail: !!result.email,
            hasError: !!result.error,
            hasBody: !!result.email?.body,
            hasBodyHtml: !!result.email?.bodyHtml,
          })
          
          if (result.error) {
            setError(result.error)
            setEmail(null)
            setRawResponse(null)
          } else {
            setEmail(result.email)
            setRawResponse(result.rawResponse || null)
          }
        })
        .catch((err) => {
          console.error('Error fetching full email details:', err)
          setError(err instanceof Error ? err.message : 'Failed to load email')
          setEmail(null)
        })
        .finally(() => {
          setLoading(false)
        })
    } else if (!open) {
      // Reset when sheet closes
      setEmail(null)
      setRawResponse(null)
      setError(null)
    }
  }, [open, emailId, connectionId])

  // Reset state when sheet closes
  useEffect(() => {
    if (!open) {
      // Keep email data but reset error/loading
      setError(null)
      setLoading(false)
    }
  }, [open])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
      full: date.toISOString(),
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {email?.subject || 'Email Details'}
          </SheetTitle>
          <SheetDescription>
            {email && `From: ${email.from.name || email.from.address}`}
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading email...</span>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-md bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-medium">Error loading email</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {email && !loading && (
          <div className="mt-6">
            <Tabs defaultValue="plain-text" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="plain-text">Plain Text</TabsTrigger>
                <TabsTrigger value="html">HTML Preview</TabsTrigger>
                <TabsTrigger value="raw-html">Raw HTML</TabsTrigger>
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
                <TabsTrigger value="raw-api">Raw API Data</TabsTrigger>
              </TabsList>

              {/* Plain Text Tab */}
              <TabsContent value="plain-text" className="mt-4">
                <div className="rounded-md border bg-muted/50 p-4">
                  {email.body ? (
                    <pre className="whitespace-pre-wrap break-words font-mono text-sm">
                      {email.body}
                    </pre>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No plain text content available. This email may only have HTML content.
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* HTML Preview Tab */}
              <TabsContent value="html" className="mt-4">
                <div className="rounded-md border bg-muted/50">
                  {email.bodyHtml ? (
                    <div className="p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          HTML content preview (rendered)
                        </p>
                        <Badge variant="secondary" className="text-xs">
                          {email.bodyHtml.length} characters
                        </Badge>
                      </div>
                      <div className="max-h-[600px] overflow-auto rounded border bg-background p-4">
                        <iframe
                          srcDoc={email.bodyHtml}
                          className="h-full w-full border-0"
                          sandbox="allow-same-origin"
                          title="Email HTML content"
                          style={{ minHeight: '400px' }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="p-4">
                      <p className="text-sm text-muted-foreground">
                        No HTML content available. This email may only have plain text content.
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Raw HTML Tab */}
              <TabsContent value="raw-html" className="mt-4">
                <div className="rounded-md border bg-muted/50">
                  {email.bodyHtml ? (
                    <div className="p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          Raw HTML source code
                        </p>
                        <Badge variant="secondary" className="text-xs">
                          {email.bodyHtml.length} characters
                        </Badge>
                      </div>
                      <div className="max-h-[600px] overflow-auto rounded border bg-background p-4">
                        <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                          {email.bodyHtml}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4">
                      <p className="text-sm text-muted-foreground">
                        No HTML content available. This email may only have plain text content.
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Metadata Tab */}
              <TabsContent value="metadata" className="mt-4 space-y-4">
                {/* Basic Info */}
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border p-4 hover:bg-muted/50">
                    <span className="font-medium">Basic Information</span>
                    <ChevronRight className="h-4 w-4 transition-transform data-[state=open]:rotate-90" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 pb-4">
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium text-muted-foreground">Subject:</span>
                        <p className="mt-1">{email.subject}</p>
                      </div>
                      <div>
                        <span className="font-medium text-muted-foreground">From:</span>
                        <p className="mt-1">
                          {email.from.name && (
                            <span className="font-medium">{email.from.name}</span>
                          )}
                          <span className={email.from.name ? ' text-muted-foreground' : ''}>
                            {' '}
                            &lt;{email.from.address}&gt;
                          </span>
                        </p>
                      </div>
                      {email.to && email.to.length > 0 && (
                        <div>
                          <span className="font-medium text-muted-foreground">To:</span>
                          <div className="mt-1 space-y-1">
                            {email.to.map((recipient, idx) => (
                              <p key={idx}>
                                {recipient.name && (
                                  <span className="font-medium">{recipient.name}</span>
                                )}
                                <span className={recipient.name ? ' text-muted-foreground' : ''}>
                                  {' '}
                                  &lt;{recipient.address}&gt;
                                </span>
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                      {email.cc && email.cc.length > 0 && (
                        <div>
                          <span className="font-medium text-muted-foreground">CC:</span>
                          <div className="mt-1 space-y-1">
                            {email.cc.map((recipient, idx) => (
                              <p key={idx}>
                                {recipient.name && (
                                  <span className="font-medium">{recipient.name}</span>
                                )}
                                <span className={recipient.name ? ' text-muted-foreground' : ''}>
                                  {' '}
                                  &lt;{recipient.address}&gt;
                                </span>
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <span className="font-medium text-muted-foreground">Date:</span>
                        <p className="mt-1">
                          {formatDate(email.receivedDateTime).date} at{' '}
                          {formatDate(email.receivedDateTime).time}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(email.receivedDateTime).full}
                        </p>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Status & Flags */}
                <Collapsible>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border p-4 hover:bg-muted/50">
                    <span className="font-medium">Status & Flags</span>
                    <ChevronRight className="h-4 w-4 transition-transform data-[state=open]:rotate-90" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 pb-4">
                    <div className="flex flex-wrap gap-2">
                      {email.isRead ? (
                        <Badge variant="outline">Read</Badge>
                      ) : (
                        <Badge variant="default">Unread</Badge>
                      )}
                      {email.isDraft && <Badge variant="secondary">Draft</Badge>}
                      {email.hasAttachments && (
                        <Badge variant="secondary">Has Attachments</Badge>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Attachments */}
                {email.attachments && email.attachments.length > 0 && (
                  <Collapsible>
                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border p-4 hover:bg-muted/50">
                      <span className="font-medium">
                        Attachments ({email.attachments.length})
                      </span>
                      <ChevronRight className="h-4 w-4 transition-transform data-[state=open]:rotate-90" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-4 pb-4">
                      <div className="space-y-2">
                        {email.attachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className="flex items-center justify-between rounded-md border p-3"
                          >
                            <div className="flex-1">
                              <p className="font-medium text-sm">{attachment.filename}</p>
                              <p className="text-xs text-muted-foreground">
                                {attachment.contentType} •{' '}
                                {(attachment.size / 1024).toFixed(2)} KB
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Technical Details */}
                <Collapsible>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border p-4 hover:bg-muted/50">
                    <span className="font-medium">Technical Details</span>
                    <ChevronRight className="h-4 w-4 transition-transform data-[state=open]:rotate-90" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 pb-4">
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium text-muted-foreground">Email ID:</span>
                        <p className="mt-1 font-mono text-xs">{email.id}</p>
                      </div>
                      {email.internetMessageId && (
                        <div>
                          <span className="font-medium text-muted-foreground">
                            Internet Message ID:
                          </span>
                          <p className="mt-1 font-mono text-xs break-all">
                            {email.internetMessageId}
                          </p>
                        </div>
                      )}
                      {email.snippet && (
                        <div>
                          <span className="font-medium text-muted-foreground">Snippet:</span>
                          <p className="mt-1">{email.snippet}</p>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </TabsContent>

              {/* Raw API Data Tab */}
              <TabsContent value="raw-api" className="mt-4">
                <div className="rounded-md border bg-muted/50">
                  {rawResponse ? (
                    <div className="p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          Raw Microsoft Graph API Response
                        </p>
                        <Badge variant="secondary" className="text-xs">
                          {JSON.stringify(rawResponse).length} characters
                        </Badge>
                      </div>
                      <div className="max-h-[600px] overflow-auto rounded border bg-background p-4">
                        <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                          {JSON.stringify(rawResponse, null, 2)}
                        </pre>
                      </div>
                      {rawResponse.body && (
                        <div className="mt-4 rounded border bg-background/50 p-4">
                          <p className="mb-2 text-sm font-medium">Raw Body Object:</p>
                          <div className="max-h-[300px] overflow-auto rounded border bg-background p-3">
                            <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                              {JSON.stringify(rawResponse.body, null, 2)}
                            </pre>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            <p>
                              <span className="font-medium">Content Type:</span>{' '}
                              {rawResponse.body.contentType}
                            </p>
                            <p>
                              <span className="font-medium">Content Length:</span>{' '}
                              {rawResponse.body.content?.length || 0} characters
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4">
                      <p className="text-sm text-muted-foreground">
                        Raw API response not available. This may be from a non-Microsoft provider or the response was not captured.
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

