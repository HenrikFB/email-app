/**
 * Aurinko API Client
 * Handles OAuth, token refresh, and email fetching from Aurinko unified email API
 */

export interface AurinkoAccount {
  id: number
  accountId: number
  serviceType: string
  email: string
  name: string
}

export interface AurinkoTokens {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
}

export interface AurinkoEmail {
  id: string
  accountId: number
  folderId: number
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
  after?: string  // Date in format YYYY/MM/DD
  before?: string // Date in format YYYY/MM/DD
  hasAttachment?: boolean
  isRead?: boolean
}

export interface EmailFetchOptions extends EmailFilter {
  maxResults?: number
  pageToken?: string
}

export interface EmailFetchResponse {
  records: AurinkoEmail[]
  nextPageToken?: string
  totalSize?: number
}

/**
 * Exchanges authorization code for access tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<AurinkoTokens> {
  const response = await fetch('https://api.aurinko.io/v1/auth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.AURINKO_CLIENT_ID!,
      client_secret: process.env.AURINKO_CLIENT_SECRET!,
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
export async function refreshAccessToken(refreshToken: string): Promise<AurinkoTokens> {
  const response = await fetch('https://api.aurinko.io/v1/auth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.AURINKO_CLIENT_ID!,
      client_secret: process.env.AURINKO_CLIENT_SECRET!,
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
 * Gets account information from Aurinko
 */
export async function getAccountInfo(accessToken: string): Promise<AurinkoAccount> {
  const response = await fetch('https://api.aurinko.io/v1/account', {
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
 * Builds query string for email search
 */
function buildEmailQuery(filters: EmailFilter): string {
  const parts: string[] = []

  if (filters.from) {
    parts.push(`from:${filters.from}`)
  }
  if (filters.to) {
    parts.push(`to:${filters.to}`)
  }
  if (filters.subject) {
    parts.push(`subject:${filters.subject}`)
  }
  if (filters.after) {
    parts.push(`after:${filters.after}`)
  }
  if (filters.before) {
    parts.push(`before:${filters.before}`)
  }
  if (filters.hasAttachment !== undefined) {
    parts.push('has:attachment')
  }
  if (filters.isRead !== undefined) {
    parts.push(filters.isRead ? 'is:read' : '-is:read')
  }

  return parts.join(' ')
}

/**
 * Fetches emails from Aurinko with filters
 */
export async function fetchEmails(
  accessToken: string,
  options: EmailFetchOptions = {}
): Promise<EmailFetchResponse> {
  const params = new URLSearchParams()
  
  // Build query string from filters
  const query = buildEmailQuery(options)
  if (query) {
    params.append('q', query)
  }

  // Add pagination
  if (options.maxResults) {
    params.append('maxResults', options.maxResults.toString())
  } else {
    params.append('maxResults', '50') // Default to 50
  }

  if (options.pageToken) {
    params.append('pageToken', options.pageToken)
  }

  // Don't include deleted or spam
  params.append('includeDeleted', 'false')
  params.append('includeSpam', 'false')

  const url = `https://api.aurinko.io/v1/email/messages?${params.toString()}`
  
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
  
  return {
    records: data.records || [],
    nextPageToken: data.nextPageToken,
    totalSize: data.totalSize,
  }
}

/**
 * Gets a specific email by ID with full body content
 */
export async function getEmailById(
  accessToken: string,
  emailId: string
): Promise<AurinkoEmail> {
  const response = await fetch(
    `https://api.aurinko.io/v1/email/messages/${emailId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get email: ${error}`)
  }

  return await response.json()
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
    `https://api.aurinko.io/v1/email/messages/${messageId}/attachments/${attachmentId}`,
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
    clientId: process.env.AURINKO_CLIENT_ID!,
    serviceType: 'Google', // Can be 'Google', 'Microsoft', 'EWS', 'IMAP', etc.
    scopes: 'Mail.Read Mail.ReadWrite Mail.Send',
    responseType: 'code',
    returnUrl: process.env.AURINKO_REDIRECT_URI!,
  })

  if (state) {
    params.append('state', state)
  }

  return `https://api.aurinko.io/v1/auth/authorize?${params.toString()}`
}

