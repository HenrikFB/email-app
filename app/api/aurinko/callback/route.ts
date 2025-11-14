import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens, getAccountInfo } from '@/lib/aurinko/client'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Handle OAuth errors
  if (error) {
    console.error('Aurinko OAuth error:', error)
    return NextResponse.redirect(
      new URL(`/dashboard?error=${encodeURIComponent(error)}`, request.url)
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

    // Store connection in database
    const { data: connection, error: dbError } = await supabase
      .from('email_connections')
      .upsert(
        {
          user_id: user.id,
          email_address: accountInfo.email,
          provider: accountInfo.serviceType,
          aurinko_account_id: accountInfo.accountId.toString(),
          aurinko_access_token: tokens.accessToken,
          aurinko_refresh_token: tokens.refreshToken || null,
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
    console.error('Aurinko callback error:', err)
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

