// arxiv-ingest.ts — Fetches papers from ArXiv's Atom API and saves them to Supabase
// Deps: rss-parser, @/lib/db/server, ./utils | Used by: Trigger.dev pipeline, API routes
// Why rss-parser: ArXiv returns Atom XML; rss-parser handles Atom natively with custom field support

import Parser from 'rss-parser'
import { createServiceClient } from '@/lib/db/server'
import { sleep, extractArxivId, chunked } from './utils'

// === CONSTANTS ===

const ARXIV_API_BASE = 'http://export.arxiv.org/api/query'
const CATEGORIES = ['cs.AI', 'cs.CL', 'cs.LG', 'cs.CV', 'cs.RO', 'stat.ML'] as const
const MAX_RESULTS_PER_CATEGORY = 50
const RATE_LIMIT_MS = 3000 // ArXiv guideline: max 1 request per 3 seconds
const UPSERT_BATCH_SIZE = 25 // Supabase upsert batch size

// === TYPES ===

type ArxivCategory = (typeof CATEGORIES)[number]

/** Shape of a parsed ArXiv Atom entry after rss-parser with custom fields */
interface ArxivParsedItem {
  id?: string
  title?: string
  summary?: string
  published?: string
  updated?: string
  link?: string
  author?: string | { name: string }
  // Custom fields extracted via rss-parser config
  'author_detail': { name: string }[]
  'arxiv:primary_category': { $: { term: string } }
  'category': { $: { term: string } }[]
  'links': { $: { href: string; type?: string; title?: string; rel?: string } }[]
}

/** Row shape for Supabase papers table insert */
interface PaperInsert {
  arxiv_id: string
  title: string
  authors: { name: string }[]
  abstract: string
  categories: string[]
  published_at: string
  source_url: string
  pdf_url: string | null
}

interface IngestResult {
  ingested: number
  skipped: number
  errors: string[]
}

// === RSS PARSER CONFIG ===

/**
 * Configure rss-parser to extract ArXiv-specific Atom fields.
 * ArXiv's Atom feed uses custom namespaces (arxiv:, opensearch:) and
 * repeating elements (multiple <author>, <link>, <category>) that
 * need explicit keepArray configuration.
 */
function createArxivParser(): Parser<Record<string, never>, ArxivParsedItem> {
  return new Parser<Record<string, never>, ArxivParsedItem>({
    customFields: {
      item: [
        ['author', { keepArray: true }],
        ['link', { keepArray: true }],
        ['category', { keepArray: true }],
        ['arxiv:primary_category', 'arxiv:primary_category'],
      ] as unknown as Parser.CustomFieldItem<ArxivParsedItem>[],
    },
    // ArXiv API can be slow; give it 30 seconds
    timeout: 30_000,
  })
}

// === ENTRY PARSING ===

/**
 * Extract author names from a parsed ArXiv entry.
 * rss-parser may return authors as strings or objects depending on the feed structure.
 */
function parseAuthors(item: ArxivParsedItem): { name: string }[] {
  // Prefer structured author_detail; fall back to raw author field
  const authorDetail = item['author_detail']
  if (Array.isArray(authorDetail) && authorDetail.length > 0) {
    return authorDetail
      .map((a) => ({ name: a.name.trim() }))
      .filter((a) => a.name.length > 0)
  }

  const rawAuthor = item.author
  if (!rawAuthor) return []

  // Single author as string
  if (typeof rawAuthor === 'string') return [{ name: rawAuthor.trim() }]

  // Single author as object
  if (typeof rawAuthor === 'object' && 'name' in rawAuthor) {
    return [{ name: String(rawAuthor.name).trim() }]
  }

  return []
}

/**
 * Extract all category codes from a parsed ArXiv entry.
 */
function parseCategories(item: ArxivParsedItem): string[] {
  const cats: string[] = []

  // Multiple <category> elements
  const categoryArray = item['category']
  if (Array.isArray(categoryArray)) {
    for (const cat of categoryArray) {
      const term = cat?.$?.term
      if (term) cats.push(term)
    }
  }

  // Primary category as fallback
  const primary = item['arxiv:primary_category']?.$?.term
  if (primary && !cats.includes(primary)) {
    cats.unshift(primary)
  }

  return cats
}

/**
 * Extract the PDF URL from an entry's links.
 * ArXiv entries have multiple <link> elements; the PDF one has title="pdf" or rel="related".
 */
function parsePdfUrl(item: ArxivParsedItem): string | null {
  const links = item['links']
  if (!Array.isArray(links)) return null

  for (const link of links) {
    const attrs = link.$
    if (!attrs?.href) continue

    // Prefer explicit PDF link
    if (attrs.title === 'pdf' || attrs.href.endsWith('.pdf')) {
      return attrs.href
    }

    // ArXiv PDF links have type="application/pdf"
    if (attrs.type === 'application/pdf') {
      return attrs.href
    }
  }

  return null
}

/**
 * Extract the abstract page URL from an entry's links (the HTML abstract page).
 */
function parseSourceUrl(item: ArxivParsedItem): string {
  const links = item['links']
  if (Array.isArray(links)) {
    for (const link of links) {
      const attrs = link.$
      if (attrs?.type === 'text/html' && attrs.href) {
        return attrs.href
      }
    }
  }

  // Fallback: the entry ID is the abstract URL
  return item.id ?? ''
}

/**
 * Transform a parsed ArXiv entry into a PaperInsert row.
 * Returns null if essential fields are missing.
 */
function entryToPaper(item: ArxivParsedItem): PaperInsert | null {
  const entryId = item.id
  if (!entryId) return null

  const arxivId = extractArxivId(entryId)
  const title = item.title?.replace(/\s+/g, ' ').trim()
  const abstract = item.summary?.replace(/\s+/g, ' ').trim()
  const publishedAt = item.published

  if (!title || !abstract || !publishedAt) return null

  return {
    arxiv_id: arxivId,
    title,
    authors: parseAuthors(item),
    abstract,
    categories: parseCategories(item),
    published_at: publishedAt,
    source_url: parseSourceUrl(item),
    pdf_url: parsePdfUrl(item),
  }
}

// === FETCH & PARSE ===

/**
 * Build the ArXiv API query URL for a given category.
 */
function buildQueryUrl(category: ArxivCategory, maxResults: number): string {
  const params = new URLSearchParams({
    search_query: `cat:${category}`,
    start: '0',
    max_results: String(maxResults),
    sortBy: 'submittedDate',
    sortOrder: 'descending',
  })
  return `${ARXIV_API_BASE}?${params.toString()}`
}

/**
 * Fetch and parse papers for a single ArXiv category.
 */
async function fetchCategory(
  parser: Parser<Record<string, never>, ArxivParsedItem>,
  category: ArxivCategory,
): Promise<PaperInsert[]> {
  const url = buildQueryUrl(category, MAX_RESULTS_PER_CATEGORY)
  console.log(`[arxiv-ingest] Fetching ${category}: ${url}`)

  const feed = await parser.parseURL(url)
  const papers: PaperInsert[] = []

  for (const item of feed.items) {
    const paper = entryToPaper(item as ArxivParsedItem)
    if (paper) {
      papers.push(paper)
    }
  }

  console.log(`[arxiv-ingest] Parsed ${papers.length} papers from ${category}`)
  return papers
}

// === DATABASE ===

/**
 * Upsert papers into Supabase, deduplicating by arxiv_id.
 * Returns the count of newly inserted rows (not updated).
 */
async function upsertPapers(
  papers: PaperInsert[],
): Promise<{ ingested: number; skipped: number }> {
  if (papers.length === 0) return { ingested: 0, skipped: 0 }

  const supabase = createServiceClient()

  // Fetch existing arxiv_ids in one query to determine new vs. existing
  const arxivIds = papers.map((p) => p.arxiv_id)
  const { data: existing, error: selectError } = await supabase
    .from('papers')
    .select('arxiv_id')
    .in('arxiv_id', arxivIds)

  if (selectError) {
    throw new Error(`Failed to check existing papers: ${selectError.message}`)
  }

  const existingIds = new Set((existing ?? []).map((row) => row.arxiv_id as string))
  const newPapers = papers.filter((p) => !existingIds.has(p.arxiv_id))
  const skipped = papers.length - newPapers.length

  if (newPapers.length === 0) {
    console.log(`[arxiv-ingest] All ${papers.length} papers already exist, skipping`)
    return { ingested: 0, skipped }
  }

  // Batch upsert to avoid hitting request size limits
  let totalIngested = 0
  const batches = chunked(newPapers, UPSERT_BATCH_SIZE)

  for (const batch of batches) {
    const { data, error: upsertError } = await supabase
      .from('papers')
      .upsert(batch, { onConflict: 'arxiv_id', ignoreDuplicates: true })
      .select('arxiv_id')

    if (upsertError) {
      throw new Error(`Failed to upsert papers batch: ${upsertError.message}`)
    }

    totalIngested += data?.length ?? batch.length
  }

  console.log(`[arxiv-ingest] Upserted ${totalIngested} new papers, skipped ${skipped} existing`)
  return { ingested: totalIngested, skipped }
}

// === MAIN LOGIC ===

/**
 * Ingest recent papers from ArXiv across multiple categories.
 *
 * Workflow:
 * 1. For each category, fetch the latest papers from ArXiv's Atom API
 * 2. Parse entries into a unified PaperInsert shape
 * 3. Deduplicate across categories (same paper can appear in multiple)
 * 4. Upsert into Supabase with conflict handling on arxiv_id
 *
 * Rate limits: 1 request per 3 seconds per ArXiv guidelines.
 */
export async function ingestFromArxiv(
  categories: readonly string[] = CATEGORIES,
): Promise<IngestResult> {
  console.log(`[arxiv-ingest] Starting ingestion for ${categories.length} categories`)
  const startTime = Date.now()

  const parser = createArxivParser()
  const allPapers = new Map<string, PaperInsert>()
  const errors: string[] = []

  for (let i = 0; i < categories.length; i++) {
    const category = categories[i] as ArxivCategory

    try {
      const papers = await fetchCategory(parser, category)

      // Deduplicate across categories — keep first occurrence
      for (const paper of papers) {
        if (!allPapers.has(paper.arxiv_id)) {
          allPapers.set(paper.arxiv_id, paper)
        } else {
          // Merge categories from duplicate entries
          const existing = allPapers.get(paper.arxiv_id)!
          const mergedCats = new Set([...existing.categories, ...paper.categories])
          existing.categories = [...mergedCats]
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[arxiv-ingest] Error fetching ${category}: ${message}`)
      errors.push(`${category}: ${message}`)
      // Continue with other categories — don't let one failure stop the pipeline
    }

    // Rate limit between requests (skip after last category)
    if (i < categories.length - 1) {
      console.log(`[arxiv-ingest] Rate limiting: waiting ${RATE_LIMIT_MS}ms`)
      await sleep(RATE_LIMIT_MS)
    }
  }

  console.log(`[arxiv-ingest] Collected ${allPapers.size} unique papers across all categories`)

  // Upsert all deduplicated papers
  let ingested = 0
  let skipped = 0

  try {
    const result = await upsertPapers([...allPapers.values()])
    ingested = result.ingested
    skipped = result.skipped
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[arxiv-ingest] Database error: ${message}`)
    errors.push(`upsert: ${message}`)
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(
    `[arxiv-ingest] Done in ${elapsed}s — ingested: ${ingested}, skipped: ${skipped}, errors: ${errors.length}`,
  )

  return { ingested, skipped, errors }
}

// === EXPORTS ===

export { CATEGORIES, MAX_RESULTS_PER_CATEGORY, RATE_LIMIT_MS }
export type { PaperInsert, IngestResult, ArxivCategory }
