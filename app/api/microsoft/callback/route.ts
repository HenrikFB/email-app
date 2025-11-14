import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens, getAccountInfo } from '@/lib/microsoft-graph/client'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Handle OAuth errors
  if (error) {
    console.error('Microsoft OAuth error:', error, errorDescription)
    return NextResponse.redirect(
      new URL(`/dashboard?error=${encodeURIComponent(errorDescription || error)}`, request.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/dashboard?error=no_code', request.url)
    )
  }

  try {
    // Verify state parameter
    if (state) {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
      // Could add additional validation here (e.g., timestamp check)
    }

    const supabase = await createClient()

    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)

    // Get account information
    const accountInfo = await getAccountInfo(tokens.accessToken)

    // Calculate token expiry
    const expiresAt = tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000)
      : null

    // Get email address (prefer mail, fallback to userPrincipalName)
    const emailAddress = accountInfo.mail || accountInfo.userPrincipalName

    // Store connection in database
    // Note: We're using aurinko_access_token column name but storing Microsoft tokens
    // This is fine - the column name is just a label
    const { data: connection, error: dbError } = await supabase
      .from('email_connections')
      .upsert(
        {
          user_id: user.id,
          email_address: emailAddress,
          provider: 'Microsoft',
          account_id: accountInfo.id,
          aurinko_access_token: tokens.accessToken, // Column name kept for compatibility
          aurinko_refresh_token: tokens.refreshToken || null, // Column name kept for compatibility
          token_expires_at: expiresAt?.toISOString() || null,
          is_active: true,
        },
        {
          onConflict: 'user_id,email_address',
        }
      )
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.redirect(
        new URL('/dashboard?error=database_error', request.url)
      )
    }

    // Redirect to dashboard with success message
    return NextResponse.redirect(
      new URL('/dashboard?connected=true', request.url)
    )
  } catch (err) {
    console.error('Microsoft callback error:', err)
    return NextResponse.redirect(
      new URL(
        `/dashboard?error=${encodeURIComponent(
          err instanceof Error ? err.message : 'Unknown error'
        )}`,
        request.url
      )
    )
  }
}

