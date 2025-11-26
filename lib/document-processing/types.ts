/**
 * Document Processing Types & Interfaces
 * 
 * Defines the core types for extensible document processing using the Strategy pattern.
 */

export type ProcessingStatus = 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'ready_for_review';

/**
 * Configuration for document processing
 * Can be extended per document type
 */
export interface ProcessingConfig {
  /** Page range for PDFs */
  pageRange?: {
    start?: number;
    end?: number;
  };
  /** Extract images from document (future) */
  extractImages?: boolean;
  /** Enable OCR for scanned documents (future) */
  ocrEnabled?: boolean;
  /** Custom extraction settings for extensibility */
  customSettings?: Record<string, unknown>;
}

/**
 * Result of document processing
 */
export interface ProcessingResult {
  /** Extracted text content */
  content: string;
  /** Number of pages (if applicable) */
  pageCount?: number;
  /** Metadata extracted from document */
  metadata?: Record<string, unknown>;
  /** Any warnings during processing */
  warnings?: string[];
}

/**
 * Strategy interface for document processing
 * Implement this for each document type (PDF, DOCX, etc.)
 */
export interface IDocumentProcessingStrategy {
  /**
   * Process a document file
   * @param fileBuffer The file content as Buffer
   * @param config Processing configuration
   * @returns Processed content and metadata
   */
  process(fileBuffer: Buffer, config: ProcessingConfig): Promise<ProcessingResult>;

  /**
   * Validate if the file can be processed by this strategy
   * @param fileBuffer The file content
   * @param mimeType Optional MIME type hint
   */
  validate(fileBuffer: Buffer, mimeType?: string): Promise<boolean>;

  /**
   * Get default configuration for this document type
   */
  getDefaultConfig(): ProcessingConfig;

  /**
   * Get supported MIME types
   */
  getSupportedMimeTypes(): string[];
}

/**
 * Supported document types for processing
 */
export type DocumentType = 'pdf' | 'text' | 'docx' | 'markdown';

/**
 * File metadata for storage
 */
export interface FileMetadata {
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
}
