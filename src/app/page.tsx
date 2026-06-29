// page.tsx — PaperRadar landing page (server component)
// Deps: none (pure Tailwind + inline SVG) | Used by: / route

import Link from "next/link"

// === TYPES ===

interface GravityDimension {
  name: string
  weight: number
  description: string
  color: string
}

interface Feature {
  title: string
  description: string
  icon: React.ReactNode
}

interface PricingTier {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  cta: string
  highlighted: boolean
}

// === DATA ===

const GRAVITY_DIMENSIONS: GravityDimension[] = [
  { name: "Novelty", weight: 25, description: "Is this genuinely new?", color: "bg-violet-500" },
  { name: "Social Buzz", weight: 20, description: "What's the community saying?", color: "bg-indigo-500" },
  { name: "Builder Relevance", weight: 20, description: "Can I use this today?", color: "bg-blue-500" },
  { name: "Citation Velocity", weight: 15, description: "How fast is it being cited?", color: "bg-cyan-500" },
  { name: "Author Reputation", weight: 10, description: "Who's behind this?", color: "bg-teal-500" },
  { name: "Technical Depth", weight: 10, description: "How rigorous is it?", color: "bg-emerald-500" },
]

const FEATURES: Feature[] = [
  {
    title: "Personalized Feed",
    description:
      "Your AI research TikTok. Papers ranked by relevance to YOUR interests, not just recency.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    title: "TLDR + Key Findings",
    description:
      "Every paper summarized in 2 sentences. Key findings as bullet points. Decide in seconds, not hours.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    title: "Smart Clustering",
    description:
      "Related papers grouped automatically. See the full picture of any research trend at a glance.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V19.5m0 2.25l-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25" />
      </svg>
    ),
  },
  {
    title: "Email Digest",
    description:
      "Top 5 papers for you, daily or weekly. Never miss what matters, delivered to your inbox.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
  },
]

const PRICING_TIERS: PricingTier[] = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Get started with AI paper discovery",
    features: [
      "5 papers per day",
      "Weekly email digest",
      "Basic gravity scores",
      "Search & browse",
    ],
    cta: "Start Free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$8",
    period: "/mo",
    description: "For serious researchers and builders",
    features: [
      "Unlimited paper feed",
      "Daily email digest",
      "Full gravity breakdown",
      "Social buzz data",
      "Advanced filters & search",
      "Export to Notion / CSV",
      "Priority paper processing",
    ],
    cta: "Go Pro",
    highlighted: true,
  },
  {
    name: "Team",
    price: "$20",
    period: "/user/mo",
    description: "For research labs and AI teams",
    features: [
      "Everything in Pro",
      "Shared team collections",
      "Collaborative annotations",
      "API access (1,000 req/day)",
      "Custom alert rules",
      "Admin dashboard",
      "Slack integration",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
]

const ARXIV_CATEGORIES = ["cs.AI", "cs.CL", "cs.LG", "cs.CV", "cs.RO", "stat.ML"]

// === COMPONENTS ===

function Navbar() {
  return (
    <nav className="fixed top-0 z-50 w-full border-b border-gray-800/50 bg-gray-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          {/* Radar icon */}
          <div className="relative flex h-8 w-8 items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-indigo-500/30" />
            <div className="absolute inset-1.5 rounded-full border border-indigo-500/50" />
            <div className="h-2 w-2 rounded-full bg-indigo-500" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-gray-100">
            PaperRadar
          </span>
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-gray-400 transition-colors hover:text-gray-100">
            Features
          </a>
          <a href="#gravity" className="text-sm text-gray-400 transition-colors hover:text-gray-100">
            Gravity Engine
          </a>
          <a href="#pricing" className="text-sm text-gray-400 transition-colors hover:text-gray-100">
            Pricing
          </a>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/login"
            className="hidden text-sm text-gray-300 transition-colors hover:text-gray-100 sm:block"
          >
            Log in
          </a>
          <a
            href="/feed"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
          >
            Start Free
          </a>
        </div>
      </div>
    </nav>
  )
}

function HeroRadarVisual() {
  // Pure CSS radar with floating paper cards
  const papers = [
    { score: 94, title: "Scaling Laws for...", x: "left-[12%]", y: "top-[18%]", delay: "float-slow" },
    { score: 87, title: "Attention Is All...", x: "right-[8%]", y: "top-[24%]", delay: "float-medium" },
    { score: 76, title: "RLHF Without...", x: "left-[22%]", y: "bottom-[20%]", delay: "float-fast" },
    { score: 91, title: "Sparse MoE for...", x: "right-[18%]", y: "bottom-[28%]", delay: "float-slow" },
    { score: 68, title: "Benchmark for...", x: "left-[42%]", y: "top-[8%]", delay: "float-medium" },
  ]

  return (
    <div className="relative mx-auto mt-16 h-[340px] w-full max-w-2xl lg:mt-0 lg:h-[480px]">
      {/* Background glow */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-64 w-64 rounded-full bg-indigo-600/10 blur-3xl lg:h-80 lg:w-80" />
      </div>

      {/* Concentric radar rings */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="radar-ring absolute h-48 w-48 rounded-full border border-indigo-500/20 lg:h-64 lg:w-64" />
        <div className="radar-ring-d1 absolute h-72 w-72 rounded-full border border-indigo-500/15 lg:h-96 lg:w-96" />
        <div className="radar-ring-d2 absolute h-96 w-96 rounded-full border border-indigo-500/10 lg:h-[28rem] lg:w-[28rem]" />
      </div>

      {/* Center dot */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-3 w-3 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/50" />
      </div>

      {/* Floating paper cards */}
      {papers.map((paper) => (
        <div
          key={paper.title}
          className={`absolute ${paper.x} ${paper.y} ${paper.delay} rounded-lg border border-gray-700/50 bg-gray-900/80 px-3 py-2 backdrop-blur-sm`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex h-6 min-w-[2rem] items-center justify-center rounded-md text-xs font-bold ${
                paper.score >= 90
                  ? "bg-indigo-500/20 text-indigo-300"
                  : paper.score >= 80
                    ? "bg-blue-500/20 text-blue-300"
                    : "bg-gray-600/20 text-gray-400"
              }`}
            >
              {paper.score}
            </span>
            <span className="whitespace-nowrap text-xs text-gray-300">{paper.title}</span>
          </div>
        </div>
      ))}

      {/* Crosshair lines */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute h-px w-full bg-gradient-to-r from-transparent via-indigo-500/10 to-transparent" />
        <div className="absolute h-full w-px bg-gradient-to-b from-transparent via-indigo-500/10 to-transparent" />
      </div>
    </div>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gray-950 pt-32 pb-24 lg:pt-40 lg:pb-32">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-gray-950 to-gray-950" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-12">
          {/* Copy */}
          <div className="max-w-2xl">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              <span className="text-xs font-medium text-indigo-300">
                Tracking 500+ papers daily from ArXiv
              </span>
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-gray-100 md:text-5xl lg:text-6xl">
              Stop Drowning
              <br />
              in AI Papers
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-gray-400">
              500+ AI papers published daily. PaperRadar uses AI to score, rank, and personalize the
              ones that matter to you.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <a
                href="/feed"
                className="glow-indigo inline-flex items-center justify-center rounded-lg bg-indigo-600 px-6 py-3 text-base font-semibold text-white transition-all hover:bg-indigo-500"
              >
                Start Reading for Free
                <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
              <a
                href="#gravity"
                className="inline-flex items-center justify-center rounded-lg border border-gray-700 px-6 py-3 text-base font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-gray-100"
              >
                See how it works
              </a>
            </div>
          </div>

          {/* Visual */}
          <HeroRadarVisual />
        </div>
      </div>
    </section>
  )
}

function ProblemSection() {
  const pains = [
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-red-400" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: "Hours wasted scanning abstracts",
      description: "You open ArXiv and 45 minutes vanish. Most papers are irrelevant to your work.",
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-amber-400" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
      ),
      title: "No way to know what's actually novel",
      description: "Every paper claims a breakthrough. Without deep reading, you can't separate signal from noise.",
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-orange-400" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
      title: "Citation count? That's a 6-month lagging indicator",
      description: "By the time a paper has citations, the opportunity to build on it has passed.",
    },
  ]

  return (
    <section className="bg-gray-900/50 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
            The Problem
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-100 md:text-4xl">
            500+ papers/day on ArXiv.
            <br />
            You&apos;re missing breakthroughs.
          </h2>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-8 md:grid-cols-3">
          {pains.map((pain) => (
            <div
              key={pain.title}
              className="rounded-xl border border-gray-800 bg-gray-900/60 p-6"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gray-800/80">
                {pain.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-100">{pain.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">{pain.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function GravityEngineSection() {
  return (
    <section id="gravity" className="bg-gray-950 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
            The Gravity Engine
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-100 md:text-4xl">
            We score every paper in real-time
          </h2>
          <p className="mt-4 text-gray-400">
            Six dimensions, weighted and combined into a single Gravity Score. No more guessing.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-3xl">
          {/* Score visualization */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-8">
            {/* Example total score */}
            <div className="mb-8 flex items-center justify-between">
              <span className="text-sm font-medium uppercase tracking-wider text-gray-500">
                Example Gravity Score
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-indigo-400">87</span>
                <span className="text-sm text-gray-500">/100</span>
              </div>
            </div>

            {/* Dimension bars */}
            <div className="space-y-5">
              {GRAVITY_DIMENSIONS.map((dim) => (
                <div key={dim.name}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-200">{dim.name}</span>
                      <span className="text-xs text-gray-500">{dim.description}</span>
                    </div>
                    <span className="font-mono text-xs text-gray-400">{dim.weight}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-800">
                    <div
                      className={`h-full rounded-full ${dim.color}`}
                      style={{ width: `${dim.weight * 4}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-8 flex flex-wrap gap-4 border-t border-gray-800 pt-6">
              {GRAVITY_DIMENSIONS.map((dim) => (
                <div key={dim.name} className="flex items-center gap-1.5">
                  <div className={`h-2.5 w-2.5 rounded-sm ${dim.color}`} />
                  <span className="text-xs text-gray-500">
                    {dim.name} ({dim.weight}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function FeaturesSection() {
  return (
    <section id="features" className="bg-gray-900/50 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
            Features
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-100 md:text-4xl">
            Everything you need to stay ahead
          </h2>
          <p className="mt-4 text-gray-400">
            From discovery to deep dives, PaperRadar covers the full research workflow.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-6 md:grid-cols-2">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-gray-800 bg-gray-950/50 p-6 transition-colors hover:border-indigo-500/30 hover:bg-gray-900/50"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 transition-colors group-hover:bg-indigo-500/20">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-100">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function PricingSection() {
  return (
    <section id="pricing" className="bg-gray-950 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-100 md:text-4xl">
            Less than a coffee a week
          </h2>
          <p className="mt-4 text-gray-400">
            Start free. Upgrade when you need the full picture.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-8 md:grid-cols-3">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl border p-8 ${
                tier.highlighted
                  ? "glow-indigo border-indigo-500/40 bg-gray-900/80"
                  : "border-gray-800 bg-gray-900/40"
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-semibold text-white">
                  Best Value
                </div>
              )}

              <h3 className="text-lg font-semibold text-gray-100">{tier.name}</h3>
              <p className="mt-1 text-sm text-gray-500">{tier.description}</p>

              <div className="mt-6 flex items-baseline">
                <span className="text-4xl font-bold text-gray-100">{tier.price}</span>
                <span className="ml-1 text-sm text-gray-500">{tier.period}</span>
              </div>

              <a
                href="/feed"
                className={`mt-8 block w-full rounded-lg py-2.5 text-center text-sm font-semibold transition-colors ${
                  tier.highlighted
                    ? "bg-indigo-600 text-white hover:bg-indigo-500"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {tier.cta}
              </a>

              <ul className="mt-8 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <svg
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        tier.highlighted ? "text-indigo-400" : "text-gray-600"
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-400">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SocialProofSection() {
  const sources = [
    { name: "ArXiv", description: "Primary paper source" },
    { name: "Semantic Scholar", description: "Citation data" },
    { name: "HuggingFace", description: "Community signals" },
  ]

  return (
    <section className="bg-gray-900/50 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
            Built for the AI Community
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-100 md:text-4xl">
            Powered by the sources you trust
          </h2>
        </div>

        {/* Source logos / badges */}
        <div className="mx-auto mt-12 flex max-w-2xl flex-wrap items-center justify-center gap-6">
          {sources.map((source) => (
            <div
              key={source.name}
              className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900/60 px-6 py-4"
            >
              {/* Simple icon placeholder */}
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-800">
                <span className="font-mono text-sm font-bold text-indigo-400">
                  {source.name.charAt(0)}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-200">{source.name}</p>
                <p className="text-xs text-gray-500">{source.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Categories */}
        <div className="mx-auto mt-12 max-w-2xl text-center">
          <p className="mb-4 text-sm text-gray-500">Covering all major AI categories</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {ARXIV_CATEGORIES.map((cat) => (
              <span
                key={cat}
                className="rounded-md border border-gray-700 bg-gray-800/60 px-3 py-1 font-mono text-xs text-gray-300"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function FinalCTASection() {
  return (
    <section className="relative overflow-hidden bg-gray-950 py-24">
      {/* Background glow */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-100 md:text-4xl lg:text-5xl">
          Start reading smarter today
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-gray-400">
          Get the &quot;Paper of the Day&quot; in your inbox. Curated by AI, built for builders.
        </p>

        {/* Email signup form */}
        <form
          className="mx-auto mt-10 flex max-w-md flex-col gap-3 sm:flex-row"
          action="#"
          method="POST"
        >
          <input
            type="email"
            name="email"
            placeholder="you@research.ai"
            required
            className="flex-1 rounded-lg border border-gray-700 bg-gray-900/80 px-4 py-3 text-sm text-gray-200 placeholder-gray-500 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
          >
            Subscribe
          </button>
        </form>

        <p className="mt-4 text-xs text-gray-600">
          Free forever. Upgrade when you&apos;re ready. No spam, unsubscribe anytime.
        </p>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-gray-800/50 bg-gray-950 py-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-6 w-6 items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-indigo-500/30" />
              <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            </div>
            <span className="text-sm font-semibold text-gray-400">PaperRadar</span>
          </div>

          {/* Links */}
          <div className="flex gap-8">
            <a href="#features" className="text-xs text-gray-500 transition-colors hover:text-gray-300">
              Features
            </a>
            <a href="#pricing" className="text-xs text-gray-500 transition-colors hover:text-gray-300">
              Pricing
            </a>
            <a href="#gravity" className="text-xs text-gray-500 transition-colors hover:text-gray-300">
              Gravity Engine
            </a>
            <a href="/privacy" className="text-xs text-gray-500 transition-colors hover:text-gray-300">
              Privacy
            </a>
          </div>

          {/* Copyright */}
          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} PaperRadar. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

// === MAIN PAGE ===

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <Hero />
      <ProblemSection />
      <GravityEngineSection />
      <FeaturesSection />
      <PricingSection />
      <SocialProofSection />
      <FinalCTASection />
      <Footer />
    </div>
  )
}
