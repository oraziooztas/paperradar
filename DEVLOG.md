# DEVLOG — PaperRadar

## 2026-02-10 — Phase 1: Pipeline MVP scaffolding

- Scaffolded Next.js 14+ project with App Router, Tailwind, TypeScript
- Created full DB schema (10 tables) with pgvector, RLS policies, indexes
- Built complete pipeline: ArXiv ingest → Semantic Scholar/GitHub/Haiku enrichment → OpenAI embeddings → cosine similarity clustering → Gravity Score engine
- Set up trigger.dev v3 cron tasks for automated pipeline execution
- Built admin dashboard (server component, dark theme) for pipeline monitoring
- Added API routes for manual pipeline trigger and status check
- All files pass `npx tsc --noEmit` with zero errors
- **Next steps**: set up Supabase project, configure env vars, run first pipeline test

## 2026-02-10 — Phase 2: Web App + Feed

- Built auth system: Supabase Auth (Google, GitHub, Magic Link), middleware session refresh, auto-profile on first login
- Created 7 shared components: Navbar, UserMenu, MobileNav, PaperCard, GravityBadge, CategoryBadge, SaveButton
- Landing page with 7 sections: Hero (animated radar), Problem, Gravity Engine, Features, Pricing (Free/$8/$20), Social Proof, CTA
- Feed page with 3 modes: personalized (vector-ranked), gravity (score-sorted), trending (for anonymous users)
- Filter system: category, difficulty, time range — all URL-based (server-compatible)
- Paper detail page: gravity breakdown bar chart, social signals, related papers, author cards, collapsible abstract, SEO metadata
- Clusters: browse grid with search + cluster detail page with papers sorted by gravity
- Settings: profile editing, category preferences (13 categories), digest frequency, saved papers management, optimistic UI
- User interaction tracking: save/unsave, view/click with rate limiting, profile vector auto-update (weighted: save 3x, click 2x, view 1x)
- Migration 003: profile counter RPCs + `get_personalized_feed` RPC (gravity * cosine similarity)
- All files pass `npx tsc --noEmit` and `npm run build` with zero errors (14 routes)
- **Next steps**: Phase 3 — Email digest (Resend), Stripe subscription, paywall enforcement

## 2026-02-10 — Phase 3: Email Digest + Paywall

- **Email system**: Resend client, React Email templates (digest + welcome), dark theme matching app
- **Digest pipeline**: `sendDigestToUser()` fetches top 5/10 papers (free/pro) per user profile, `sendBatchDigests()` processes all users in batches of 10
- **Digest cron**: trigger.dev tasks — daily at 8 AM UTC, weekly on Mondays at 8 AM UTC
- **Unsubscribe**: HMAC-signed URLs with timing-safe comparison, sets `digest_frequency = 'none'`
- **Stripe integration**: checkout session creation, customer portal, webhook handler (5 event types)
- **Webhook security**: raw body parsing, signature verification, safe tier fallback for unknown price IDs
- **Portal redirect**: if user with active subscription hits checkout, redirect to portal instead
- **Paywall system**: `TIER_LIMITS` config, `meetsMinimumTier()` rank-based comparison, feature gates
- **Feed limits**: free tier capped at 5 papers/day (counted via user_interactions), upgrade banner shown after limit
- **Billing page**: current plan card, pricing comparison table (3 tiers x 7 features), upgrade/manage buttons
- **Upgrade UI**: `UpgradeBanner` (full + compact), `PaywallGate` (blur overlay with teaser), settings integration
- Migration 004: partial index on `stripe_customer_id` for webhook lookups
- All files pass `npx tsc --noEmit` and `npm run build` with zero errors (19 routes)
- **Next steps**: Phase 4 — Reddit/HuggingFace social signals, SEO, share-to-X, referral system
