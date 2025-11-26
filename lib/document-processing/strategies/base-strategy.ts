/**
 * Base Document Processing Strategy
 * 
 * Abstract base class that concrete strategies can extend
 */

import { IDocumentProcessingStrategy, ProcessingConfig, ProcessingResult } from '../types';

export abstract class BaseDocumentStrategy implements IDocumentProcessingStrategy {
  abstract process(fileBuffer: Buffer, config: ProcessingConfig): Promise<ProcessingResult>;
  
  abstract validate(fileBuffer: Buffer, mimeType?: string): Promise<boolean>;
  
  abstract getDefaultConfig(): ProcessingConfig;
  
  abstract getSupportedMimeTypes(): string[];

  /**
   * Helper method to apply page range filtering to text
   * Useful for derived strategies
   */
  protected applyPageRange(pages: string[], config: ProcessingConfig): string[] {
    if (!config.pageRange) {
      return pages;
    }

    const { start, end } = config.pageRange;
    const startIndex = start ? Math.max(0, start - 1) : 0;
    const endIndex = end ? Math.min(pages.length, end) : pages.length;

    return pages.slice(startIndex, endIndex);
  }

  /**
   * Helper to clean and normalize extracted text
   */
  protected cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
      .trim();
  }
}
