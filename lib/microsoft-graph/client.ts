/**
 * Microsoft Graph API Client
 * Handles OAuth, token refresh, and email fetching from Microsoft Graph API
 */

export interface MicrosoftAccount {
  id: string
  mail: string
  userPrincipalName: string
  displayName: string
}

export interface MicrosoftTokens {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
}

export interface MicrosoftEmail {
  id: string
  subject: string
  from: {
    emailAddress: {
      name?: string
      address: string
    }
  }
  toRecipients?: Array<{
    emailAddress: {
      name?: string
      address: string
    }
  }>
  ccRecipients?: Array<{
    emailAddress: {
      name?: string
      address: string
    }
  }>
  receivedDateTime: string
  bodyPreview?: string
  body?: {
    content: string
    contentType: string // 'text' or 'html'
  }
  hasAttachments: boolean
  isRead: boolean
  internetMessageId?: string
  attachments?: Array<{
    id: string
    name: string
    size: number
    contentType: string
  }>
}

// Normalized email interface (matches what UI expects)
export interface Email {
  id: string
  from: {
    name?: string
    address: string
  }
  to?: Array<{
    name?: string
    address: string
  }>
  cc?: Array<{
    name?: string
    address: string
  }>
  subject: string
  date: string
  receivedDateTime: string
  snippet?: string
  body?: string
  bodyHtml?: string
  hasAttachments: boolean
  isRead: boolean
  isDraft: boolean
  internetMessageId?: string
  attachments?: Array<{
    id: string
    filename: string
    size: number
    contentType: string
  }>
}

export interface EmailFilter {
  from?: string
  to?: string
  subject?: string
  after?: string  // ISO date string
  before?: string // ISO date string
  hasAttachment?: boolean
  isRead?: boolean
}

export interface EmailFetchOptions extends EmailFilter {
  maxResults?: number
  skipToken?: string // Microsoft Graph uses $skipToken instead of pageToken
}

export interface EmailFetchResponse {
  records: Email[]
  nextPageToken?: string
  totalSize?: number
}

/**
 * Exchanges authorization code for access tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<MicrosoftTokens> {
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to exchange code for tokens: ${error}`)
  }

  const data = await response.json()
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  }
}

/**
 * Refreshes an expired access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<MicrosoftTokens> {
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to refresh token: ${error}`)
  }

  const data = await response.json()
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  }
}

/**
 * Gets account information from Microsoft Graph
 */
export async function getAccountInfo(accessToken: string): Promise<MicrosoftAccount> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get account info: ${error}`)
  }

  return await response.json()
}

/**
 * Simple HTML to text conversion (server-side safe)
 * Used when Microsoft Graph only returns HTML content
 */
function htmlToPlainText(html: string): string {
  if (!html) return ''
  
  let text = html
    // Remove script and style content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Replace common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    // Replace <br> and <p> tags with newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    // Remove HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode numeric entities (basic)
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([a-f\d]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  
  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim()
  
  return text
}

/**
 * Normalizes Microsoft Graph email to our Email interface
 */
function normalizeEmail(graphEmail: MicrosoftEmail): Email {
  // Determine body content
  let body: string | undefined
  let bodyHtml: string | undefined

  // Debug: log what we're receiving
  if (!graphEmail.body) {
    console.warn('Email body is missing from Microsoft Graph response:', {
      emailId: graphEmail.id,
      subject: graphEmail.subject,
      hasBodyPreview: !!graphEmail.bodyPreview,
    })
  } else {
    console.log('Processing email body:', {
      contentType: graphEmail.body.contentType,
      contentLength: graphEmail.body.content?.length || 0,
    })
  }

  if (graphEmail.body) {
    if (graphEmail.body.contentType === 'text') {
      body = graphEmail.body.content
      bodyHtml = undefined
    } else if (graphEmail.body.contentType === 'html') {
      bodyHtml = graphEmail.body.content
      // Extract plain text from HTML if we only have HTML
      body = htmlToPlainText(graphEmail.body.content)
    } else {
      // Fallback: if contentType is something else, try to use content as-is
      console.warn('Unknown body contentType:', graphEmail.body.contentType)
      bodyHtml = graphEmail.body.content
      body = htmlToPlainText(graphEmail.body.content)
    }
  }

  return {
    id: graphEmail.id,
    from: {
      name: graphEmail.from.emailAddress.name,
      address: graphEmail.from.emailAddress.address,
    },
    to: graphEmail.toRecipients?.map(r => ({
      name: r.emailAddress.name,
      address: r.emailAddress.address,
    })),
    cc: graphEmail.ccRecipients?.map(r => ({
      name: r.emailAddress.name,
      address: r.emailAddress.address,
    })),
    subject: graphEmail.subject,
    date: graphEmail.receivedDateTime,
    receivedDateTime: graphEmail.receivedDateTime,
    snippet: graphEmail.bodyPreview,
    body,
    bodyHtml,
    hasAttachments: graphEmail.hasAttachments,
    isRead: graphEmail.isRead,
    isDraft: false, // Microsoft Graph doesn't return this in list view
    internetMessageId: graphEmail.internetMessageId,
    attachments: graphEmail.attachments?.map(a => ({
      id: a.id,
      filename: a.name,
      size: a.size,
      contentType: a.contentType,
    })),
  }
}

/**
 * Builds Microsoft Graph filter query
 * Simplified to avoid "InefficientFilter" errors
 */
function buildFilterQuery(filters: EmailFilter): string {
  const parts: string[] = []

  // Only use simple, well-supported filters
  // Microsoft Graph has limitations on filter complexity
  
  if (filters.from) {
    // Simple from filter - well supported
    parts.push(`from/emailAddress/address eq '${filters.from.replace(/'/g, "''")}'`)
  }
  
  // Date filters - simple and well supported
  if (filters.after) {
    const isoDate = filters.after.includes('T') ? filters.after : `${filters.after}T00:00:00Z`
    parts.push(`receivedDateTime ge ${isoDate}`)
  }
  if (filters.before) {
    const isoDate = filters.before.includes('T') ? filters.before : `${filters.before}T23:59:59Z`
    parts.push(`receivedDateTime le ${isoDate}`)
  }
  
  // Simple boolean filters
  if (filters.hasAttachment !== undefined) {
    parts.push(`hasAttachments eq ${filters.hasAttachment}`)
  }
  if (filters.isRead !== undefined) {
    parts.push(`isRead eq ${filters.isRead}`)
  }

  // Note: We skip 'to' and 'subject' filters as they can cause InefficientFilter errors
  // These can be filtered client-side if needed

  return parts.length > 0 ? parts.join(' and ') : ''
}

/**
 * Fetches emails from Microsoft Graph with filters
 */
export async function fetchEmails(
  accessToken: string,
  options: EmailFetchOptions = {}
): Promise<EmailFetchResponse> {
  const params = new URLSearchParams()
  
  // Build filter query
  const filter = buildFilterQuery(options)
  
  // Microsoft Graph has issues combining $filter + $orderby on some filters
  // Only use $orderby when there's no filter - we'll sort client-side otherwise
  if (filter) {
    params.append('$filter', filter)
  } else {
    params.append('$orderby', 'receivedDateTime desc')
  }

  // Select specific fields
  params.append('$select', 'id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,hasAttachments,isRead,internetMessageId')

  // Add pagination
  const top = options.maxResults || 50
  params.append('$top', top.toString())

  if (options.skipToken) {
    params.append('$skiptoken', options.skipToken)
  }

  const url = `https://graph.microsoft.com/v1.0/me/messages?${params.toString()}`
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to fetch emails: ${error}`)
  }

  const data = await response.json()
  
  // Normalize emails to our interface
  const normalizedEmails = (data.value || []).map((email: MicrosoftEmail) => normalizeEmail(email))
  
  // Sort by date (newest first) if we used filters (since $orderby wasn't used)
  if (filter) {
    normalizedEmails.sort((a: Email, b: Email) => {
      const dateA = new Date(a.receivedDateTime).getTime()
      const dateB = new Date(b.receivedDateTime).getTime()
      return dateB - dateA // Descending (newest first)
    })
  }
  
  return {
    records: normalizedEmails,
    nextPageToken: data['@odata.nextLink'] ? extractSkipToken(data['@odata.nextLink']) : undefined,
    totalSize: data['@odata.count'],
  }
}

/**
 * Extracts skip token from Microsoft Graph nextLink
 */
function extractSkipToken(nextLink: string): string | undefined {
  try {
    const url = new URL(nextLink)
    return url.searchParams.get('$skiptoken') || undefined
  } catch {
    return undefined
  }
}

/**
 * Gets a specific email by ID with full body content
 */
export async function getEmailById(
  accessToken: string,
  emailId: string
): Promise<Email> {
  const result = await getEmailByIdWithRaw(accessToken, emailId)
  return result.email
}

/**
 * Gets a specific email by ID with full body content and raw Microsoft Graph response
 */
export async function getEmailByIdWithRaw(
  accessToken: string,
  emailId: string
): Promise<{ email: Email; rawResponse: MicrosoftEmail }> {
  // Explicitly request body field and use headers to get unfiltered content
  const url = `https://graph.microsoft.com/v1.0/me/messages/${emailId}?$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,body,hasAttachments,isRead,internetMessageId,attachments`
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Prefer': 'outlook.allow-unsafe-html', // Get unfiltered HTML content
    },
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Microsoft Graph API error:', error)
    throw new Error(`Failed to get email: ${error}`)
  }

  const graphEmail: MicrosoftEmail = await response.json()
  
  // Debug logging to see what we're getting - log the full response structure
  console.log('Microsoft Graph email response keys:', Object.keys(graphEmail))
  console.log('Microsoft Graph email body field:', {
    hasBody: !!graphEmail.body,
    bodyType: typeof graphEmail.body,
    bodyValue: graphEmail.body ? JSON.stringify(graphEmail.body).substring(0, 200) : 'null',
    bodyContentType: graphEmail.body?.contentType,
    bodyContentLength: graphEmail.body?.content?.length || 0,
  })
  
  // Log full response for debugging (truncated)
  const responseStr = JSON.stringify(graphEmail, null, 2)
  console.log('Full Microsoft Graph response (first 1000 chars):', responseStr.substring(0, 1000))
  
  return {
    email: normalizeEmail(graphEmail),
    rawResponse: graphEmail,
  }
}

/**
 * Downloads an email attachment
 */
export async function downloadAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<ArrayBuffer> {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments/${attachmentId}/$value`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to download attachment: ${error}`)
  }

  return await response.arrayBuffer()
}

/**
 * Gets the authorization URL for OAuth flow
 */
export function getAuthorizationUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
    scope: 'openid profile email User.Read Mail.Read offline_access',
    response_mode: 'query',
  })

  if (state) {
    params.append('state', state)
  }

  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`
}

