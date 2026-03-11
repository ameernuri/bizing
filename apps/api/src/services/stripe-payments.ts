import Stripe from 'stripe'

/**
 * Stripe provider service helpers.
 *
 * ELI5:
 * - This file is the "translator" between Bizing payment language and Stripe's language.
 * - Routes should not hardcode Stripe-specific status names or env parsing logic inline.
 * - Keeping this translation in one place makes future provider changes safer.
 */

let stripeClientSingleton: Stripe | null | undefined

/**
 * Returns true when Stripe credentials are available.
 */
export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

/**
 * Returns true when current key is a Stripe test key.
 *
 * Why this exists:
 * - local/operator testing flows can safely auto-confirm with Stripe test PMs,
 * - production/live keys must never rely on test-only shortcuts.
 */
export function isStripeTestMode() {
  const key = process.env.STRIPE_SECRET_KEY ?? ''
  return key.startsWith('sk_test_')
}

/**
 * Lazy Stripe client getter.
 *
 * Returns null when key is missing so callers can decide whether to:
 * - fail hard (strict provider route), or
 * - gracefully fall back (hybrid/simulated route).
 */
export function getStripeClient(): Stripe | null {
  if (stripeClientSingleton !== undefined) return stripeClientSingleton
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    stripeClientSingleton = null
    return stripeClientSingleton
  }
  stripeClientSingleton = new Stripe(key, {
    appInfo: {
      name: 'bizing-api',
      version: '0.1.0',
    },
  })
  return stripeClientSingleton
}

/**
 * Strict Stripe client getter for routes that require real provider operations.
 */
export function requireStripeClient(): Stripe {
  const client = getStripeClient()
  if (!client) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY in environment.')
  }
  return client
}

/**
 * Canonical status mapping from Stripe PaymentIntent to Bizing payment_intent_status.
 */
export function mapStripeIntentStatusToBizing(
  status: Stripe.PaymentIntent.Status,
): 'requires_payment_method' | 'requires_confirmation' | 'requires_capture' | 'processing' | 'succeeded' | 'failed' | 'cancelled' {
  switch (status) {
    case 'requires_payment_method':
      return 'requires_payment_method'
    case 'requires_confirmation':
    case 'requires_action':
      return 'requires_confirmation'
    case 'requires_capture':
      return 'requires_capture'
    case 'processing':
      return 'processing'
    case 'succeeded':
      return 'succeeded'
    case 'canceled':
      return 'cancelled'
    default:
      return 'failed'
  }
}

/**
 * Best-effort extraction of charge reference from a Stripe PaymentIntent payload.
 *
 * Why this helper exists:
 * - transaction rows should keep provider transaction refs for reconciliation,
 * - Stripe PI payload shape can vary depending on expansion level.
 */
export function extractStripeChargeRef(paymentIntent: Stripe.PaymentIntent): string | null {
  const latestCharge = paymentIntent.latest_charge
  if (typeof latestCharge === 'string') return latestCharge
  if (latestCharge && typeof latestCharge.id === 'string') return latestCharge.id
  return null
}

/**
 * Determines whether local dev/testing is allowed to auto-confirm with
 * Stripe's built-in test payment method (`pm_card_visa`) when no payment method
 * was supplied by the caller.
 *
 * Guardrails:
 * - never enabled for production env
 * - never enabled for live keys
 */
export function canUseStripeAutoTestCard() {
  return process.env.NODE_ENV !== 'production' && isStripeTestMode()
}

