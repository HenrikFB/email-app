/**
 * Provider-agnostic email types
 * These interfaces abstract away the differences between Microsoft Graph and Aurinko APIs
 */

import type { Email, EmailFetchOptions, EmailFetchResponse } from '@/lib/microsoft-graph/client'

/**
 * Re-export the normalized Email interface from Microsoft Graph
 * (Both providers normalize to the same interface)
 */
export type { Email, EmailFetchOptions, EmailFetchResponse }

/**
 * Email provider interface
 * All email providers must implement this interface
 */
export interface EmailProvider {
  /**
   * Get a single email by ID with full body content
   */
  getEmailById(accessToken: string, emailId: string): Promise<Email>

  /**
   * Fetch a list of emails with optional filters
   */
  fetchEmails(accessToken: string, options?: EmailFetchOptions): Promise<EmailFetchResponse>
}

/**
 * Provider type identifier
 */
export type ProviderType = 'Microsoft' | 'Google' | 'Aurinko'

