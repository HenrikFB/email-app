/**
 * Uppy.io configuration for document uploads
 * Sets up TUS resumable uploads to Supabase Storage
 */

import Uppy, { type UppyOptions } from '@uppy/core'
import Tus from '@uppy/tus'
import type { ProcessingConfig } from '../types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export interface UppyConfigOptions {
  userId: string
  kbId: string
  processingConfig?: ProcessingConfig
  onSuccess?: (file: any, response: any) => void
  onError?: (file: any, error: Error) => void
}

/**
 * Create configured Uppy instance for document uploads
 */
export function createUppyInstance(options: UppyConfigOptions) {
  const { userId, kbId, processingConfig, onSuccess, onError } = options
  
  const uppyOptions: Partial<UppyOptions> = {
    id: 'kb-document-uploader',
    autoProceed: false,
    restrictions: {
      maxFileSize: 10 * 1024 * 1024, // 10 MB
      maxNumberOfFiles: 10,
      allowedFileTypes: ['.pdf', 'application/pdf'],
    },
    meta: {
      userId,
      kbId,
      processingConfig: JSON.stringify(processingConfig || {}),
    },
  }
  
  const uppy = new Uppy(uppyOptions)
  
  // Add TUS plugin for resumable uploads
  uppy.use(Tus, {
    endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
    headers: {
      authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    chunkSize: 6 * 1024 * 1024, // 6 MB chunks
    allowedMetaFields: [
      'bucketName',
      'objectName',
      'contentType',
      'cacheControl',
    ],
    uploadDataDuringCreation: true,
    removeFingerprintOnSuccess: true,
    retryDelays: [0, 1000, 3000, 5000],
  })
  
  // Set up event handlers
  uppy.on('file-added', (file) => {
    console.log('File added:', file.name)
    
    // Generate unique document ID for this file
    const documentId = crypto.randomUUID()
    
    // Set Supabase Storage metadata
    uppy.setFileMeta(file.id, {
      bucketName: 'kb-documents',
      objectName: `${userId}/${kbId}/${documentId}/${file.name}`,
      contentType: file.type || 'application/pdf',
      documentId, // Store for later use
    })
  })
  
  uppy.on('upload-success', (file, response) => {
    console.log('Upload successful:', file?.name)
    if (onSuccess && file) {
      onSuccess(file, response)
    }
  })
  
  uppy.on('upload-error', (file, error) => {
    console.error('Upload error:', file?.name, error)
    if (onError && file) {
      onError(file, error)
    }
  })
  
  uppy.on('complete', (result) => {
    console.log('All uploads complete')
    console.log('Successful:', result.successful.length)
    console.log('Failed:', result.failed.length)
  })
  
  return uppy
}

/**
 * Get file metadata after successful upload
 */
export function getUploadedFileMetadata(file: any) {
  return {
    filename: file.name,
    fileType: file.type || 'application/pdf',
    fileSize: file.size,
    filePath: file.meta.objectName,
    documentId: file.meta.documentId,
  }
}

