// route.ts — Create Stripe Customer Portal session for subscription management
// Deps: stripe, @/lib/stripe/client, @/lib/db/server, @/lib/env | Used by: settings page

import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/db/server'
import { getStripe } from '@/lib/stripe/client'
import { getServerEnv } from '@/lib/env'

// === POST /api/stripe/portal ===

export async function POST(request: Request) {
  try {
    const supabase = await createServerComponentClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch the Stripe customer ID from the user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    if (!profile.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer found. Subscribe to a plan first.' },
        { status: 400 }
      )
    }

    const env = getServerEnv()
    const stripe = getStripe()

    // Parse optional return URL from request body
    let returnUrl = `${env.NEXT_PUBLIC_APP_URL}/settings`
    try {
      const body = (await request.json()) as { returnUrl?: string }
      if (body.returnUrl) {
        returnUrl = body.returnUrl
      }
    } catch {
      // Body is optional — empty body is fine, use default returnUrl
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: returnUrl,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (err) {
    console.error('[stripe/portal] Error creating portal session:', err)
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    )
  }
}
