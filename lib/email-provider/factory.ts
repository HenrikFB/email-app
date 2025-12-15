/**
 * Email Provider Factory
 * Creates the appropriate email provider based on connection type
 */

import { getEmailById as getMicrosoftEmailById, fetchEmails as fetchMicrosoftEmails } from '@/lib/microsoft-graph/client'
import { getEmailById as getAurinkoEmailById, fetchEmails as fetchAurinkoEmails, type EmailFetchOptions as AurinkoEmailFetchOptions } from '@/lib/aurinko/client'
import type { Email, EmailFetchOptions, EmailFetchResponse, EmailProvider, ProviderType } from './types'

/**
 * Microsoft Graph provider implementation
 */
class MicrosoftGraphProvider implements EmailProvider {
  async getEmailById(accessToken: string, emailId: string): Promise<Email> {
    return await getMicrosoftEmailById(accessToken, emailId)
  }

  async fetchEmails(accessToken: string, options?: EmailFetchOptions): Promise<EmailFetchResponse> {
    return await fetchMicrosoftEmails(accessToken, options)
  }
}

/**
 * Aurinko provider implementation
 * Note: Aurinko returns AurinkoEmail which needs normalization
 */
class AurinkoProvider implements EmailProvider {
  async getEmailById(accessToken: string, emailId: string): Promise<Email> {
    const aurinkoEmail = await getAurinkoEmailById(accessToken, emailId)
    // Normalize AurinkoEmail to Email interface
    return {
      id: aurinkoEmail.id,
      from: aurinkoEmail.from,
      to: aurinkoEmail.to,
      cc: aurinkoEmail.cc,
      subject: aurinkoEmail.subject,
      date: aurinkoEmail.date,
      receivedDateTime: aurinkoEmail.receivedDateTime,
      snippet: aurinkoEmail.snippet,
      body: aurinkoEmail.body,
      bodyHtml: aurinkoEmail.bodyHtml,
      hasAttachments: aurinkoEmail.hasAttachments,
      isRead: aurinkoEmail.isRead,
      isDraft: aurinkoEmail.isDraft,
      internetMessageId: aurinkoEmail.internetMessageId,
      attachments: aurinkoEmail.attachments,
    }
  }

  async fetchEmails(accessToken: string, options?: EmailFetchOptions): Promise<EmailFetchResponse> {
    // Aurinko uses different pagination (pageToken vs skipToken)
    // We need to convert EmailFetchOptions to Aurinko's format
    const aurinkoOptions: AurinkoEmailFetchOptions | undefined = options ? {
      from: options.from,
      to: options.to,
      subject: options.subject,
      after: options.after,
      before: options.before,
      hasAttachment: options.hasAttachment,
      isRead: options.isRead,
      maxResults: options.maxResults,
      pageToken: options.skipToken, // Map skipToken to pageToken for Aurinko
    } : undefined
    
    const response = await fetchAurinkoEmails(accessToken, aurinkoOptions)
    
    // Normalize AurinkoEmail[] to Email[]
    const normalizedEmails: Email[] = response.records.map(email => ({
      id: email.id,
      from: email.from,
      to: email.to,
      cc: email.cc,
      subject: email.subject,
      date: email.date,
      receivedDateTime: email.receivedDateTime,
      snippet: email.snippet,
      body: email.body,
      bodyHtml: email.bodyHtml,
      hasAttachments: email.hasAttachments,
      isRead: email.isRead,
      isDraft: email.isDraft,
      internetMessageId: email.internetMessageId,
      attachments: email.attachments,
    }))
    
    return {
      records: normalizedEmails,
      nextPageToken: response.nextPageToken,
      totalSize: response.totalSize,
    }
  }
}

/**
 * Get the appropriate email provider based on provider type
 */
export function getEmailProvider(provider: ProviderType | string): EmailProvider {
  const normalizedProvider = provider.toLowerCase()
  
  // Currently, Microsoft Graph is used for Microsoft provider
  // In the future, this could be switched to Aurinko for Microsoft too
  if (normalizedProvider === 'microsoft') {
    return new MicrosoftGraphProvider()
  }
  
  // Aurinko is used for Google and other providers
  // For now, default to Aurinko for anything that's not Microsoft
  return new AurinkoProvider()
}

