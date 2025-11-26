/**
 * Configuration Merger
 * 
 * Merges default, KB-level, and upload-specific configurations
 */

import { ProcessingConfig } from '../types';

/**
 * Deep merge two configuration objects
 * User config takes precedence over default config
 */
export function mergeConfigs(
  defaultConfig: ProcessingConfig,
  userConfig?: Partial<ProcessingConfig>
): ProcessingConfig {
  if (!userConfig) {
    return { ...defaultConfig };
  }

  return {
    ...defaultConfig,
    ...userConfig,
    pageRange: userConfig.pageRange 
      ? { ...defaultConfig.pageRange, ...userConfig.pageRange }
      : defaultConfig.pageRange,
    customSettings: {
      ...defaultConfig.customSettings,
      ...userConfig.customSettings,
    },
  };
}

/**
 * Merge multiple configuration layers (default → KB → upload-specific)
 */
export function mergeConfigLayers(
  defaultConfig: ProcessingConfig,
  kbConfig?: Partial<ProcessingConfig>,
  uploadConfig?: Partial<ProcessingConfig>
): ProcessingConfig {
  const withKbConfig = mergeConfigs(defaultConfig, kbConfig);
  return mergeConfigs(withKbConfig, uploadConfig);
}
