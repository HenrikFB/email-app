import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthorizationUrl } from '@/lib/microsoft-graph/client'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Generate state parameter to prevent CSRF
  const state = Buffer.from(
    JSON.stringify({
      userId: user.id,
      timestamp: Date.now(),
    })
  ).toString('base64')

  // Get authorization URL from Microsoft
  const authUrl = getAuthorizationUrl(state)

  return NextResponse.redirect(authUrl)
}

