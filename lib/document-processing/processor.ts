/**
 * Document Processor
 * 
 * Orchestrates document processing using the appropriate strategy
 */

import { ProcessingConfig, ProcessingResult, FileMetadata } from './types';
import { getStrategyByMimeType, detectStrategy } from './strategies';
import { mergeConfigLayers } from './config/config-merger';
import { getDefaultConfigByMimeType } from './config/default-configs';

export interface ProcessDocumentInput {
  fileBuffer: Buffer;
  mimeType: string;
  filename: string;
  processingConfig?: Partial<ProcessingConfig>;
  kbDefaultConfig?: Partial<ProcessingConfig>;
}

export interface ProcessDocumentOutput extends ProcessingResult {
  fileMetadata: FileMetadata;
}

/**
 * Process a document file
 * 
 * This is the main entry point for document processing.
 * It automatically selects the right strategy and applies configuration layers.
 */
export async function processDocument(
  input: ProcessDocumentInput
): Promise<ProcessDocumentOutput> {
  const { fileBuffer, mimeType, filename, processingConfig, kbDefaultConfig } = input;

  try {
    // Get the appropriate processing strategy
    const strategy = getStrategyByMimeType(mimeType);

    // Validate the file can be processed
    const isValid = await strategy.validate(fileBuffer, mimeType);
    if (!isValid) {
      throw new Error(
        `File validation failed. The file may be corrupted or not a valid ${mimeType} file.`
      );
    }

    // Merge configuration layers: default → KB → upload-specific
    const defaultConfig = getDefaultConfigByMimeType(mimeType);
    const finalConfig = mergeConfigLayers(
      defaultConfig,
      kbDefaultConfig,
      processingConfig
    );

    // Process the document
    const result = await strategy.process(fileBuffer, finalConfig);

    // Return result with file metadata
    return {
      ...result,
      fileMetadata: {
        originalFilename: filename,
        fileSize: fileBuffer.length,
        mimeType,
        uploadedAt: new Date(),
      },
    };
  } catch (error) {
    throw new Error(
      `Document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Process a document with auto-detection
 * 
 * Useful when MIME type is not reliable
 */
export async function processDocumentWithDetection(
  input: Omit<ProcessDocumentInput, 'mimeType'> & { mimeType?: string }
): Promise<ProcessDocumentOutput> {
  const { fileBuffer, mimeType, filename, processingConfig, kbDefaultConfig } = input;

  try {
    // Detect the appropriate strategy
    const strategy = await detectStrategy(fileBuffer, mimeType, filename);

    // Use the detected MIME type if not provided
    const detectedMimeType = mimeType || strategy.getSupportedMimeTypes()[0];

    // Get default config
    const defaultConfig = strategy.getDefaultConfig();
    const finalConfig = mergeConfigLayers(
      defaultConfig,
      kbDefaultConfig,
      processingConfig
    );

    // Process the document
    const result = await strategy.process(fileBuffer, finalConfig);

    return {
      ...result,
      fileMetadata: {
        originalFilename: filename,
        fileSize: fileBuffer.length,
        mimeType: detectedMimeType,
        uploadedAt: new Date(),
      },
    };
  } catch (error) {
    throw new Error(
      `Document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
