'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
// ScrollArea is optional - use div with overflow if not available
import { FileText } from 'lucide-react'
import { htmlToPlainText } from '@/lib/utils/html-to-text'

interface EmailBodyViewerProps {
  htmlBody: string | null | undefined
  triggerLabel?: string
  triggerVariant?: 'default' | 'outline' | 'ghost' | 'link' | 'destructive' | 'secondary'
  triggerSize?: 'default' | 'sm' | 'lg' | 'icon'
  title?: string
  description?: string
}

/**
 * Reusable component for viewing email body content
 * Converts HTML to plain text for better readability
 */
export function EmailBodyViewer({
  htmlBody,
  triggerLabel = 'View Full Email Body',
  triggerVariant = 'outline',
  triggerSize = 'sm',
  title = 'Email Body Content',
  description = 'Full email content in plain text format'
}: EmailBodyViewerProps) {
  if (!htmlBody) return null

  const plainText = htmlToPlainText(htmlBody)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize} className="text-xs">
          <FileText className="h-3 w-3 mr-1" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto rounded-md border p-4">
          <pre className="whitespace-pre-wrap text-sm font-mono">
            {plainText}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  )
}

