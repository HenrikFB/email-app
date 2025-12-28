/**
 * PDF Processing Strategy
 * 
 * Uses pdf-parse for high-quality text extraction and pdf2json for page structure.
 * This hybrid approach provides better text quality while maintaining page-level control.
 */

// @ts-ignore - pdf2json doesn't have TypeScript definitions
import PDFParser from 'pdf2json';
// @ts-ignore - pdf-parse doesn't have proper TypeScript definitions
import pdfParse from 'pdf-parse';
import { BaseDocumentStrategy } from './base-strategy';
import { ProcessingConfig, ProcessingResult } from '../types';
import { getDefaultConfig } from '../config/default-configs';

interface PDFParseResult {
  numpages: number;
  numrender: number;
  info: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  text: string;
  version: string;
}

export class PDFStrategy extends BaseDocumentStrategy {
  async process(fileBuffer: Buffer, config: ProcessingConfig): Promise<ProcessingResult> {
    try {
      // First, get page count and structure using pdf2json
      const pdfStructure = await this.getPdfStructure(fileBuffer);
      const totalPages = pdfStructure.pageCount;

      // Determine which pages to extract
      const { startPage, endPage, rangeDescription } = this.calculatePageRange(
        config,
        totalPages
      );

      // Extract text using the appropriate method based on page selection
      let content: string;
      
      if (startPage === 1 && endPage === totalPages) {
        // Full document - use pdf-parse directly (best quality)
        content = await this.extractFullDocument(fileBuffer);
      } else {
        // Partial document - need to extract specific pages
        content = await this.extractPageRange(fileBuffer, startPage, endPage, pdfStructure);
      }

      // Clean and normalize the text
      content = this.cleanText(content);

      return {
        content,
        pageCount: totalPages,
        metadata: {
          ...pdfStructure.metadata,
          extractedPages: `${startPage}-${endPage}`,
          totalPages,
          rangeDescription,
        },
      };
    } catch (error) {
      throw new Error(
        `PDF processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get PDF structure and page count using pdf2json
   */
  private async getPdfStructure(fileBuffer: Buffer): Promise<{
    pageCount: number;
    pages: any[];
    metadata: Record<string, unknown>;
  }> {
    const pdfParser = new PDFParser();

    const pdfData = await new Promise<any>((resolve, reject) => {
      pdfParser.on('pdfParser_dataError', (errData: any) => reject(errData.parserError));
      pdfParser.on('pdfParser_dataReady', (pdfData: any) => resolve(pdfData));
      pdfParser.parseBuffer(fileBuffer);
    });

    return {
      pageCount: pdfData.Pages?.length || 0,
      pages: pdfData.Pages || [],
      metadata: pdfData.Meta || {},
    };
  }

  /**
   * Extract full document text using pdf-parse (best quality)
   */
  private async extractFullDocument(fileBuffer: Buffer): Promise<string> {
    const result: PDFParseResult = await pdfParse(fileBuffer);
    return result.text;
  }

  /**
   * Extract specific page range
   * Uses pdf-parse with page rendering callback for page-level control
   */
  private async extractPageRange(
    fileBuffer: Buffer,
    startPage: number,
    endPage: number,
    pdfStructure: { pages: any[]; pageCount: number }
  ): Promise<string> {
    const pageTexts: string[] = [];

    // Use pdf-parse with custom page render function to track pages
    let currentPage = 0;

    const options = {
      // Custom page render function to extract only specific pages
      pagerender: (pageData: any) => {
        currentPage++;
        
        // Only process pages in our range
        if (currentPage >= startPage && currentPage <= endPage) {
          return pageData.getTextContent().then((textContent: any) => {
            // Extract text items and join them intelligently
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join('');
            pageTexts.push(pageText);
            return pageText;
          });
        }
        
        // Return empty for pages outside range
        return Promise.resolve('');
      },
      max: endPage, // Don't process pages beyond endPage
    };

    try {
      await pdfParse(fileBuffer, options);
      return pageTexts.join('\n\n');
    } catch {
      // Fallback to pdf2json extraction if pdf-parse page rendering fails
      console.warn('pdf-parse page rendering failed, falling back to pdf2json');
      return this.extractPageRangeWithPdf2Json(pdfStructure.pages, startPage, endPage);
    }
  }

  /**
   * Fallback extraction using pdf2json with improved text joining
   */
  private extractPageRangeWithPdf2Json(
    pages: any[],
    startPage: number,
    endPage: number
  ): string {
    const pageTexts: string[] = [];

    for (let pageIndex = startPage - 1; pageIndex < endPage; pageIndex++) {
      const page = pages[pageIndex];
      if (!page || !page.Texts) continue;

      // Sort texts by position for proper reading order
      const sortedTexts = [...page.Texts].sort((a: any, b: any) => {
        const yDiff = (a.y || 0) - (b.y || 0);
        // If on same line (within tolerance), sort by x
        if (Math.abs(yDiff) < 0.5) {
          return (a.x || 0) - (b.x || 0);
        }
        return yDiff;
      });

      // Extract text with position-aware spacing
      let lastY = -1;
      let lastX = -1;
      let lineText = '';
      const lines: string[] = [];

      for (const text of sortedTexts) {
        if (!text.R || text.R.length === 0) continue;

        const textContent = text.R
          .map((r: any) => decodeURIComponent(r.T || ''))
          .join('');

        const currentY = text.y || 0;
        const currentX = text.x || 0;

        // Check if we're on a new line
        if (lastY >= 0 && Math.abs(currentY - lastY) > 0.5) {
          if (lineText.trim()) {
            lines.push(this.fixSpacedLetters(lineText.trim()));
          }
          lineText = textContent;
        } else {
          // Same line - check horizontal gap
          if (lastX >= 0) {
            const gap = currentX - lastX;
            // Add space if there's a significant gap (adjust threshold as needed)
            if (gap > 1.5) {
              lineText += ' ' + textContent;
            } else {
              lineText += textContent;
            }
          } else {
            lineText += textContent;
          }
        }

        lastY = currentY;
        // Estimate text width (rough approximation)
        lastX = currentX + (textContent.length * 0.5);
      }

      // Don't forget the last line
      if (lineText.trim()) {
        lines.push(this.fixSpacedLetters(lineText.trim()));
      }

      pageTexts.push(lines.join('\n'));
    }

    return pageTexts.join('\n\n');
  }

  /**
   * Fix patterns where letters are separated by spaces
   * E.g., "J e g   e r" -> "Jeg er"
   */
  private fixSpacedLetters(text: string): string {
    // Pattern: single letters separated by single spaces, with multiple spaces between words
    // This matches patterns like "J e g   e r   v a n t"
    const spacedPattern = /(?:^|(?<=\s{2,}))([A-Za-zÀ-ÿ](?:\s[A-Za-zÀ-ÿ])+)(?=\s{2,}|$)/g;
    
    return text.replace(spacedPattern, (match) => {
      // Remove single spaces between letters
      return match.replace(/\s+/g, '');
    });
  }

  /**
   * Calculate the actual page range based on config
   */
  private calculatePageRange(
    config: ProcessingConfig,
    totalPages: number
  ): { startPage: number; endPage: number; rangeDescription: string } {
    let startPage = 1;
    let endPage = totalPages;
    let rangeDescription = 'all pages';

    if (config.pageRange) {
      const { start, end } = config.pageRange;

      if (start === 0) {
        // start: 0 with negative end means "all pages except last X"
        const skipCount = end && end < 0 ? Math.abs(end) : 1;
        startPage = 1;
        endPage = Math.max(1, totalPages - skipCount);
        rangeDescription = totalPages > skipCount
          ? `all pages except last ${skipCount} page${skipCount > 1 ? 's' : ''}`
          : 'all pages';
      } else if (start && start < 0) {
        // Negative start means "last X pages"
        const count = Math.abs(start);
        startPage = Math.max(1, totalPages - count + 1);
        endPage = totalPages;
        rangeDescription = `last ${count} page${count > 1 ? 's' : ''}`;
      } else {
        startPage = start || 1;
        endPage = end || totalPages;
        rangeDescription = `page${startPage === endPage ? '' : 's'} ${startPage}${startPage === endPage ? '' : `-${endPage}`}`;
      }

      // Validate range
      startPage = Math.max(1, Math.min(startPage, totalPages));
      endPage = Math.max(startPage, Math.min(endPage, totalPages));
    }

    return { startPage, endPage, rangeDescription };
  }

  async validate(fileBuffer: Buffer, mimeType?: string): Promise<boolean> {
    // Check MIME type if provided
    if (mimeType && !this.getSupportedMimeTypes().includes(mimeType)) {
      return false;
    }

    // Check PDF magic number (PDF files start with %PDF-)
    const header = fileBuffer.slice(0, 5).toString('utf-8');
    return header === '%PDF-';
  }

  getDefaultConfig(): ProcessingConfig {
    return getDefaultConfig('pdf');
  }

  getSupportedMimeTypes(): string[] {
    return ['application/pdf'];
  }
}
