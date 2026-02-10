-- 004_stripe_indexes.sql — Indexes for Stripe-related lookups
-- Why: webhook handler queries profiles by stripe_customer_id frequently;
-- without an index this would be a full table scan.

-- Index for looking up profiles by stripe_customer_id (webhook handler)
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
