// route.ts — Email unsubscribe endpoint
// Deps: crypto, @/lib/env, @/lib/db/server | Used by: unsubscribe links in digest emails
// Why: one-click unsubscribe via signed URL — verifies HMAC token, sets digest_frequency to 'none'

import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/db/server'
import { getServerEnv } from '@/lib/env'

// === HELPERS ===

/** Verify the HMAC token for a given userId */
function verifyToken(userId: string, token: string): boolean {
  const secret = getServerEnv().RESEND_API_KEY ?? 'paperradar-secret'
  const expected = createHmac('sha256', secret)
    .update(userId)
    .digest('hex')

  // Use timing-safe comparison to prevent timing attacks
  try {
    const tokenBuffer = Buffer.from(token, 'hex')
    const expectedBuffer = Buffer.from(expected, 'hex')
    if (tokenBuffer.length !== expectedBuffer.length) return false
    return timingSafeEqual(tokenBuffer, expectedBuffer)
  } catch {
    return false
  }
}

/** Build a simple HTML response page */
function htmlPage(title: string, body: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — PaperRadar</title>
  <style>
    body {
      background: #030712;
      color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 16px;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 12px;
      padding: 32px;
      max-width: 440px;
      text-align: center;
    }
    h1 { color: #6366f1; font-size: 24px; margin: 0 0 16px 0; }
    p { color: #9ca3af; line-height: 1.6; margin: 0 0 24px 0; }
    a {
      display: inline-block;
      background: #6366f1;
      color: #fff;
      text-decoration: none;
      padding: 10px 24px;
      border-radius: 8px;
      font-weight: 600;
    }
    a:hover { background: #4f46e5; }
  </style>
</head>
<body>
  <div class="card">
    ${body}
    <a href="${baseUrl}/settings">Go to Settings</a>
  </div>
</body>
</html>`
}

// === ROUTE HANDLER ===

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const token = searchParams.get('token')

  // Validate params
  if (!userId || !token) {
    return new NextResponse(
      htmlPage('Invalid Link', '<h1>Invalid Link</h1><p>This unsubscribe link is missing required parameters.</p>'),
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  // Verify HMAC token
  if (!verifyToken(userId, token)) {
    return new NextResponse(
      htmlPage('Invalid Token', '<h1>Invalid Token</h1><p>This unsubscribe link is invalid or has expired.</p>'),
      { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  // Update profile: set digest_frequency to 'none'
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('profiles')
    .update({ digest_frequency: 'none' })
    .eq('id', userId)

  if (error) {
    console.error('[unsubscribe] Failed to update profile:', error)
    return new NextResponse(
      htmlPage('Error', '<h1>Something went wrong</h1><p>We could not process your request. Please try again or update your settings manually.</p>'),
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  return new NextResponse(
    htmlPage("You've Been Unsubscribed", "<h1>You've Been Unsubscribed</h1><p>You will no longer receive digest emails from PaperRadar. You can re-enable them anytime from your settings.</p>"),
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}
