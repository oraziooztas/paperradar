// route.ts — Stripe webhook handler for subscription lifecycle events
// Deps: stripe, @/lib/stripe/*, @/lib/db/server, @/lib/env | Used by: Stripe (external)
// Why: keeps profiles.tier in sync with Stripe subscription status

import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/client'
import { getServerEnv } from '@/lib/env'
import { createServiceClient } from '@/lib/db/server'
import { tierFromPriceId } from '@/lib/stripe/config'
import type { UserTier } from '@/types/database'

// Force dynamic — no caching, no static generation
export const dynamic = 'force-dynamic'

// === HELPERS ===

/**
 * Update the user's profile tier and subscription info.
 * Uses the service client to bypass RLS (webhooks have no user session).
 */
async function updateProfileByCustomerId(
  stripeCustomerId: string,
  updates: {
    tier?: UserTier
    stripe_subscription_id?: string | null
  }
): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('stripe_customer_id', stripeCustomerId)

  if (error) {
    console.error(
      `[stripe/webhook] Failed to update profile for customer ${stripeCustomerId}:`,
      error.message
    )
  }
}

/**
 * Update the user's profile by userId from subscription metadata.
 * Preferred when metadata is available (checkout.session.completed).
 */
async function updateProfileByUserId(
  userId: string,
  updates: {
    tier?: UserTier
    stripe_customer_id?: string | null
    stripe_subscription_id?: string | null
  }
): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)

  if (error) {
    console.error(
      `[stripe/webhook] Failed to update profile for user ${userId}:`,
      error.message
    )
  }
}

/**
 * Extracts the tier from a subscription's first line item price ID.
 */
function tierFromSubscription(subscription: Stripe.Subscription): UserTier {
  const priceId = subscription.items.data[0]?.price?.id
  if (!priceId) return 'free'
  return tierFromPriceId(priceId)
}

// === EVENT HANDLERS ===

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  // Only handle subscription checkouts
  if (session.mode !== 'subscription') return

  const userId = session.metadata?.userId
  if (!userId) {
    console.error(
      '[stripe/webhook] checkout.session.completed missing userId in metadata'
    )
    return
  }

  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id

  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id

  if (!subscriptionId) {
    console.error(
      '[stripe/webhook] checkout.session.completed missing subscription ID'
    )
    return
  }

  // Fetch the full subscription to get the price ID for tier mapping
  const stripe = getStripe()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const tier = tierFromSubscription(subscription)

  await updateProfileByUserId(userId, {
    tier,
    stripe_customer_id: customerId ?? null,
    stripe_subscription_id: subscriptionId,
  })

  console.log(
    `[stripe/webhook] checkout.session.completed: user=${userId} tier=${tier}`
  )
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id

  if (!customerId) {
    console.error(
      '[stripe/webhook] subscription.updated missing customer ID'
    )
    return
  }

  const status = subscription.status

  if (status === 'active' || status === 'trialing') {
    // Active subscription — set the correct tier
    const tier = tierFromSubscription(subscription)
    await updateProfileByCustomerId(customerId, {
      tier,
      stripe_subscription_id: subscription.id,
    })
    console.log(
      `[stripe/webhook] subscription.updated: customer=${customerId} status=${status} tier=${tier}`
    )
  } else if (status === 'past_due') {
    // Past due — keep current tier but log the issue
    // In the future, we could add a "past_due" flag to the profile
    console.warn(
      `[stripe/webhook] subscription.updated: customer=${customerId} status=past_due — keeping current tier`
    )
  } else if (status === 'canceled' || status === 'unpaid') {
    // Canceled or unpaid — downgrade to free
    await updateProfileByCustomerId(customerId, {
      tier: 'free',
      stripe_subscription_id: null,
    })
    console.log(
      `[stripe/webhook] subscription.updated: customer=${customerId} status=${status} — downgraded to free`
    )
  }
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id

  if (!customerId) {
    console.error(
      '[stripe/webhook] subscription.deleted missing customer ID'
    )
    return
  }

  await updateProfileByCustomerId(customerId, {
    tier: 'free',
    stripe_subscription_id: null,
  })

  console.log(
    `[stripe/webhook] subscription.deleted: customer=${customerId} — downgraded to free`
  )
}

// === POST /api/stripe/webhook ===

export async function POST(request: Request) {
  let event: Stripe.Event

  try {
    // Read raw body for signature verification — do NOT use request.json()
    const rawBody = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      )
    }

    const env = getServerEnv()

    if (!env.STRIPE_WEBHOOK_SECRET) {
      console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET is not configured')
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      )
    }

    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[stripe/webhook] Signature verification failed: ${message}`)
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    )
  }

  // === DISPATCH EVENT ===

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        )
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription
        )
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        )
        break

      case 'invoice.payment_succeeded':
        console.log(
          `[stripe/webhook] invoice.payment_succeeded: invoice=${(event.data.object as Stripe.Invoice).id}`
        )
        break

      case 'invoice.payment_failed':
        console.warn(
          `[stripe/webhook] invoice.payment_failed: invoice=${(event.data.object as Stripe.Invoice).id} — customer may need to update payment method`
        )
        break

      default:
        // Return 200 for unhandled events — Stripe retries on non-2xx
        break
    }
  } catch (err) {
    // Log the error but still return 200 to prevent Stripe retries
    // that would hit the same error repeatedly
    console.error(
      `[stripe/webhook] Error handling event ${event.type}:`,
      err instanceof Error ? err.message : err
    )
  }

  return NextResponse.json({ received: true })
}
