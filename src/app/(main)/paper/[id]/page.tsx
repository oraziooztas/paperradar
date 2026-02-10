// page.tsx — Paper detail page (server component)
// Desc: Full paper view with gravity breakdown, key findings, social signals, and related papers.
// Deps: @/lib/db/server, @/types/database, @/components/*, next/navigation, next
// Used by: /paper/[id] route

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient, createServerComponentClient } from '@/lib/db/server'
import type { Paper, SocialSignal, GravityBreakdown, SocialSource } from '@/types/database'
import GravityBadge from '@/components/gravity-badge'
import { CategoryBadge, DifficultyBadge } from '@/components/category-badge'
import SaveButton from '@/components/save-button'

// === TYPES ===

interface PageProps {
  params: Promise<{ id: string }>
}

interface RelatedPaper {
  id: string
  title: string
  gravity_score: number
  published_at: string
  categories: string[]
}

interface AuthorDetail {
  id: string
  name: string
  affiliations: string[]
  h_index: number | null
  paper_count: number
}

// === SEO METADATA ===

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: paper } = await supabase
    .from('papers')
    .select('title, tldr, categories, authors')
    .eq('id', id)
    .single()

  if (!paper) {
    return { title: 'Paper Not Found | PaperRadar' }
  }

  const description = paper.tldr ?? `Read "${paper.title}" on PaperRadar — AI Research Intelligence Platform.`
  const authorNames = (paper.authors as Paper['authors'])
    ?.slice(0, 3)
    .map((a) => a.name)
    .join(', ')

  return {
    title: `${paper.title} | PaperRadar`,
    description,
    openGraph: {
      title: paper.title,
      description,
      type: 'article',
      siteName: 'PaperRadar',
      tags: paper.categories as string[],
      authors: authorNames ? [authorNames] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: paper.title,
      description,
    },
  }
}

// === HELPERS ===

function formatRelativeTime(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getBarColor(score: number): string {
  if (score >= 70) return 'bg-green-500'
  if (score >= 40) return 'bg-yellow-500'
  return 'bg-red-500'
}

const breakdownLabels: Record<keyof GravityBreakdown, string> = {
  novelty: 'Novelty',
  social_buzz: 'Social',
  builder_relevance: 'Builder',
  citation_velocity: 'Citation',
  author_reputation: 'Author',
  technical_depth: 'Tech',
}

const socialIcons: Record<SocialSource, { label: string; color: string }> = {
  reddit: { label: 'Reddit', color: 'text-orange-400' },
  hackernews: { label: 'Hacker News', color: 'text-orange-500' },
  huggingface: { label: 'HuggingFace', color: 'text-yellow-400' },
  twitter: { label: 'Twitter/X', color: 'text-blue-400' },
  github: { label: 'GitHub', color: 'text-gray-300' },
}

function formatAuthorsInline(authors: Paper['authors'], max = 3): string {
  if (!authors || authors.length === 0) return 'Unknown authors'

  const formatted = authors.slice(0, max).map((a) => {
    if (a.affiliation) return `${a.name} (${a.affiliation})`
    return a.name
  })

  const remaining = authors.length - max
  return remaining > 0 ? `${formatted.join(', ')}, +${remaining}` : formatted.join(', ')
}

// === DATA FETCHING ===

async function fetchPaper(id: string): Promise<Paper | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('papers')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data as Paper
}

async function fetchSocialSignals(paperId: string): Promise<SocialSignal[]> {
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('social_signals')
    .select('*')
    .eq('paper_id', paperId)
    .order('score', { ascending: false })

  return (data as SocialSignal[] | null) ?? []
}

async function fetchRelatedPapers(paperId: string): Promise<RelatedPaper[]> {
  const supabase = createServiceClient()

  // Step 1: Find clusters this paper belongs to
  const { data: clusters } = await supabase
    .from('paper_clusters')
    .select('cluster_id')
    .eq('paper_id', paperId)

  if (!clusters || clusters.length === 0) return []

  const clusterIds = clusters.map((c) => c.cluster_id)

  // Step 2: Find other papers in the same clusters
  const { data: relatedLinks } = await supabase
    .from('paper_clusters')
    .select('paper_id')
    .in('cluster_id', clusterIds)
    .neq('paper_id', paperId)
    .limit(10)

  if (!relatedLinks || relatedLinks.length === 0) return []

  // Deduplicate paper IDs
  const uniquePaperIds = [...new Set(relatedLinks.map((r) => r.paper_id))]

  // Step 3: Fetch the related papers
  const { data: papers } = await supabase
    .from('papers')
    .select('id, title, gravity_score, published_at, categories')
    .in('id', uniquePaperIds)
    .order('gravity_score', { ascending: false })
    .limit(5)

  return (papers as RelatedPaper[] | null) ?? []
}

async function fetchAuthorDetails(paperId: string): Promise<AuthorDetail[]> {
  const supabase = createServiceClient()

  // Get author IDs linked to this paper, ordered by position
  const { data: links } = await supabase
    .from('paper_authors')
    .select('author_id, position')
    .eq('paper_id', paperId)
    .order('position', { ascending: true })

  if (!links || links.length === 0) return []

  const authorIds = links.map((l) => l.author_id)

  const { data: authors } = await supabase
    .from('authors')
    .select('id, name, affiliations, h_index, paper_count')
    .in('id', authorIds)

  return (authors as AuthorDetail[] | null) ?? []
}

async function checkIfSaved(paperId: string): Promise<{ isAuthenticated: boolean; isSaved: boolean }> {
  try {
    const supabase = await createServerComponentClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { isAuthenticated: false, isSaved: false }

    const { data } = await supabase
      .from('saved_papers')
      .select('paper_id')
      .eq('user_id', user.id)
      .eq('paper_id', paperId)
      .maybeSingle()

    return { isAuthenticated: true, isSaved: !!data }
  } catch {
    return { isAuthenticated: false, isSaved: false }
  }
}

// === SUB-COMPONENTS ===

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <h2 className="shrink-0 text-sm font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </h2>
      <div className="h-px flex-1 bg-gray-800" />
    </div>
  )
}

function GravityBreakdownChart({ breakdown }: { breakdown: GravityBreakdown }) {
  const entries = (Object.entries(breakdown) as [keyof GravityBreakdown, number | undefined][])
    .filter(([, value]) => value != null)

  if (entries.length === 0) return null

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="space-y-2.5">
        {entries.map(([key, value]) => {
          const score = value ?? 0
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-right text-xs font-medium text-gray-400">
                {breakdownLabels[key]}
              </span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-800">
                <div
                  className={`h-full rounded-full ${getBarColor(score)} transition-all`}
                  style={{ width: `${score}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right font-mono text-xs text-gray-300">
                {Math.round(score)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SocialSignalsSection({ signals }: { signals: SocialSignal[] }) {
  if (signals.length === 0) {
    return (
      <p className="text-sm text-gray-500">No social signals tracked yet.</p>
    )
  }

  return (
    <div className="space-y-2">
      {signals.map((signal) => {
        const config = socialIcons[signal.source]
        return (
          <div
            key={signal.id}
            className="flex items-center gap-3 rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2"
          >
            <span className={`text-sm font-medium ${config.color}`}>
              {config.label}
            </span>
            <span className="text-sm text-gray-300">
              {signal.score} upvotes
            </span>
            {signal.comments > 0 && (
              <span className="text-sm text-gray-500">
                {signal.comments} comments
              </span>
            )}
            {signal.external_url && (
              <a
                href={signal.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-xs text-indigo-400 hover:text-indigo-300"
              >
                View thread
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}

function RelatedPaperCard({ paper }: { paper: RelatedPaper }) {
  return (
    <Link
      href={`/paper/${paper.id}`}
      className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3 transition-colors hover:border-gray-700 hover:bg-gray-800/50"
    >
      <GravityBadge score={paper.gravity_score} size="sm" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium text-gray-200">
          {paper.title}
        </h3>
        <div className="mt-1 flex items-center gap-2">
          {paper.categories.slice(0, 2).map((cat) => (
            <span
              key={cat}
              className="text-xs text-gray-500"
            >
              {cat}
            </span>
          ))}
          <span className="text-xs text-gray-600">
            {formatRelativeTime(paper.published_at)}
          </span>
        </div>
      </div>
    </Link>
  )
}

function ActionButtons({
  paper,
  isAuthenticated,
  isSaved,
}: {
  paper: Paper
  isAuthenticated: boolean
  isSaved: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Save button */}
      {isAuthenticated && (
        <SaveButton paperId={paper.id} initialSaved={isSaved} />
      )}

      {/* Share — clipboard copy stub */}
      <button
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-200"
        aria-label="Share paper"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
        </svg>
        Share
      </button>

      {/* ArXiv link */}
      {paper.source_url && (
        <a
          href={paper.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
          ArXiv
        </a>
      )}

      {/* PDF link */}
      {paper.pdf_url && (
        <a
          href={paper.pdf_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          PDF
        </a>
      )}

      {/* Code link */}
      {paper.code_url && (
        <a
          href={paper.code_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-sm text-indigo-400 transition-colors hover:border-indigo-500/50 hover:text-indigo-300"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
          </svg>
          Code
        </a>
      )}
    </div>
  )
}

// === MAIN PAGE COMPONENT ===

export default async function PaperDetailPage({ params }: PageProps) {
  const { id } = await params

  // Fetch all data in parallel
  const [paper, socialSignals, relatedPapers, authorDetails, savedStatus] = await Promise.all([
    fetchPaper(id),
    fetchSocialSignals(id),
    fetchRelatedPapers(id),
    fetchAuthorDetails(id),
    checkIfSaved(id),
  ])

  if (!paper) {
    notFound()
  }

  const { isAuthenticated, isSaved } = savedStatus

  // Merge author details with paper's embedded authors for display
  // Paper.authors has name + affiliation, authorDetails has h_index + paper_count
  const displayAuthors = paper.authors

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Back navigation */}
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-300"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to Feed
      </Link>

      {/* === GRAVITY SCORE + BREAKDOWN === */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        <div className="flex items-center gap-3">
          <GravityBadge score={paper.gravity_score} size="lg" breakdown={paper.gravity_breakdown} />
          <span className="text-sm font-medium text-gray-500">Gravity Score</span>
        </div>
        <div className="flex-1">
          <GravityBreakdownChart breakdown={paper.gravity_breakdown} />
        </div>
      </div>

      {/* === TITLE + META === */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold leading-tight text-gray-100 sm:text-3xl">
          {paper.title}
        </h1>

        <p className="mt-2 text-sm text-gray-400">
          by {formatAuthorsInline(displayAuthors, 3)}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">
            Published {formatRelativeTime(paper.published_at)}
          </span>

          {paper.categories.length > 0 && (
            <>
              <span className="text-gray-700" aria-hidden="true">&middot;</span>
              {paper.categories.map((cat) => (
                <CategoryBadge key={cat} category={cat} />
              ))}
            </>
          )}

          {paper.difficulty && (
            <>
              <span className="text-gray-700" aria-hidden="true">&middot;</span>
              <DifficultyBadge difficulty={paper.difficulty} />
            </>
          )}
        </div>
      </div>

      {/* === ACTION BUTTONS === */}
      <div className="mb-8">
        <ActionButtons
          paper={paper}
          isAuthenticated={isAuthenticated}
          isSaved={isSaved}
        />
      </div>

      {/* === CONTENT SECTIONS === */}
      <div className="space-y-8">
        {/* TLDR */}
        {paper.tldr && (
          <section>
            <SectionHeader title="TLDR" />
            <p className="mt-3 text-sm leading-relaxed text-gray-300">
              {paper.tldr}
            </p>
          </section>
        )}

        {/* Key Findings */}
        {paper.key_findings && paper.key_findings.length > 0 && (
          <section>
            <SectionHeader title="Key Findings" />
            <ul className="mt-3 space-y-2">
              {paper.key_findings.map((finding, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-gray-300">
                  <span className="mt-1 shrink-0 text-indigo-400">&bull;</span>
                  <span>{finding}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Novelty Assessment */}
        {paper.novelty_assessment && (
          <section>
            <SectionHeader title="Novelty Assessment" />
            <p className="mt-3 text-sm leading-relaxed text-gray-300">
              {paper.novelty_assessment}
            </p>
          </section>
        )}

        {/* Practical Applicability */}
        {paper.practical_applicability && (
          <section>
            <SectionHeader title="Practical Applicability" />
            <p className="mt-3 text-sm leading-relaxed text-gray-300">
              {paper.practical_applicability}
            </p>
          </section>
        )}

        {/* Author Details (from authors table) */}
        {authorDetails.length > 0 && (
          <section>
            <SectionHeader title="Authors" />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {authorDetails.map((author) => (
                <div
                  key={author.id}
                  className="flex items-center gap-3 rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-800 text-xs font-bold text-gray-400">
                    {author.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-200">
                      {author.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {author.affiliations.length > 0 && (
                        <span className="truncate">{author.affiliations[0]}</span>
                      )}
                      {author.h_index != null && (
                        <span>h-index: {author.h_index}</span>
                      )}
                      {author.paper_count > 0 && (
                        <span>{author.paper_count} papers</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Social Signals */}
        <section>
          <SectionHeader title="Social Signals" />
          <div className="mt-3">
            <SocialSignalsSection signals={socialSignals} />
          </div>
        </section>

        {/* Related Papers */}
        {relatedPapers.length > 0 && (
          <section>
            <SectionHeader title="Related Papers" />
            <div className="mt-3 space-y-2">
              {relatedPapers.map((rp) => (
                <RelatedPaperCard key={rp.id} paper={rp} />
              ))}
            </div>
          </section>
        )}

        {/* Abstract — collapsible */}
        <section>
          <SectionHeader title="Abstract" />
          <details className="mt-3 group">
            <summary className="cursor-pointer text-sm font-medium text-indigo-400 transition-colors hover:text-indigo-300">
              <span className="group-open:hidden">Show full abstract</span>
              <span className="hidden group-open:inline">Hide abstract</span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-gray-400 whitespace-pre-line">
              {paper.abstract}
            </p>
          </details>
        </section>
      </div>

      {/* === FOOTER META === */}
      <div className="mt-12 border-t border-gray-800 pt-4">
        <p className="text-xs text-gray-600">
          Paper ID: {paper.arxiv_id} &middot; Added to PaperRadar {formatRelativeTime(paper.created_at)}
          {paper.enriched_at && ` \u00b7 Enriched ${formatRelativeTime(paper.enriched_at)}`}
          {paper.scored_at && ` \u00b7 Scored ${formatRelativeTime(paper.scored_at)}`}
        </p>
      </div>
    </div>
  )
}
