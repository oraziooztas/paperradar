// utils.ts — Shared utilities for the data pipeline
// Deps: none | Used by: arxiv-ingest.ts, future pipeline modules

// === HELPERS ===

/**
 * Async sleep for rate limiting between API calls.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Extract a clean ArXiv ID (without version suffix) from a full ArXiv URL.
 * "http://arxiv.org/abs/2401.12345v1" -> "2401.12345"
 * Also handles older format: "http://arxiv.org/abs/hep-th/9901001v1" -> "hep-th/9901001"
 */
export function extractArxivId(url: string): string {
  // New format: YYMM.NNNNN
  const newFormat = url.match(/abs\/(\d{4}\.\d{4,5})/)
  if (newFormat) return newFormat[1]

  // Old format: archive[.subject-class]/NNNNNNN
  // The subject class can contain a dot (e.g. "cs.CL", "cond-mat.stat-mech"),
  // so allow '.' in the pre-slash segment — otherwise those ids fall through
  // to the fallback and get stored as the full URL.
  const oldFormat = url.match(/abs\/([\w.-]+\/\d+)/)
  if (oldFormat) return oldFormat[1]

  // Fallback: return the URL as-is (should not happen in practice)
  return url
}

/**
 * Split an array into chunks of a given size.
 * Useful for batched database inserts.
 */
export function chunked<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}
