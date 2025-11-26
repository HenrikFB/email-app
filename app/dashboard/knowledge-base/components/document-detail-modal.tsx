'use client'

/**
 * Document Detail Modal
 * 
 * Modal for viewing and editing document details, including reprocessing
 */

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { updateDocument, reprocessDocument, updateDocumentContent } from '../documents/actions'
import type { KBDocument } from '../documents/actions'
import type { ProcessingConfig } from '@/lib/document-processing/client'
import { Loader2, FileText, RefreshCw, Save, ChevronDown, ChevronUp } from 'lucide-react'

export interface DocumentDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: KBDocument | null
  onSave?: () => void
}

export function DocumentDetailModal({
  open,
  onOpenChange,
  document,
  onSave,
}: DocumentDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isReprocessing, setIsReprocessing] = useState(false)
  const [showReprocessConfig, setShowReprocessConfig] = useState(false)
  
  // Form state
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [notes, setNotes] = useState('')
  
  // Reprocess configuration state
  const [pageRangeMode, setPageRangeMode] = useState<'all' | 'range' | 'first' | 'last'>('all')
  const [pageRangeValues, setPageRangeValues] = useState({
    start: '',
    end: '',
    count: '',
  })

  // Generate reprocess config based on page range mode
  const getReprocessConfig = (): ProcessingConfig => {
    let pageRange: ProcessingConfig['pageRange'] = undefined

    switch (pageRangeMode) {
      case 'first':
        if (pageRangeValues.count) {
          const count = parseInt(pageRangeValues.count)
          pageRange = { start: 1, end: count }
        }
        break
      case 'last':
        if (pageRangeValues.count) {
          const count = parseInt(pageRangeValues.count)
          pageRange = { start: -count }
        }
        break
      case 'range':
        if (pageRangeValues.start || pageRangeValues.end) {
          pageRange = {
            start: pageRangeValues.start ? parseInt(pageRangeValues.start) : undefined,
            end: pageRangeValues.end ? parseInt(pageRangeValues.end) : undefined,
          }
        }
        break
      case 'all':
      default:
        pageRange = undefined
    }

    return {
      pageRange,
      extractImages: false,
      ocrEnabled: false,
    }
  }

  // Reset form when document changes
  useEffect(() => {
    if (document) {
      setTitle(document.title)
      setContent(document.content)
      setNotes(document.notes || '')
      
      // Initialize page range mode from existing config if available
      if (document.processing_config) {
        const config = document.processing_config as ProcessingConfig
        if (config.pageRange) {
          const { start, end } = config.pageRange
          if (start && start < 0) {
            // Last X pages
            setPageRangeMode('last')
            setPageRangeValues({ start: '', end: '', count: Math.abs(start).toString() })
          } else if (start === 1 && end) {
            // First X pages
            setPageRangeMode('first')
            setPageRangeValues({ start: '', end: '', count: end.toString() })
          } else if (start || end) {
            // Custom range
            setPageRangeMode('range')
            setPageRangeValues({ 
              start: start?.toString() || '', 
              end: end?.toString() || '', 
              count: '' 
            })
          }
        }
      }
    }
  }, [document])

  if (!document) return null

  const isUploadedDocument = document.type === 'uploaded_document'
  const canReprocess = isUploadedDocument && document.file_path

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // For uploaded documents in review mode, use updateDocumentContent
      if (document.processing_status === 'ready_for_review' && isUploadedDocument) {
        const result = await updateDocumentContent(document.id, content, true)
        if (!result.success) {
          throw new Error(result.error)
        }
      } else {
        // For other documents, use regular update
        const result = await updateDocument(document.id, {
          title,
          content,
          notes: notes || undefined,
        })
        if (!result.success) {
          throw new Error(result.error)
        }
      }

      setIsEditing(false)
      onSave?.()
    } catch (error) {
      console.error('Save error:', error)
      alert(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleReprocess = async () => {
    if (!canReprocess) return

    setIsReprocessing(true)
    try {
      const config = getReprocessConfig()
      const result = await reprocessDocument(document.id, config)
      if (!result.success) {
        throw new Error(result.error)
      }

      alert('Document reprocessed successfully!')
      onSave?.()
      onOpenChange(false)
    } catch (error) {
      console.error('Reprocess error:', error)
      alert(`Reprocessing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsReprocessing(false)
    }
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'processing': return 'bg-blue-500'
      case 'failed': return 'bg-red-500'
      case 'ready_for_review': return 'bg-yellow-500'
      case 'pending': return 'bg-gray-500'
      default: return 'bg-gray-400'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {isEditing ? (
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="font-semibold"
              />
            ) : (
              <span>{document.title}</span>
            )}
          </DialogTitle>
          <DialogDescription>
            {document.type === 'text_note' && 'Text Note'}
            {document.type === 'uploaded_document' && 'Uploaded Document'}
            {document.type === 'saved_email' && 'Saved Email'}
            {document.type === 'saved_url' && 'Saved URL'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Metadata section */}
          {isUploadedDocument && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg text-sm">
              <div>
                <span className="font-semibold">File:</span> {document.original_filename}
              </div>
              <div>
                <span className="font-semibold">Size:</span> {formatFileSize(document.file_size)}
              </div>
              <div>
                <span className="font-semibold">Type:</span> {document.file_type}
              </div>
              <div>
                <span className="font-semibold">Status:</span>{' '}
                <Badge className={getStatusColor(document.processing_status)}>
                  {document.processing_status || 'N/A'}
                </Badge>
              </div>
              {document.processed_at && (
                <div className="col-span-2">
                  <span className="font-semibold">Processed:</span>{' '}
                  {new Date(document.processed_at).toLocaleString()}
                </div>
              )}
              {document.processing_error && (
                <div className="col-span-2 text-red-600">
                  <span className="font-semibold">Error:</span> {document.processing_error}
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <div>
            <Label>Content</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={!isEditing}
              className="min-h-[300px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {content.length} characters
            </p>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!isEditing}
              placeholder="Add notes about this document..."
              rows={3}
            />
          </div>

          {/* Reprocess section (only for uploaded documents) */}
          {canReprocess && (
            <Collapsible open={showReprocessConfig} onOpenChange={setShowReprocessConfig}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full" disabled={isReprocessing}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  <span className="flex-1 text-left">Reprocess with Different Settings</span>
                  {showReprocessConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div className="space-y-4">
                  <Label>Page Selection (PDF only)</Label>
                  
                  {/* Mode Selector */}
                  <RadioGroup 
                    value={pageRangeMode} 
                    onValueChange={(v) => setPageRangeMode(v as 'all' | 'range' | 'first' | 'last')}
                    disabled={isReprocessing}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="reprocess-all" />
                      <Label htmlFor="reprocess-all" className="font-normal cursor-pointer">
                        All pages
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="first" id="reprocess-first" />
                      <Label htmlFor="reprocess-first" className="font-normal cursor-pointer">
                        First X pages
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="last" id="reprocess-last" />
                      <Label htmlFor="reprocess-last" className="font-normal cursor-pointer">
                        Last X pages
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="range" id="reprocess-range" />
                      <Label htmlFor="reprocess-range" className="font-normal cursor-pointer">
                        Custom range
                      </Label>
                    </div>
                  </RadioGroup>

                  {/* Dynamic Input based on mode */}
                  {pageRangeMode === 'first' && (
                    <div className="flex items-center gap-2 pl-6 animate-in fade-in-50 duration-200">
                      <Label className="text-sm text-muted-foreground whitespace-nowrap">First</Label>
                      <Input
                        type="number"
                        placeholder="5"
                        min="1"
                        value={pageRangeValues.count}
                        onChange={(e) => setPageRangeValues({ ...pageRangeValues, count: e.target.value })}
                        className="w-24"
                        disabled={isReprocessing}
                      />
                      <Label className="text-sm text-muted-foreground">pages</Label>
                    </div>
                  )}

                  {pageRangeMode === 'last' && (
                    <div className="flex items-center gap-2 pl-6 animate-in fade-in-50 duration-200">
                      <Label className="text-sm text-muted-foreground whitespace-nowrap">Last</Label>
                      <Input
                        type="number"
                        placeholder="3"
                        min="1"
                        value={pageRangeValues.count}
                        onChange={(e) => setPageRangeValues({ ...pageRangeValues, count: e.target.value })}
                        className="w-24"
                        disabled={isReprocessing}
                      />
                      <Label className="text-sm text-muted-foreground">pages</Label>
                    </div>
                  )}

                  {pageRangeMode === 'range' && (
                    <div className="flex items-center gap-2 pl-6 animate-in fade-in-50 duration-200">
                      <Label className="text-sm text-muted-foreground">From page</Label>
                      <Input
                        type="number"
                        placeholder="1"
                        min="1"
                        value={pageRangeValues.start}
                        onChange={(e) => setPageRangeValues({ ...pageRangeValues, start: e.target.value })}
                        className="w-24"
                        disabled={isReprocessing}
                      />
                      <Label className="text-sm text-muted-foreground">to</Label>
                      <Input
                        type="number"
                        placeholder="10"
                        min="1"
                        value={pageRangeValues.end}
                        onChange={(e) => setPageRangeValues({ ...pageRangeValues, end: e.target.value })}
                        className="w-24"
                        disabled={isReprocessing}
                      />
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleReprocess}
                  disabled={isReprocessing}
                  className="w-full"
                >
                  {isReprocessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Reprocess Document
                </Button>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Close
          </Button>
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => {
                setIsEditing(false)
                setTitle(document.title)
                setContent(document.content)
                setNotes(document.notes || '')
              }}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
