/**
 * PDF Processing Strategy
 * 
 * Extracts text from PDF files using pdf2json for page-level extraction
 */

// @ts-ignore - pdf2json doesn't have TypeScript definitions
import PDFParser from 'pdf2json';
import { BaseDocumentStrategy } from './base-strategy';
import { ProcessingConfig, ProcessingResult } from '../types';
import { getDefaultConfig } from '../config/default-configs';

export class PDFStrategy extends BaseDocumentStrategy {
  async process(fileBuffer: Buffer, config: ProcessingConfig): Promise<ProcessingResult> {
    try {
      // Parse PDF with pdf2json
      const pdfParser = new PDFParser();
      
      const pdfData = await new Promise<any>((resolve, reject) => {
        pdfParser.on('pdfParser_dataError', (errData: any) => reject(errData.parserError));
        pdfParser.on('pdfParser_dataReady', (pdfData: any) => resolve(pdfData));
        pdfParser.parseBuffer(fileBuffer);
      });

      const totalPages = pdfData.Pages?.length || 0;

      // Determine which pages to extract
      let startPage = 1;
      let endPage = totalPages;
      let rangeDescription = 'all pages';

      if (config.pageRange) {
        const { start, end } = config.pageRange;

        if (start && start < 0) {
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

      // Extract text from specified pages
      const pageTexts: string[] = [];
      
      for (let pageIndex = startPage - 1; pageIndex < endPage; pageIndex++) {
        const page = pdfData.Pages[pageIndex];
        if (!page || !page.Texts) continue;

        // Extract text from all text elements on the page
        const pageText = page.Texts
          .map((text: any) => {
            if (text.R && text.R.length > 0) {
              return text.R.map((r: any) => decodeURIComponent(r.T || '')).join(' ');
            }
            return '';
          })
          .join(' ');
        
        pageTexts.push(pageText);
      }

      const content = this.cleanText(pageTexts.join('\n\n'));

      // Get metadata
      const metadata = pdfData.Meta || {};

      return {
        content,
        pageCount: totalPages,
        metadata: {
          ...metadata,
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
