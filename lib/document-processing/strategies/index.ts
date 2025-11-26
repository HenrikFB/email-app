/**
 * Document Processing Strategy Factory
 * 
 * Returns the appropriate processing strategy based on file type
 */

import { IDocumentProcessingStrategy } from '../types';
import { PDFStrategy } from './pdf-strategy';
import { TextStrategy } from './text-strategy';

// Singleton instances for reuse
const pdfStrategy = new PDFStrategy();
const textStrategy = new TextStrategy();

/**
 * Get processing strategy by MIME type
 */
export function getStrategyByMimeType(mimeType: string): IDocumentProcessingStrategy {
  // PDF files
  if (mimeType === 'application/pdf') {
    return pdfStrategy;
  }

  // Text-based files
  if (mimeType.startsWith('text/') || mimeType === 'application/json') {
    return textStrategy;
  }

  // DOCX (future)
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    throw new Error('DOCX processing not yet implemented. Coming soon!');
  }

  // Default to text strategy for unknown types
  return textStrategy;
}

/**
 * Get processing strategy by file extension
 */
export function getStrategyByExtension(filename: string): IDocumentProcessingStrategy {
  const extension = filename.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'pdf':
      return pdfStrategy;
    case 'txt':
    case 'md':
    case 'markdown':
    case 'csv':
    case 'json':
    case 'html':
    case 'htm':
      return textStrategy;
    case 'docx':
      throw new Error('DOCX processing not yet implemented. Coming soon!');
    default:
      // Default to text for unknown extensions
      return textStrategy;
  }
}

/**
 * Detect and return appropriate strategy by analyzing the file
 */
export async function detectStrategy(
  fileBuffer: Buffer, 
  mimeType?: string, 
  filename?: string
): Promise<IDocumentProcessingStrategy> {
  // Try all strategies and see which one validates the file
  const strategies = [pdfStrategy, textStrategy];

  for (const strategy of strategies) {
    if (await strategy.validate(fileBuffer, mimeType)) {
      return strategy;
    }
  }

  // Fallback to text if nothing else matches
  return textStrategy;
}

// Export strategies for direct use if needed
export { PDFStrategy, TextStrategy };
export { BaseDocumentStrategy } from './base-strategy';
