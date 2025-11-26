/**
 * Default Processing Configurations
 * 
 * Defines default settings for each document type
 */

import { ProcessingConfig, DocumentType } from '../types';

export const DEFAULT_CONFIGS: Record<DocumentType, ProcessingConfig> = {
  pdf: {
    pageRange: undefined, // Process all pages by default
    extractImages: false,
    ocrEnabled: false,
    customSettings: {},
  },
  text: {
    customSettings: {},
  },
  docx: {
    extractImages: false,
    customSettings: {},
  },
  markdown: {
    customSettings: {},
  },
};

/**
 * Get default config for a document type
 */
export function getDefaultConfig(type: DocumentType): ProcessingConfig {
  return { ...DEFAULT_CONFIGS[type] };
}

/**
 * Get default config based on MIME type
 */
export function getDefaultConfigByMimeType(mimeType: string): ProcessingConfig {
  if (mimeType === 'application/pdf') {
    return getDefaultConfig('pdf');
  }
  if (mimeType.startsWith('text/')) {
    return getDefaultConfig('text');
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return getDefaultConfig('docx');
  }
  if (mimeType === 'text/markdown') {
    return getDefaultConfig('markdown');
  }
  
  // Default fallback
  return getDefaultConfig('text');
}
