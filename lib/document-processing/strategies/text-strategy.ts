/**
 * Text Processing Strategy
 * 
 * Handles plain text files (.txt, .md, etc.)
 */

import { BaseDocumentStrategy } from './base-strategy';
import { ProcessingConfig, ProcessingResult } from '../types';
import { getDefaultConfig } from '../config/default-configs';

export class TextStrategy extends BaseDocumentStrategy {
  async process(fileBuffer: Buffer, config: ProcessingConfig): Promise<ProcessingResult> {
    try {
      // Convert buffer to string
      const content = fileBuffer.toString('utf-8');
      const cleanedContent = this.cleanText(content);

      return {
        content: cleanedContent,
        metadata: {
          encoding: 'utf-8',
          size: fileBuffer.length,
        },
      };
    } catch (error) {
      throw new Error(
        `Text processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async validate(fileBuffer: Buffer, mimeType?: string): Promise<boolean> {
    // Check MIME type if provided
    if (mimeType && !this.getSupportedMimeTypes().includes(mimeType)) {
      return false;
    }

    // Try to decode as UTF-8 and check if it's valid text
    try {
      const text = fileBuffer.toString('utf-8');
      // Check if the text contains mostly printable characters
      const printableRatio = this.getPrintableRatio(text);
      return printableRatio > 0.8; // 80% of characters should be printable
    } catch {
      return false;
    }
  }

  getDefaultConfig(): ProcessingConfig {
    return getDefaultConfig('text');
  }

  getSupportedMimeTypes(): string[] {
    return [
      'text/plain',
      'text/markdown',
      'text/csv',
      'text/html',
      'application/json',
    ];
  }

  /**
   * Calculate the ratio of printable characters in text
   */
  private getPrintableRatio(text: string): number {
    if (text.length === 0) return 0;

    let printableCount = 0;
    for (const char of text) {
      const code = char.charCodeAt(0);
      // Printable ASCII range + common Unicode ranges + whitespace
      if (
        (code >= 32 && code <= 126) || // ASCII printable
        (code >= 128 && code <= 65535) || // Extended Unicode
        char === '\n' || char === '\r' || char === '\t' // Whitespace
      ) {
        printableCount++;
      }
    }

    return printableCount / text.length;
  }
}
