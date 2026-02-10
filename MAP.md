# PaperRadar — Project Map

> AI Research Intelligence Platform — aggregates, enriches, scores, and personalizes AI/ML papers

## Directory Structure

```
paperradar/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout (dark theme, metadata)
│   │   ├── globals.css               # Dark theme, animations, custom scrollbar
│   │   ├── page.tsx                  # Landing page (hero, pricing, CTA)
│   │   ├── (auth)/                   # Auth group (no navbar)
│   │   │   ├── layout.tsx            # Centered auth layout
│   │   │   └── login/page.tsx        # Login (Google, GitHub, Magic Link)
│   │   ├── auth/
│   │   │   └── callback/route.ts     # OAuth/Magic Link callback + auto-profile
│   │   ├── (main)/                   # Main app group (with navbar)
│   │   │   ├── layout.tsx            # Navbar + footer shell
│   │   │   ├── feed/                 # Paper feed
│   │   │   │   ├── page.tsx          # Personalized/trending feed + free tier limits
│   │   │   │   ├── feed-filters.tsx  # Category/difficulty/time filters (client)
│   │   │   │   ├── paper-list.tsx    # Paper list renderer (server)
│   │   │   │   └── pagination.tsx    # Pagination controls
│   │   │   ├── paper/[id]/           # Paper detail
│   │   │   │   ├── page.tsx          # Full detail + gravity breakdown (server)
│   │   │   │   ├── loading.tsx       # Skeleton loading state
│   │   │   │   └── not-found.tsx     # 404 page
│   │   │   ├── cluster/[id]/
│   │   │   │   └── page.tsx          # Cluster detail with papers
│   │   │   ├── clusters/
│   │   │   │   └── page.tsx          # Browse all clusters (grid + search)
│   │   │   ├── billing/              # Subscription management
│   │   │   │   ├── page.tsx          # Plan info + pricing comparison (server)
│   │   │   │   └── billing-actions.tsx # Upgrade/Manage buttons (client)
│   │   │   └── settings/
│   │   │       ├── page.tsx          # User settings + billing link (server)
│   │   │       ├── settings-form.tsx # Settings form (client, optimistic UI)
│   │   │       └── actions.ts        # Server actions for settings mutations
│   │   ├── admin/                    # Admin dashboard
│   │   │   ├── layout.tsx            # Admin shell (header + nav)
│   │   │   ├── page.tsx              # Pipeline health, stats, papers
│   │   │   └── actions.ts            # Server actions for admin ops
│   │   └── api/
│   │       ├── email/
│   │       │   └── unsubscribe/route.ts # GET — HMAC-verified email unsubscribe
│   │       ├── papers/[id]/
│   │       │   ├── save/route.ts     # POST/DELETE — save/unsave paper
│   │       │   └── interact/route.ts # POST — view/click tracking
│   │       ├── pipeline/
│   │       │   ├── run/route.ts      # POST — manual pipeline trigger
│   │       │   └── status/route.ts   # GET — pipeline stats
│   │       └── stripe/
│   │           ├── checkout/route.ts # POST — create Stripe checkout session
│   │           ├── portal/route.ts   # POST — create Stripe portal session
│   │           └── webhook/route.ts  # POST — Stripe webhook handler
│   ├── components/                   # Shared UI components
│   │   ├── navbar.tsx                # Main nav with auth state
│   │   ├── user-menu.tsx             # User dropdown (client)
│   │   ├── mobile-nav.tsx            # Mobile hamburger menu
│   │   ├── paper-card.tsx            # Reusable paper card
│   │   ├── gravity-badge.tsx         # Color-coded score badge
│   │   ├── category-badge.tsx        # Category + difficulty pills
│   │   ├── save-button.tsx           # Save/unsave with optimistic UI
│   │   ├── upgrade-banner.tsx        # Upgrade prompt (full + compact variants)
│   │   └── paywall-gate.tsx          # Blur overlay for gated content (client)
│   ├── lib/
│   │   ├── ai/index.ts              # Vercel AI SDK: Anthropic + OpenAI providers
│   │   ├── auth/helpers.ts           # getCurrentUser, requireAuth
│   │   ├── db/
│   │   │   ├── supabase.ts          # Browser Supabase client
│   │   │   └── server.ts            # Server clients (service role + SSR)
│   │   ├── email/
│   │   │   ├── resend.ts            # Resend client singleton
│   │   │   ├── send-digest.ts       # Digest generation + batch sending
│   │   │   └── templates/
│   │   │       ├── digest.tsx        # React Email digest template (dark theme)
│   │   │       └── welcome.tsx       # React Email welcome template
│   │   ├── env.ts                    # Zod-validated environment config
│   │   ├── feed/
│   │   │   └── personalized.ts      # Personalized + trending feed logic
│   │   ├── paywall/
│   │   │   └── check.ts             # Tier limits, feature gates, view tracking
│   │   ├── profile/
│   │   │   └── update-vector.ts     # User profile embedding calculation
│   │   ├── stripe/
│   │   │   ├── client.ts            # Stripe SDK singleton
│   │   │   └── config.ts            # Price IDs + tier mapping
│   │   └── pipeline/                 # Core data pipeline
│   │       ├── utils.ts              # sleep, extractArxivId, chunked
│   │       ├── arxiv-ingest.ts       # ArXiv Atom feed → papers table
│   │       ├── enrich.ts             # Semantic Scholar + GitHub + Claude Haiku
│   │       ├── embed.ts              # OpenAI embeddings → pgvector
│   │       ├── cluster.ts            # Cosine similarity clustering
│   │       └── score.ts              # Gravity Engine (6-dimension scoring)
│   ├── middleware.ts                  # Auth session refresh + protected routes
│   ├── trigger/                      # trigger.dev v3 tasks
│   │   ├── ingest-arxiv.ts          # Cron: every 2h
│   │   ├── enrich-papers.ts         # Cron: every 30min
│   │   ├── embed-papers.ts          # Cron: every 30min
│   │   ├── cluster-update.ts        # Cron: every 1h
│   │   ├── score-papers.ts          # Cron: every 30min + daily rescore
│   │   ├── full-pipeline.ts         # Manual: end-to-end pipeline
│   │   └── send-digests.ts          # Cron: daily 8AM + weekly Monday 8AM
│   └── types/
│       └── database.ts              # TypeScript types for all DB tables
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql    # Tables, indexes, RLS, triggers
│       ├── 002_vector_functions.sql  # pgvector similarity search RPC
│       ├── 003_profile_functions.sql # Profile counters + personalized feed RPC
│       └── 004_stripe_indexes.sql    # Partial index on stripe_customer_id
├── trigger.config.ts                 # trigger.dev configuration
└── .env.example                      # All required env vars
```

## Data Flow

```
ArXiv RSS → ingest → papers table → enrich (S2 + GitHub + Haiku) → embed (OpenAI) → cluster → score (Gravity Engine)
                                                                                                        ↓
User login → profile created → browse feed (personalized or trending) → save/click papers → profile vector updated
                                                                                                        ↓
Cron (8 AM) → batch digest → Resend email (top 5-10 papers per user) → unsubscribe via HMAC-signed link
                                                                                                        ↓
Stripe Checkout → webhook → tier upgrade (free → pro/team) → paywall lifted → full access
```

## Key Concepts

- **Gravity Score**: 0-100 composite score (novelty 25%, social buzz 20%, builder relevance 20%, citation velocity 15%, author reputation 10%, technical depth 10%)
- **Pipeline stages**: Ingest → Enrich → Embed → Cluster → Score (each runs independently on different schedules)
- **Service client**: bypasses RLS for pipeline operations; SSR client respects RLS for user requests
- **Personalization**: User profile embedding = weighted average of saved (3x), clicked (2x), viewed (1x) paper embeddings; feed score = gravity_score * cosine_similarity
- **Auth flow**: Supabase Auth (Google/GitHub/Magic Link) → middleware session refresh → auto-profile creation on first login
- **Paywall**: Free tier limited to 5 papers/day, 10 saved, weekly digest only, no social buzz. Pro ($8/mo) unlocks everything
- **Billing**: Stripe Checkout → webhook updates profile tier → portal for management. Webhook verifies signatures, handles subscription lifecycle

## Routes

| Route | Type | Description |
|-------|------|-------------|
| `/` | Static | Landing page with pricing |
| `/login` | Static | Auth page (Google, GitHub, Magic Link) |
| `/feed` | Dynamic | Personalized or trending paper feed (free tier limited) |
| `/paper/[id]` | Dynamic | Paper detail with gravity breakdown |
| `/cluster/[id]` | Dynamic | Papers in a cluster |
| `/clusters` | Dynamic | Browse all clusters |
| `/billing` | Dynamic | Subscription management + pricing comparison |
| `/settings` | Dynamic | User preferences + saved papers |
| `/admin` | Dynamic | Pipeline monitoring dashboard |
| `/api/stripe/*` | Dynamic | Checkout, portal, webhook endpoints |
| `/api/email/unsubscribe` | Dynamic | HMAC-verified digest unsubscribe |

## Current Phase: 3 (Email Digest + Paywall) — COMPLETE
Next: Phase 4 (Social Signals + Growth)
