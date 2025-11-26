'use client'

/**
 * Simple File Uploader with Drag & Drop
 * 
 * Clean file upload UI using shadcn-ui components and Supabase Storage
 * Features: Drag & drop, multiple files, progress tracking, file management
 */

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Upload, X, FileText, AlertCircle, CloudUpload, Plus } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

export interface UploadedFile {
  name: string
  path: string
  size: number
  type: string
}

export interface SimpleFileUploaderProps {
  userId: string
  knowledgeBaseId: string
  onUploadComplete: (files: UploadedFile[]) => void
  onUploadError?: (error: Error) => void
  maxFileSize?: number // in bytes
  maxFiles?: number
  acceptedTypes?: string[]
}

export function SimpleFileUploader({
  userId,
  knowledgeBaseId,
  onUploadComplete,
  onUploadError,
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  maxFiles = 10,
  acceptedTypes = ['.pdf', 'application/pdf', '.txt', 'text/plain', '.md', 'text/markdown'],
}: SimpleFileUploaderProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Validate and add files
  const validateAndAddFiles = (files: File[]) => {
    setError(null)

    // Check total file count (existing + new)
    const totalCount = selectedFiles.length + files.length
    if (totalCount > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed (you're trying to add ${files.length} to ${selectedFiles.length} existing)`)
      return false
    }

    // Validate file sizes
    const oversizedFiles = files.filter(f => f.size > maxFileSize)
    if (oversizedFiles.length > 0) {
      setError(
        `Some files exceed ${(maxFileSize / (1024 * 1024)).toFixed(0)}MB limit: ${oversizedFiles
          .map(f => f.name)
          .join(', ')}`
      )
      return false
    }

    // Check for duplicates
    const newFiles = files.filter(
      newFile => !selectedFiles.some(existing => existing.name === newFile.name)
    )

    if (newFiles.length < files.length) {
      setError(`Skipped ${files.length - newFiles.length} duplicate file(s)`)
    }

    // Add new files to existing selection
    setSelectedFiles(prev => [...prev, ...newFiles])
    return true
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    validateAndAddFiles(files)
    
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only set to false if we're leaving the drop zone entirely
    if (e.currentTarget === e.target) {
      setIsDragging(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    validateAndAddFiles(files)
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  const removeFile = (index: number) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index))
    setError(null)
  }

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return

    setUploading(true)
    setProgress(0)
    setError(null)

    try {
      const supabase = createClient()
      const uploadedFiles: UploadedFile[] = []

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        
        // Generate unique path
        const timestamp = Date.now()
        const sanitizedName = file.name.replace(/[^a-z0-9.-]/gi, '_')
        const path = `${userId}/${knowledgeBaseId}/${timestamp}-${sanitizedName}`

        // Upload to Supabase Storage
        const { data, error: uploadError } = await supabase.storage
          .from('kb-documents')
          .upload(path, file, {
            contentType: file.type || 'application/octet-stream',
            upsert: false,
          })

        if (uploadError) {
          throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`)
        }

        uploadedFiles.push({
          name: file.name,
          path: data.path,
          size: file.size,
          type: file.type || 'application/octet-stream',
        })

        // Update progress
        setProgress(((i + 1) / selectedFiles.length) * 100)
      }

      // Success!
      onUploadComplete(uploadedFiles)
      setSelectedFiles([])
      setProgress(0)
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      
    } catch (error) {
      console.error('Upload error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      setError(errorMessage)
      
      if (onUploadError) {
        onUploadError(error instanceof Error ? error : new Error('Upload failed'))
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 transition-all cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
          uploading && "opacity-50 cursor-not-allowed pointer-events-none"
        )}
      >
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          multiple
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
        />

        {/* Drop Zone Content */}
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <div className={cn(
            "p-4 rounded-full transition-all",
            isDragging ? "bg-primary/10 scale-110" : "bg-muted"
          )}>
            {isDragging ? (
              <CloudUpload className="h-8 w-8 text-primary animate-bounce" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground" />
            )}
          </div>

          <div className="space-y-2">
            <p className="text-lg font-semibold">
              {isDragging ? "Drop files here!" : "Drag & drop files here"}
            </p>
            <p className="text-sm text-muted-foreground">
              or click to browse your computer
            </p>
            <p className="text-xs text-muted-foreground">
              Max {maxFiles} files • {(maxFileSize / (1024 * 1024)).toFixed(0)}MB per file • PDF, TXT, MD
            </p>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              Selected Files ({selectedFiles.length})
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={triggerFileInput}
              disabled={uploading || selectedFiles.length >= maxFiles}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add More
            </Button>
          </div>

          <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-2">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-3 p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="p-2 rounded-md bg-primary/10">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                {!uploading && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile(index)
                    }}
                    className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Upload Button */}
          <Button
            onClick={uploadFiles}
            disabled={selectedFiles.length === 0 || uploading}
            className="w-full"
            size="lg"
          >
            <Upload className="h-5 w-5 mr-2" />
            Upload {selectedFiles.length} File{selectedFiles.length !== 1 ? 's' : ''}
          </Button>
        </div>
      )}

      {/* Progress Bar */}
      {uploading && (
        <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Uploading files...</span>
            <span className="text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="w-full h-2" />
          <p className="text-xs text-muted-foreground text-center">
            {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} • Please don't close this window
          </p>
        </div>
      )}
    </div>
  )
}

