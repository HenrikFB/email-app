'use client'

/**
 * Upload Document Modal
 * 
 * Modal for uploading documents with configuration options
 */

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Progress } from '@/components/ui/progress'
import { SimpleFileUploader, type UploadedFile } from './simple-file-uploader'
import { createPendingDocuments, processDocumentBatch } from '../documents/actions'
import type { ProcessingConfig } from '@/lib/document-processing/client'
import { ChevronDown, ChevronUp, FileText, Loader2, AlertCircle } from 'lucide-react'

export interface UploadDocumentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  knowledgeBaseId: string
  userId: string
  autoSaveUploads: boolean // From KB settings
}

export function UploadDocumentModal({
  open,
  onOpenChange,
  knowledgeBaseId,
  userId,
  autoSaveUploads,
}: UploadDocumentModalProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [uploadedFiles, setUploadedFiles] = useState<Array<{
    id: string
    name: string
    size: number
    type: string
    storagePath: string
    status: 'uploaded' | 'processing' | 'completed' | 'failed'
    error?: string
  }>>([])
  
  // Configuration state
  const [autoSave, setAutoSave] = useState(autoSaveUploads)
  const [showConfig, setShowConfig] = useState(false)
  const [pageRangeMode, setPageRangeMode] = useState<'all' | 'range' | 'first' | 'last'>('all')
  const [pageRangeValues, setPageRangeValues] = useState({
    start: '',
    end: '',
    count: '',
  })

  // Generate batch config based on page range mode
  const getBatchConfig = (): ProcessingConfig => {
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
          // For "last X pages", we'll use a negative start value as a marker
          // The processing logic will handle this
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

  const handleUploadSuccess = async (files: UploadedFile[]) => {
    setUploadedFiles(files.map(f => ({ 
      id: crypto.randomUUID(),
      name: f.name,
      size: f.size,
      type: f.type,
      storagePath: f.path,
      status: 'uploaded' as const 
    })))
    setIsProcessing(true)
    setProcessingProgress(0)

    try {
      // Create pending documents in database
      const currentConfig = getBatchConfig()
      const pendingDocs = files.map(file => ({
        knowledgeBaseId,
        filename: file.name,
        filePath: file.path,
        fileSize: file.size,
        fileType: file.type,
        processingConfig: currentConfig,
      }))

      const createResult = await createPendingDocuments(pendingDocs)

      if (!createResult.success || !createResult.documents) {
        throw new Error(createResult.error || 'Failed to create documents')
      }

      // Update file statuses to processing
      setUploadedFiles(prev => 
        prev.map(f => ({ ...f, status: 'processing' as const }))
      )

      // Process documents
      const documentIds = createResult.documents.map(doc => doc.id)
      const processResult = await processDocumentBatch(documentIds, autoSave)

      if (!processResult.success || !processResult.results) {
        throw new Error(processResult.error || 'Processing failed')
      }

      // Update statuses based on results
      setUploadedFiles(prev => 
        prev.map((f, idx) => {
          const result = processResult.results![idx]
          return {
            ...f,
            status: result.success ? 'completed' as const : 'failed' as const,
            error: result.error,
          }
        })
      )

      setProcessingProgress(100)

      // Close modal after 2 seconds if all succeeded
      const allSucceeded = processResult.results.every(r => r.success)
      if (allSucceeded) {
        setTimeout(() => {
          onOpenChange(false)
          resetState()
        }, 2000)
      }
    } catch (error) {
      console.error('Upload/processing error:', error)
      setUploadedFiles(prev => 
        prev.map(f => ({ 
          ...f, 
          status: 'failed' as const,
          error: error instanceof Error ? error.message : 'Unknown error',
        }))
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUploadError = (error: Error) => {
    console.error('Upload error:', error)
    alert(`Upload failed: ${error.message}`)
  }

  const resetState = () => {
    setUploadedFiles([])
    setProcessingProgress(0)
    setIsProcessing(false)
    setPageRangeMode('all')
    setPageRangeValues({ start: '', end: '', count: '' })
  }

  const handleClose = () => {
    if (!isProcessing) {
      resetState()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
          <DialogDescription>
            Upload PDFs and other documents to your knowledge base. 
            Files will be processed and embeddings will be generated automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Auto-save toggle */}
          <div className="flex items-center space-x-2 p-4 bg-muted/50 rounded-lg">
            <Checkbox
              id="auto-save"
              checked={autoSave}
              onCheckedChange={(checked) => setAutoSave(checked as boolean)}
              disabled={isProcessing}
            />
            <Label htmlFor="auto-save" className="cursor-pointer">
              Process and save automatically
              <span className="block text-xs text-muted-foreground mt-1">
                {autoSave 
                  ? 'Documents will be embedded immediately after processing'
                  : 'You can review and edit content before saving'}
              </span>
            </Label>
          </div>

          {/* Batch configuration (collapsible) */}
          <Collapsible open={showConfig} onOpenChange={setShowConfig}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full" disabled={isProcessing}>
                <span className="flex-1 text-left">Processing Configuration</span>
                {showConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="space-y-4">
                <Label>Page Selection (PDF only)</Label>
                
                {/* Mode Selector */}
                <RadioGroup 
                  value={pageRangeMode} 
                  onValueChange={(v) => setPageRangeMode(v as 'all' | 'range' | 'first' | 'last')}
                  disabled={isProcessing}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="all" />
                    <Label htmlFor="all" className="font-normal cursor-pointer">
                      All pages
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="first" id="first" />
                    <Label htmlFor="first" className="font-normal cursor-pointer">
                      First X pages
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="last" id="last" />
                    <Label htmlFor="last" className="font-normal cursor-pointer">
                      Last X pages
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="range" id="range" />
                    <Label htmlFor="range" className="font-normal cursor-pointer">
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
                      disabled={isProcessing}
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
                      disabled={isProcessing}
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
                      disabled={isProcessing}
                    />
                    <Label className="text-sm text-muted-foreground">to</Label>
                    <Input
                      type="number"
                      placeholder="10"
                      min="1"
                      value={pageRangeValues.end}
                      onChange={(e) => setPageRangeValues({ ...pageRangeValues, end: e.target.value })}
                      className="w-24"
                      disabled={isProcessing}
                    />
                  </div>
                )}
              </div>

              <div className="pt-2 space-y-2 text-xs text-muted-foreground border-t">
                <p>🔜 Coming soon: Image extraction, OCR support</p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* File uploader */}
          {!isProcessing && uploadedFiles.length === 0 && (
            <SimpleFileUploader
              userId={userId}
              knowledgeBaseId={knowledgeBaseId}
              onUploadComplete={handleUploadSuccess}
              onUploadError={handleUploadError}
              maxFileSize={10 * 1024 * 1024} // 10MB
              acceptedTypes={['.pdf', 'application/pdf', '.txt', 'text/plain', '.md', 'text/markdown']}
              maxFiles={10}
            />
          )}

          {/* Processing status */}
          {(isProcessing || uploadedFiles.length > 0) && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Upload Status</h3>
              {uploadedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 border rounded">
                  <FileText className="h-4 w-4" />
                  <span className="flex-1 text-sm truncate">{file.name}</span>
                  {file.status === 'processing' && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {file.status === 'completed' && (
                    <span className="text-xs text-green-600">✓ Completed</span>
                  )}
                  {file.status === 'failed' && (
                    <div className="flex items-center gap-1 text-xs text-red-600">
                      <AlertCircle className="h-4 w-4" />
                      <span>Failed</span>
                    </div>
                  )}
                  {file.status === 'uploaded' && (
                    <span className="text-xs text-muted-foreground">Uploaded</span>
                  )}
                </div>
              ))}
              {isProcessing && (
                <Progress value={processingProgress} className="w-full" />
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isProcessing}
            >
              {uploadedFiles.length > 0 ? 'Close' : 'Cancel'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
