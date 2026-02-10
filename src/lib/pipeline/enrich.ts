// enrich.ts — Paper enrichment pipeline
// Desc: Enriches papers with Semantic Scholar data, GitHub code repos, and AI analysis
// Deps: @/lib/db/server, @/lib/ai, ai (Vercel SDK), ./utils
// Used by: pipeline cron jobs, API route triggers
// ============================================================================

import { createServiceClient } from '@/lib/db/server'
import { generateText } from 'ai'
import { anthropic } from '@/lib/ai'
import { sleep } from './utils'
import type { Paper } from '@/types/database'

// === TYPES ===

interface SemanticScholarAuthor {
  authorId: string
  name: string
  hIndex?: number
  affiliations?: string[]
}

interface SemanticScholarPaper {
  paperId: string
  title: string
  tldr?: { text: string }
  citationCount: number
  referenceCount: number
  influentialCitationCount: number
  authors: SemanticScholarAuthor[]
  externalIds?: { ArXiv?: string }
}

interface AIEnrichmentResult {
  tldr: string
  tldr_rich: string
  key_findings: string[]
  novelty_assessment: string
  practical_applicability: string
  categories: string[]
  difficulty: string
}

// === CONSTANTS ===

const SEMANTIC_SCHOLAR_BASE = 'https://api.semanticscholar.org/graph/v1/paper'
const SEMANTIC_SCHOLAR_FIELDS = [
  'title',
  'tldr',
  'citationCount',
  'referenceCount',
  'influentialCitationCount',
  'authors',
  'authors.hIndex',
  'authors.affiliations',
  'externalIds',
].join(',')

const GITHUB_SEARCH_BASE = 'https://api.github.com/search/repositories'

const VALID_CATEGORIES = [
  'NLP',
  'Computer Vision',
  'Robotics',
  'RL',
  'Theory',
  'Infrastructure',
  'Safety',
  'Multimodal',
  'Generative',
  'Optimization',
  'Graph',
  'Audio',
  'Other',
]

const VALID_DIFFICULTIES = ['beginner', 'intermediate', 'advanced', 'expert']

// === SEMANTIC SCHOLAR ===

async function fetchSemanticScholar(arxivId: string): Promise<SemanticScholarPaper | null> {
  const url = `${SEMANTIC_SCHOLAR_BASE}/ARXIV:${arxivId}?fields=${SEMANTIC_SCHOLAR_FIELDS}`

  try {
    const response = await fetch(url)

    if (response.status === 404) {
      console.log(`[enrich] Semantic Scholar: paper not found for arxiv:${arxivId}`)
      return null
    }

    if (response.status === 429) {
      console.warn('[enrich] Semantic Scholar: rate limited, waiting 30s...')
      await sleep(30_000)
      // Retry once after waiting
      const retry = await fetch(url)
      if (!retry.ok) {
        console.error(`[enrich] Semantic Scholar: retry failed with status ${retry.status}`)
        return null
      }
      return (await retry.json()) as SemanticScholarPaper
    }

    if (!response.ok) {
      console.error(`[enrich] Semantic Scholar: unexpected status ${response.status} for arxiv:${arxivId}`)
      return null
    }

    return (await response.json()) as SemanticScholarPaper
  } catch (error) {
    console.error(`[enrich] Semantic Scholar fetch error for arxiv:${arxivId}:`, error)
    return null
  }
}

// === GITHUB CODE SEARCH ===

async function searchGitHub(title: string, arxivId: string): Promise<string | null> {
  // Build a short title query — first 5 words to avoid overly specific queries
  const shortTitle = title.split(/\s+/).slice(0, 5).join(' ')
  const query = encodeURIComponent(`${arxivId} OR ${shortTitle}`)
  const url = `${GITHUB_SEARCH_BASE}?q=${query}&sort=stars&order=desc&per_page=3`

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        // No auth header — using unauthenticated rate limit (60 req/hour)
      },
    })

    if (response.status === 403 || response.status === 429) {
      console.warn('[enrich] GitHub search: rate limited, skipping')
      return null
    }

    if (!response.ok) {
      console.warn(`[enrich] GitHub search: status ${response.status}, skipping`)
      return null
    }

    const data = (await response.json()) as {
      total_count: number
      items: { html_url: string; full_name: string; stargazers_count: number }[]
    }

    if (data.total_count === 0 || data.items.length === 0) {
      return null
    }

    // Return the top result (sorted by stars)
    const topRepo = data.items[0]
    console.log(`[enrich] GitHub: found repo ${topRepo.full_name} (${topRepo.stargazers_count} stars)`)
    return topRepo.html_url
  } catch (error) {
    // Best-effort — don't fail enrichment over GitHub search
    console.warn('[enrich] GitHub search error (non-fatal):', error)
    return null
  }
}

// === AI ENRICHMENT ===

const ENRICH_SYSTEM_PROMPT = `You are an AI research analyst specializing in machine learning and computer science papers. You produce structured, accurate analysis for busy ML engineers. Always respond with valid JSON only — no markdown, no code fences, no extra text.`

function buildEnrichUserPrompt(
  paper: Paper,
  semanticData: SemanticScholarPaper | null,
  codeUrl: string | null
): string {
  return `Analyze this research paper and generate structured analysis.

Paper Title: ${paper.title}

Paper Abstract: ${paper.abstract}

Semantic Scholar Citations: ${semanticData?.citationCount ?? 'unknown'}

Has Code Repository: ${codeUrl ? `Yes (${codeUrl})` : 'No'}

Respond in this exact JSON format:
{
  "tldr": "2-3 sentence plain language summary for busy ML engineers",
  "tldr_rich": "5-8 sentence keyword-dense summary optimized for semantic search. Include methodology names, dataset names, model architectures, key metrics, and technical terms.",
  "key_findings": ["finding 1", "finding 2", "finding 3", "finding 4", "finding 5"],
  "novelty_assessment": "What's genuinely new here vs incremental improvement? Compare to current SOTA.",
  "practical_applicability": "Can a practitioner use this today? GPU requirements? Code available? Easy to integrate?",
  "categories": ["category1", "category2"],
  "difficulty": "beginner|intermediate|advanced|expert"
}

For categories, choose from: NLP, Computer Vision, Robotics, RL, Theory, Infrastructure, Safety, Multimodal, Generative, Optimization, Graph, Audio, Other.
For difficulty, choose exactly one of: beginner, intermediate, advanced, expert.
Return ONLY the JSON object, nothing else.`
}

function validateAndCleanAIResult(raw: unknown): AIEnrichmentResult | null {
  if (!raw || typeof raw !== 'object') return null

  const data = raw as Record<string, unknown>

  // Validate required string fields
  const tldr = typeof data.tldr === 'string' ? data.tldr : null
  const tldr_rich = typeof data.tldr_rich === 'string' ? data.tldr_rich : null
  const novelty_assessment = typeof data.novelty_assessment === 'string' ? data.novelty_assessment : null
  const practical_applicability = typeof data.practical_applicability === 'string' ? data.practical_applicability : null

  if (!tldr || !tldr_rich || !novelty_assessment || !practical_applicability) {
    console.error('[enrich] AI result missing required string fields')
    return null
  }

  // Validate key_findings is array of strings
  const key_findings = Array.isArray(data.key_findings)
    ? (data.key_findings as unknown[]).filter((f): f is string => typeof f === 'string')
    : []
  if (key_findings.length === 0) {
    console.error('[enrich] AI result has no valid key_findings')
    return null
  }

  // Validate categories — filter to allowed values
  const rawCategories = Array.isArray(data.categories)
    ? (data.categories as unknown[]).filter((c): c is string => typeof c === 'string')
    : []
  const categories = rawCategories.filter((c) => VALID_CATEGORIES.includes(c))
  if (categories.length === 0) {
    // Fallback: at least assign "Other"
    categories.push('Other')
  }

  // Validate difficulty
  const rawDifficulty = typeof data.difficulty === 'string' ? data.difficulty.toLowerCase() : ''
  const difficulty = VALID_DIFFICULTIES.includes(rawDifficulty) ? rawDifficulty : 'intermediate'

  return {
    tldr,
    tldr_rich,
    key_findings,
    novelty_assessment,
    practical_applicability,
    categories,
    difficulty,
  }
}

async function enrichWithAI(
  paper: Paper,
  semanticData: SemanticScholarPaper | null,
  codeUrl: string | null
): Promise<AIEnrichmentResult | null> {
  try {
    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      system: ENRICH_SYSTEM_PROMPT,
      prompt: buildEnrichUserPrompt(paper, semanticData, codeUrl),
      maxOutputTokens: 2048,
      temperature: 0.3,
    })

    // Strip any markdown code fences the model might add despite instructions
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    const parsed: unknown = JSON.parse(cleaned)
    const validated = validateAndCleanAIResult(parsed)

    if (!validated) {
      console.error(`[enrich] AI result validation failed for paper ${paper.id}`)
      return null
    }

    return validated
  } catch (error) {
    console.error(`[enrich] AI enrichment error for paper ${paper.id}:`, error)
    return null
  }
}

// === AUTHOR UPSERT ===

async function upsertAuthors(
  supabase: ReturnType<typeof createServiceClient>,
  paperId: string,
  semanticAuthors: SemanticScholarAuthor[]
): Promise<void> {
  for (let i = 0; i < semanticAuthors.length; i++) {
    const author = semanticAuthors[i]
    if (!author.authorId || !author.name) continue

    try {
      // Upsert into authors table using semantic_scholar_id as the conflict key
      const { data: existingAuthor } = await supabase
        .from('authors')
        .select('id')
        .eq('semantic_scholar_id', author.authorId)
        .maybeSingle()

      let authorId: string

      if (existingAuthor) {
        // Update existing author with latest data
        authorId = existingAuthor.id
        await supabase
          .from('authors')
          .update({
            name: author.name,
            h_index: author.hIndex ?? null,
            affiliations: author.affiliations ?? [],
          })
          .eq('id', authorId)
      } else {
        // Insert new author
        const { data: newAuthor, error: insertError } = await supabase
          .from('authors')
          .insert({
            name: author.name,
            semantic_scholar_id: author.authorId,
            h_index: author.hIndex ?? null,
            affiliations: author.affiliations ?? [],
            paper_count: 1,
          })
          .select('id')
          .single()

        if (insertError || !newAuthor) {
          console.warn(`[enrich] Failed to insert author ${author.name}:`, insertError?.message)
          continue
        }
        authorId = newAuthor.id
      }

      // Upsert paper_authors junction — ignore conflict if the pair already exists
      const { error: junctionError } = await supabase
        .from('paper_authors')
        .upsert(
          {
            paper_id: paperId,
            author_id: authorId,
            position: i,
          },
          { onConflict: 'paper_id,author_id' }
        )

      if (junctionError) {
        console.warn(`[enrich] Failed to link author ${author.name} to paper ${paperId}:`, junctionError.message)
      }
    } catch (error) {
      console.warn(`[enrich] Error upserting author ${author.name}:`, error)
    }
  }
}

// === MAIN EXPORT ===

export async function enrichPaper(paperId: string): Promise<void> {
  const supabase = createServiceClient()

  // 1. Fetch paper from DB
  const { data: paper, error: fetchError } = await supabase
    .from('papers')
    .select('*')
    .eq('id', paperId)
    .single()

  if (fetchError || !paper) {
    console.error(`[enrich] Paper not found: ${paperId}`, fetchError?.message)
    return
  }

  // 2. Skip if already enriched
  if (paper.enriched_at) {
    console.log(`[enrich] Paper ${paperId} already enriched at ${paper.enriched_at}, skipping`)
    return
  }

  console.log(`[enrich] Enriching paper: "${paper.title}" (${paper.arxiv_id})`)

  // 3. Fetch Semantic Scholar data
  const semanticData = await fetchSemanticScholar(paper.arxiv_id)
  if (semanticData) {
    console.log(
      `[enrich] Semantic Scholar: ${semanticData.citationCount} citations, ${semanticData.authors.length} authors`
    )
  }

  // 4. Search GitHub for code (with delay to respect rate limits)
  await sleep(500)
  const codeUrl = await searchGitHub(paper.title, paper.arxiv_id)

  // 5. Run AI enrichment (with delay to space out API calls)
  await sleep(500)
  const aiResult = await enrichWithAI(paper as Paper, semanticData, codeUrl)

  // 6. Upsert author data from Semantic Scholar
  if (semanticData?.authors && semanticData.authors.length > 0) {
    await upsertAuthors(supabase, paperId, semanticData.authors)
  }

  // 7. Update paper with all enrichment data
  const now = new Date().toISOString()

  // Build the semantic scholar metadata to store alongside the paper
  const semanticMetadata = semanticData
    ? {
        semantic_scholar_id: semanticData.paperId,
        citation_count: semanticData.citationCount,
        reference_count: semanticData.referenceCount,
        influential_citation_count: semanticData.influentialCitationCount,
        semantic_scholar_tldr: semanticData.tldr?.text ?? null,
      }
    : null

  const updatePayload: Record<string, unknown> = {
    enriched_at: now,
    updated_at: now,
  }

  // Semantic Scholar fields
  if (codeUrl) {
    updatePayload.code_url = codeUrl
  }

  // AI enrichment fields
  if (aiResult) {
    updatePayload.tldr = aiResult.tldr
    updatePayload.tldr_rich = aiResult.tldr_rich
    updatePayload.key_findings = aiResult.key_findings
    updatePayload.novelty_assessment = aiResult.novelty_assessment
    updatePayload.practical_applicability = aiResult.practical_applicability
    updatePayload.categories = aiResult.categories
    updatePayload.difficulty = aiResult.difficulty
  } else if (semanticData?.tldr?.text) {
    // Fallback: use Semantic Scholar TLDR if AI enrichment failed
    updatePayload.tldr = semanticData.tldr.text
  }

  // Store citation metadata in the paper's authors field enriched from S2
  // Also store semantic scholar metadata as part of gravity_breakdown for later scoring
  if (semanticMetadata) {
    // Merge semantic metadata into gravity_breakdown so the scorer can use citation data
    const currentBreakdown = (paper.gravity_breakdown as Record<string, unknown>) ?? {}
    updatePayload.gravity_breakdown = {
      ...currentBreakdown,
      _semantic_scholar: semanticMetadata,
    }
  }

  const { error: updateError } = await supabase
    .from('papers')
    .update(updatePayload)
    .eq('id', paperId)

  if (updateError) {
    console.error(`[enrich] Failed to update paper ${paperId}:`, updateError.message)
    return
  }

  console.log(`[enrich] Successfully enriched paper: "${paper.title}"`)
}

export async function enrichBatch(limit = 20): Promise<{ enriched: number; failed: number }> {
  const supabase = createServiceClient()
  let enriched = 0
  let failed = 0

  // Fetch papers where enriched_at IS NULL, ordered by published_at DESC
  const { data: papers, error } = await supabase
    .from('papers')
    .select('id, title, arxiv_id')
    .is('enriched_at', null)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[enrich] Failed to fetch unenriched papers:', error.message)
    return { enriched, failed }
  }

  if (!papers || papers.length === 0) {
    console.log('[enrich] No papers to enrich')
    return { enriched, failed }
  }

  console.log(`[enrich] Starting batch enrichment of ${papers.length} papers`)

  // Process sequentially to respect rate limits
  for (let i = 0; i < papers.length; i++) {
    const paper = papers[i]
    console.log(`[enrich] [${i + 1}/${papers.length}] Processing: "${paper.title}"`)

    try {
      await enrichPaper(paper.id)
      enriched++
    } catch (error) {
      console.error(`[enrich] Failed to enrich paper ${paper.id}:`, error)
      failed++
    }

    // Rate limit delay between papers — 1s for Semantic Scholar's 100 req/5min limit
    if (i < papers.length - 1) {
      await sleep(1000)
    }
  }

  console.log(`[enrich] Batch complete: ${enriched} enriched, ${failed} failed`)
  return { enriched, failed }
}
