/**
 * Document Processing Library
 * 
 * Main export file for the document processing system
 */

// Core processor
export { processDocument, processDocumentWithDetection } from './processor';
export type { ProcessDocumentInput, ProcessDocumentOutput } from './processor';

// Types
export type {
  ProcessingConfig,
  ProcessingResult,
  ProcessingStatus,
  IDocumentProcessingStrategy,
  DocumentType,
  FileMetadata,
} from './types';

// Strategies
export {
  getStrategyByMimeType,
  getStrategyByExtension,
  detectStrategy,
  PDFStrategy,
  TextStrategy,
  BaseDocumentStrategy,
} from './strategies';

// Configuration
export {
  getDefaultConfig,
  getDefaultConfigByMimeType,
} from './config/default-configs';
export { mergeConfigs, mergeConfigLayers } from './config/config-merger';

// Storage
export {
  uploadFile,
  downloadFile,
  deleteFile,
  getPublicUrl,
  createSignedUrl,
  generateStoragePath,
  STORAGE_BUCKET,
} from './storage/supabase-storage';
