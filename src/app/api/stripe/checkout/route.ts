// route.ts — Create Stripe Checkout session for subscription purchase
// Deps: stripe, @/lib/stripe/*, @/lib/db/server, @/lib/env | Used by: pricing page, upgrade buttons

import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/db/server'
import { getStripe } from '@/lib/stripe/client'
import { getServerEnv } from '@/lib/env'

// === TYPES ===

interface CheckoutRequestBody {
  priceId: string
  successUrl?: string
  cancelUrl?: string
}

// === POST /api/stripe/checkout ===

export async function POST(request: Request) {
  try {
    const supabase = await createServerComponentClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as CheckoutRequestBody

    if (!body.priceId) {
      return NextResponse.json(
        { error: 'priceId is required' },
        { status: 400 }
      )
    }

    const env = getServerEnv()
    const appUrl = env.NEXT_PUBLIC_APP_URL
    const stripe = getStripe()

    // === GET OR CREATE STRIPE CUSTOMER ===

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id, stripe_subscription_id, tier')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // If user already has an active subscription, redirect to portal instead
    if (profile.stripe_subscription_id && profile.tier !== 'free') {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id!,
        return_url: body.cancelUrl ?? `${appUrl}/settings`,
      })
      return NextResponse.json({ url: portalSession.url })
    }

    let customerId = profile.stripe_customer_id

    if (!customerId) {
      // Create a new Stripe customer linked to this user
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      })
      customerId = customer.id

      // Persist the customer ID in the profile
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // === CREATE CHECKOUT SESSION ===

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: body.priceId, quantity: 1 }],
      success_url: body.successUrl ?? `${appUrl}/settings?checkout=success`,
      cancel_url: body.cancelUrl ?? `${appUrl}/pricing?checkout=cancelled`,
      metadata: {
        userId: user.id,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
        },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe/checkout] Error creating checkout session:', err)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
