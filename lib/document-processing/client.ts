/**
 * Client-safe exports from document processing library
 * 
 * These exports don't include any Node.js-only dependencies
 */

// Types only - safe for client
export type {
  ProcessingConfig,
  ProcessingResult,
  ProcessingStatus,
  DocumentType,
  FileMetadata,
} from './types'

// Constants
export const STORAGE_BUCKET = 'kb-documents'

