// page.tsx — Admin dashboard: pipeline health, paper stats, recent papers, top papers, clusters
// Deps: @/lib/db/server, date-fns, @/types/database | Used by: /admin route

import { createServiceClient } from '@/lib/db/server'
import { formatDistanceToNow, differenceInSeconds, startOfDay } from 'date-fns'
import type { Paper, PipelineRun, Cluster, GravityBreakdown } from '@/types/database'

// === HELPERS ===

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen) + '...'
}

function statusColor(status: string): string {
  switch (status) {
    case 'completed': return 'text-green-400 bg-green-400/10 border-green-400/20'
    case 'failed': return 'text-red-400 bg-red-400/10 border-red-400/20'
    case 'running': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
    default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
  }
}

function scoreColor(score: number): string {
  if (score > 70) return 'text-green-400'
  if (score >= 40) return 'text-yellow-400'
  return 'text-red-400'
}

function scoreBgColor(score: number): string {
  if (score > 70) return 'bg-green-500'
  if (score >= 40) return 'bg-yellow-500'
  return 'bg-red-500'
}

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return 'in progress'
  const seconds = differenceInSeconds(new Date(completedAt), new Date(startedAt))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

function relativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
  } catch {
    return dateStr
  }
}

function breakdownTooltip(breakdown: GravityBreakdown): string {
  const parts: string[] = []
  if (breakdown.novelty != null) parts.push(`Novelty: ${breakdown.novelty}`)
  if (breakdown.social_buzz != null) parts.push(`Social: ${breakdown.social_buzz}`)
  if (breakdown.builder_relevance != null) parts.push(`Builder: ${breakdown.builder_relevance}`)
  if (breakdown.citation_velocity != null) parts.push(`Citations: ${breakdown.citation_velocity}`)
  if (breakdown.author_reputation != null) parts.push(`Author: ${breakdown.author_reputation}`)
  if (breakdown.technical_depth != null) parts.push(`Technical: ${breakdown.technical_depth}`)
  return parts.length > 0 ? parts.join(' | ') : 'No breakdown available'
}

// Force dynamic rendering — admin page needs live DB data, no static prerender
export const dynamic = 'force-dynamic'

// === DATA FETCHING ===

async function fetchDashboardData() {
  const supabase = createServiceClient()
  const todayStart = startOfDay(new Date()).toISOString()

  const [
    pipelineRunsResult,
    totalPapersResult,
    papersIngestedTodayResult,
    enrichedPapersResult,
    embeddedPapersResult,
    scoredPapersResult,
    recentPapersResult,
    topPapersResult,
    clustersResult,
    todayRunsResult,
  ] = await Promise.all([
    // Last 10 pipeline runs
    supabase
      .from('pipeline_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10),

    // Total papers count
    supabase.from('papers').select('*', { count: 'exact', head: true }),

    // Papers ingested today
    supabase
      .from('papers')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart),

    // Papers enriched
    supabase
      .from('papers')
      .select('*', { count: 'exact', head: true })
      .not('enriched_at', 'is', null),

    // Papers embedded
    supabase
      .from('papers')
      .select('*', { count: 'exact', head: true })
      .not('embedded_at', 'is', null),

    // Papers scored
    supabase
      .from('papers')
      .select('*', { count: 'exact', head: true })
      .not('scored_at', 'is', null),

    // Recent 20 papers
    supabase
      .from('papers')
      .select('id, arxiv_id, title, gravity_score, gravity_breakdown, categories, enriched_at, embedded_at, scored_at, published_at')
      .order('published_at', { ascending: false })
      .limit(20),

    // Top 10 papers by gravity score
    supabase
      .from('papers')
      .select('id, title, gravity_score, gravity_breakdown, categories, published_at')
      .order('gravity_score', { ascending: false })
      .limit(10),

    // All clusters
    supabase
      .from('clusters')
      .select('*')
      .order('top_gravity_score', { ascending: false }),

    // Pipeline runs today (for success rate)
    supabase
      .from('pipeline_runs')
      .select('status')
      .gte('started_at', todayStart),
  ])

  const pipelineRuns = (pipelineRunsResult.data ?? []) as PipelineRun[]
  const totalPapers = totalPapersResult.count ?? 0
  const papersIngestedToday = papersIngestedTodayResult.count ?? 0
  const enrichedPapers = enrichedPapersResult.count ?? 0
  const embeddedPapers = embeddedPapersResult.count ?? 0
  const scoredPapers = scoredPapersResult.count ?? 0
  const recentPapers = (recentPapersResult.data ?? []) as Pick<Paper, 'id' | 'arxiv_id' | 'title' | 'gravity_score' | 'gravity_breakdown' | 'categories' | 'enriched_at' | 'embedded_at' | 'scored_at' | 'published_at'>[]
  const topPapers = (topPapersResult.data ?? []) as Pick<Paper, 'id' | 'title' | 'gravity_score' | 'gravity_breakdown' | 'categories' | 'published_at'>[]
  const clusters = (clustersResult.data ?? []) as Cluster[]

  const todayRuns = (todayRunsResult.data ?? []) as Pick<PipelineRun, 'status'>[]
  const todayRunsTotal = todayRuns.length
  const todayRunsCompleted = todayRuns.filter(r => r.status === 'completed').length
  const successRate = todayRunsTotal > 0 ? Math.round((todayRunsCompleted / todayRunsTotal) * 100) : 0

  return {
    pipelineRuns,
    totalPapers,
    papersIngestedToday,
    enrichedPapers,
    embeddedPapers,
    scoredPapers,
    recentPapers,
    topPapers,
    clusters,
    todayRunsTotal,
    successRate,
  }
}

// === PAGE COMPONENT ===

export default async function AdminDashboard() {
  const data = await fetchDashboardData()

  return (
    <div className="space-y-8 max-w-7xl mx-auto">

      {/* === PIPELINE HEALTH === */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-100">Pipeline Health</h2>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-400">
              Today: <span className="font-mono text-gray-200">{data.todayRunsTotal}</span> runs
            </span>
            <span className="text-gray-400">
              Success rate:{' '}
              <span className={`font-mono ${data.successRate >= 80 ? 'text-green-400' : data.successRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                {data.successRate}%
              </span>
            </span>
          </div>
        </div>

        {data.pipelineRuns.length === 0 ? (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center">
            <p className="text-gray-500">No pipeline runs yet</p>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 text-gray-400 font-medium">Task</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Status</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-right">Papers</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Started</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-right">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {data.pipelineRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-200 text-xs">{run.task_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColor(run.status)}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-300">{run.papers_processed}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{relativeTime(run.started_at)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-400 text-xs">
                      {formatDuration(run.started_at, run.completed_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* === PAPERS OVERVIEW === */}
      <section>
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Papers Overview</h2>

        {data.totalPapers === 0 ? (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center">
            <p className="text-gray-500">No papers ingested yet</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 mb-6">
              <StatCard label="Total Papers" value={data.totalPapers} />
              <StatCard label="Ingested Today" value={data.papersIngestedToday} />
              <StatCard label="Enriched" value={data.enrichedPapers} accent="indigo" />
              <StatCard label="Embedded" value={data.embeddedPapers} accent="purple" />
              <StatCard label="Scored" value={data.scoredPapers} accent="green" />
            </div>

            {/* Pipeline completion progress */}
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
              <p className="text-sm text-gray-400 mb-3">Pipeline Completion</p>
              <div className="space-y-3">
                <ProgressRow
                  label="Enrichment"
                  current={data.enrichedPapers}
                  total={data.totalPapers}
                  color="bg-indigo-500"
                />
                <ProgressRow
                  label="Embedding"
                  current={data.embeddedPapers}
                  total={data.totalPapers}
                  color="bg-purple-500"
                />
                <ProgressRow
                  label="Scoring"
                  current={data.scoredPapers}
                  total={data.totalPapers}
                  color="bg-green-500"
                />
              </div>
            </div>
          </>
        )}
      </section>

      {/* === RECENT PAPERS === */}
      <section>
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Recent Papers</h2>

        {data.recentPapers.length === 0 ? (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center">
            <p className="text-gray-500">No papers ingested yet</p>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-800 bg-gray-900 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 text-gray-400 font-medium">Title</th>
                  <th className="px-4 py-3 text-gray-400 font-medium whitespace-nowrap">arXiv ID</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-right">Score</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Categories</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-center">Enriched</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-center">Embedded</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-center">Scored</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Published</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {data.recentPapers.map((paper) => (
                  <tr key={paper.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-gray-200 max-w-xs" title={paper.title}>
                      {truncate(paper.title, 60)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400 whitespace-nowrap">
                      <a
                        href={`https://arxiv.org/abs/${paper.arxiv_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-indigo-400 transition-colors"
                      >
                        {paper.arxiv_id}
                      </a>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${scoreColor(paper.gravity_score)}`}>
                      {paper.gravity_score}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(paper.categories ?? []).slice(0, 3).map((cat) => (
                          <span key={cat} className="inline-block rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-400">
                            {cat}
                          </span>
                        ))}
                        {(paper.categories ?? []).length > 3 && (
                          <span className="text-xs text-gray-500">+{paper.categories.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <PipelineCheck done={paper.enriched_at !== null} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <PipelineCheck done={paper.embedded_at !== null} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <PipelineCheck done={paper.scored_at !== null} />
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {relativeTime(paper.published_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* === TOP PAPERS BY GRAVITY SCORE === */}
      <section>
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Top Papers by Gravity Score</h2>

        {data.topPapers.length === 0 ? (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center">
            <p className="text-gray-500">No scored papers yet</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {data.topPapers.map((paper, index) => (
              <div
                key={paper.id}
                className="flex items-center gap-4 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 hover:border-gray-700 transition-colors"
              >
                <span className="text-lg font-bold text-gray-600 font-mono w-8 text-right shrink-0">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-200 text-sm truncate" title={paper.title}>
                    {paper.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex flex-wrap gap-1">
                      {(paper.categories ?? []).slice(0, 3).map((cat) => (
                        <span key={cat} className="inline-block rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-500">
                          {cat}
                        </span>
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">{relativeTime(paper.published_at)}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right" title={breakdownTooltip(paper.gravity_breakdown)}>
                  <span className={`text-xl font-bold font-mono ${scoreColor(paper.gravity_score)}`}>
                    {paper.gravity_score}
                  </span>
                  <p className="text-xs text-gray-500 cursor-help">hover for breakdown</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* === CLUSTER OVERVIEW === */}
      <section>
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Cluster Overview</h2>

        {data.clusters.length === 0 ? (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center">
            <p className="text-gray-500">No clusters generated yet</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-3">
              Total clusters: <span className="font-mono text-gray-200">{data.clusters.length}</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.clusters.map((cluster) => (
                <div
                  key={cluster.id}
                  className="rounded-lg border border-gray-800 bg-gray-900 p-4 hover:border-gray-700 transition-colors"
                >
                  <h3 className="text-sm font-semibold text-gray-200 truncate" title={cluster.label}>
                    {cluster.label}
                  </h3>
                  {cluster.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{cluster.description}</p>
                  )}
                  <div className="mt-3 flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-gray-500">Papers</span>
                      <p className="font-mono text-gray-300">{cluster.paper_count}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Avg Similarity</span>
                      <p className="font-mono text-gray-300">{cluster.avg_similarity.toFixed(3)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Top Score</span>
                      <p className={`font-mono font-semibold ${scoreColor(cluster.top_gravity_score)}`}>
                        {cluster.top_gravity_score}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

// === SUB-COMPONENTS ===

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: 'indigo' | 'purple' | 'green'
}) {
  const accentClasses: Record<string, string> = {
    indigo: 'border-indigo-500/20',
    purple: 'border-purple-500/20',
    green: 'border-green-500/20',
  }
  const borderClass = accent ? accentClasses[accent] : 'border-gray-800'

  return (
    <div className={`rounded-lg border ${borderClass} bg-gray-900 p-4`}>
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-2xl font-bold font-mono text-gray-100">{value.toLocaleString()}</p>
    </div>
  )
}

function ProgressRow({
  label,
  current,
  total,
  color,
}: {
  label: string
  current: number
  total: number
  color: string
}) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="font-mono text-gray-300">
          {current.toLocaleString()} / {total.toLocaleString()}{' '}
          <span className="text-gray-500">({percentage}%)</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function PipelineCheck({ done }: { done: boolean }) {
  if (done) {
    return <span className="text-green-400 text-sm" title="Completed">&#10003;</span>
  }
  return <span className="text-gray-600 text-sm" title="Pending">&#10007;</span>
}
