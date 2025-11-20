'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
// ScrollArea is optional - use div with overflow if not available
import { ExternalLink, FileText } from 'lucide-react'
import { useState } from 'react'

interface ScrapedContent {
  markdown: string
  title?: string
  scraped_at?: string
}

interface ScrapedContentViewerProps {
  scrapedContent: Record<string, ScrapedContent> | null | undefined
  triggerLabel?: string
  triggerVariant?: 'default' | 'outline' | 'ghost' | 'link' | 'destructive' | 'secondary'
  triggerSize?: 'default' | 'sm' | 'lg' | 'icon'
  title?: string
}

/**
 * Reusable component for viewing scraped URL markdown content
 * Shows a list of URLs with expandable content viewers
 */
export function ScrapedContentViewer({
  scrapedContent,
  triggerLabel = 'View Scraped Content',
  triggerVariant = 'outline',
  triggerSize = 'sm',
  title = 'Scraped URL Content'
}: ScrapedContentViewerProps) {
  if (!scrapedContent || Object.keys(scrapedContent).length === 0) return null

  const urls = Object.keys(scrapedContent)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize} className="text-xs">
          <FileText className="h-3 w-3 mr-1" />
          {triggerLabel} ({urls.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Markdown content scraped from {urls.length} URL{urls.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto">
          <div className="space-y-4 pr-4">
            {urls.map((url, index) => {
              const content = scrapedContent[url]
              return (
                <ScrapedUrlItem
                  key={url}
                  url={url}
                  content={content}
                  index={index + 1}
                  total={urls.length}
                />
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ScrapedUrlItem({
  url,
  content,
  index,
  total
}: {
  url: string
  content: ScrapedContent
  index: number
  total: number
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const previewLength = 500
  const hasMore = content.markdown.length > previewLength

  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-muted-foreground">
              URL {index}/{total}
            </span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1 truncate"
            >
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{url}</span>
            </a>
          </div>
          {content.title && (
            <p className="text-sm font-medium mb-1">{content.title}</p>
          )}
          {content.scraped_at && (
            <p className="text-xs text-muted-foreground">
              Scraped: {new Date(content.scraped_at).toLocaleString()}
            </p>
          )}
        </div>
      </div>
      
      <div className="border-t pt-2">
        <div className="max-h-[400px] overflow-y-auto">
          <pre className="whitespace-pre-wrap text-xs font-mono bg-muted p-3 rounded">
            {isExpanded || !hasMore
              ? content.markdown
              : `${content.markdown.substring(0, previewLength)}...`}
          </pre>
        </div>
        
        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 text-xs"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Show Less' : 'Show More'}
          </Button>
        )}
      </div>
    </div>
  )
}

