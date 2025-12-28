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
    let cleaned = text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n'); // Remove excessive newlines

    // Fix spaced letter patterns (e.g., "J e g   e r" -> "Jeg er")
    cleaned = this.fixSpacedLetterPatterns(cleaned);

    return cleaned.trim();
  }

  /**
   * Fix patterns where individual letters are separated by spaces
   * This is common in PDFs with character-by-character positioning
   */
  protected fixSpacedLetterPatterns(text: string): string {
    // Split into lines to process each line individually
    const lines = text.split('\n');
    
    return lines.map(line => {
      // Skip empty lines or lines that don't look like spaced letters
      if (!line.trim()) return line;
      
      // Check if line contains spaced letter pattern
      // Pattern: multiple occurrences of single letter followed by space
      const spacedLetterPattern = /([A-Za-zÀ-ÿ])\s(?=[A-Za-zÀ-ÿ]\s|[A-Za-zÀ-ÿ]$)/g;
      const matches = line.match(spacedLetterPattern);
      
      // If more than 30% of the line looks like spaced letters, fix it
      if (matches && matches.length > line.length * 0.15) {
        // This line likely has spaced letter issues
        // Pattern: groups of single-spaced letters separated by multiple spaces
        return line.replace(
          /([A-Za-zÀ-ÿ](?:\s[A-Za-zÀ-ÿ])+)/g,
          (match) => {
            // Check if this really looks like spaced letters (not acronyms like "A B C D E")
            const letters = match.split(/\s+/);
            // If average "word" length is 1, collapse the spaces
            if (letters.every(l => l.length === 1)) {
              return letters.join('');
            }
            return match;
          }
        );
      }
      
      return line;
    }).join('\n');
  }
}
