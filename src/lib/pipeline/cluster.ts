// cluster.ts — Cluster papers by embedding similarity using pgvector
// Deps: @/lib/db/server | Used by: pipeline orchestrator, API routes
// Groups semantically similar papers into clusters via cosine similarity

import { createServiceClient } from '@/lib/db/server'

// === CONSTANTS ===

const SIMILARITY_THRESHOLD = 0.85
const MAX_MATCHES = 20
const MIN_CLUSTER_SIZE = 2

// === TYPES ===

interface MatchedPaper {
  id: string
  title: string
  arxiv_id: string
  similarity: number
}

// === SINGLE PAPER CLUSTERING ===

/**
 * Find similar papers and assign this paper to an existing or new cluster.
 * Uses Supabase RPC `match_papers` which leverages pgvector cosine similarity.
 *
 * Strategy:
 * 1. Find papers above SIMILARITY_THRESHOLD
 * 2. If any are already clustered, join the largest existing cluster
 * 3. If none are clustered but >= MIN_CLUSTER_SIZE matches, create a new cluster
 * 4. Update cluster metadata after assignment
 */
export async function clusterPaper(paperId: string): Promise<void> {
  const supabase = createServiceClient()

  // Fetch the paper and its embedding
  const { data: paper, error: fetchError } = await supabase
    .from('papers')
    .select('id, title, categories, embedding')
    .eq('id', paperId)
    .single()

  if (fetchError || !paper) {
    console.error(`[cluster] Failed to fetch paper ${paperId}:`, fetchError?.message)
    return
  }

  if (!paper.embedding) {
    console.log(`[cluster] Paper "${paper.title}" has no embedding, skipping`)
    return
  }

  // Check if this paper is already in a cluster
  const { data: existingMembership } = await supabase
    .from('paper_clusters')
    .select('cluster_id')
    .eq('paper_id', paperId)
    .limit(1)

  if (existingMembership && existingMembership.length > 0) {
    console.log(`[cluster] Paper "${paper.title}" already in a cluster, skipping`)
    return
  }

  // Find similar papers using pgvector RPC
  const { data: matches, error: rpcError } = await supabase.rpc('match_papers', {
    query_embedding: JSON.stringify(paper.embedding),
    match_threshold: SIMILARITY_THRESHOLD,
    match_count: MAX_MATCHES,
    exclude_id: paperId,
  })

  if (rpcError) {
    console.error(`[cluster] RPC match_papers failed for "${paper.title}":`, rpcError.message)
    return
  }

  const similarPapers: MatchedPaper[] = matches ?? []

  if (similarPapers.length === 0) {
    console.log(`[cluster] No similar papers found for "${paper.title}"`)
    return
  }

  console.log(
    `[cluster] Found ${similarPapers.length} similar papers for "${paper.title}"`
  )

  // Check which similar papers already belong to a cluster
  const similarIds = similarPapers.map((p) => p.id)
  const { data: existingClusters } = await supabase
    .from('paper_clusters')
    .select('paper_id, cluster_id')
    .in('paper_id', similarIds)

  if (existingClusters && existingClusters.length > 0) {
    // Find the largest existing cluster among similar papers
    const clusterCounts = new Map<string, number>()
    for (const pc of existingClusters) {
      clusterCounts.set(pc.cluster_id, (clusterCounts.get(pc.cluster_id) ?? 0) + 1)
    }

    let bestClusterId = ''
    let bestCount = 0
    for (const [clusterId, count] of clusterCounts) {
      if (count > bestCount) {
        bestClusterId = clusterId
        bestCount = count
      }
    }

    // Calculate this paper's avg similarity to papers in the chosen cluster
    const clusterPaperIds = new Set(
      existingClusters
        .filter((pc) => pc.cluster_id === bestClusterId)
        .map((pc) => pc.paper_id)
    )
    const relevantMatches = similarPapers.filter((p) => clusterPaperIds.has(p.id))
    const avgSimilarity =
      relevantMatches.length > 0
        ? relevantMatches.reduce((sum, p) => sum + p.similarity, 0) / relevantMatches.length
        : similarPapers[0].similarity

    // Add paper to the existing cluster
    const { error: insertError } = await supabase.from('paper_clusters').insert({
      paper_id: paperId,
      cluster_id: bestClusterId,
      similarity_score: avgSimilarity,
    })

    if (insertError) {
      console.error(
        `[cluster] Failed to add paper to cluster ${bestClusterId}:`,
        insertError.message
      )
      return
    }

    console.log(
      `[cluster] Added "${paper.title}" to existing cluster ${bestClusterId} (similarity: ${avgSimilarity.toFixed(3)})`
    )

    // Update cluster metadata
    await refreshClusterStats(bestClusterId)
  } else if (similarPapers.length >= MIN_CLUSTER_SIZE - 1) {
    // No clustered matches, but enough similar papers to form a new cluster
    // (MIN_CLUSTER_SIZE - 1 because this paper will also be in the cluster)

    // Generate a label from the paper titles and categories
    const allTitles = [paper.title, ...similarPapers.map((p) => p.title)]
    const label = generateClusterLabel(allTitles, paper.categories ?? [])

    // Calculate average similarity across all pairs
    const avgSimilarity =
      similarPapers.reduce((sum, p) => sum + p.similarity, 0) / similarPapers.length

    // Create the cluster
    const { data: newCluster, error: clusterError } = await supabase
      .from('clusters')
      .insert({
        label,
        description: `Auto-generated cluster of ${similarPapers.length + 1} related papers`,
        paper_count: similarPapers.length + 1,
        avg_similarity: avgSimilarity,
        top_gravity_score: 0, // will be updated by refreshClusterStats
      })
      .select('id')
      .single()

    if (clusterError || !newCluster) {
      console.error('[cluster] Failed to create new cluster:', clusterError?.message)
      return
    }

    // Add this paper and all similar papers to the new cluster
    const memberships = [
      { paper_id: paperId, cluster_id: newCluster.id, similarity_score: 1.0 },
      ...similarPapers.map((p) => ({
        paper_id: p.id,
        cluster_id: newCluster.id,
        similarity_score: p.similarity,
      })),
    ]

    const { error: membershipError } = await supabase
      .from('paper_clusters')
      .upsert(memberships, { onConflict: 'paper_id,cluster_id' })

    if (membershipError) {
      console.error(
        '[cluster] Failed to add papers to new cluster:',
        membershipError.message
      )
      return
    }

    console.log(
      `[cluster] Created new cluster "${label}" with ${memberships.length} papers (avg similarity: ${avgSimilarity.toFixed(3)})`
    )

    // Update cluster stats (mainly top_gravity_score)
    await refreshClusterStats(newCluster.id)
  } else {
    console.log(
      `[cluster] Not enough similar papers for "${paper.title}" to form a cluster (found ${similarPapers.length}, need ${MIN_CLUSTER_SIZE - 1})`
    )
  }
}

// === BATCH CLUSTERING ===

/**
 * Cluster all embedded papers that are not yet in any cluster.
 * Also cleans up empty clusters and refreshes stats.
 */
export async function updateClusters(): Promise<{ updated: number; created: number }> {
  const supabase = createServiceClient()
  let updated = 0
  let created = 0

  // Find papers with embeddings but not in any cluster.
  // Left-join paper_clusters and filter where cluster_id is null.
  const { data: unclusteredPapers, error: fetchError } = await supabase
    .from('papers')
    .select('id, title')
    .not('embedding', 'is', null)
    .not('embedded_at', 'is', null)

  if (fetchError) {
    console.error('[cluster] Failed to fetch unclustered papers:', fetchError.message)
    return { updated, created }
  }

  if (!unclusteredPapers || unclusteredPapers.length === 0) {
    console.log('[cluster] No embedded papers found')
    return { updated, created }
  }

  // Filter to only papers not in any cluster
  const paperIds = unclusteredPapers.map((p) => p.id)
  const { data: clusteredPapers } = await supabase
    .from('paper_clusters')
    .select('paper_id')
    .in('paper_id', paperIds)

  const clusteredIds = new Set((clusteredPapers ?? []).map((pc) => pc.paper_id))
  const papersToCluster = unclusteredPapers.filter((p) => !clusteredIds.has(p.id))

  if (papersToCluster.length === 0) {
    console.log('[cluster] All embedded papers are already clustered')
    return { updated, created }
  }

  console.log(`[cluster] Found ${papersToCluster.length} papers to cluster`)

  // Track clusters that existed before this run
  const { data: existingClusters } = await supabase.from('clusters').select('id')
  const preExistingClusterIds = new Set((existingClusters ?? []).map((c) => c.id))

  // Cluster each paper
  for (let i = 0; i < papersToCluster.length; i++) {
    const paper = papersToCluster[i]
    console.log(
      `[cluster] Processing ${i + 1}/${papersToCluster.length}: "${paper.title}"`
    )

    try {
      await clusterPaper(paper.id)

      // Check if this paper ended up in a cluster
      const { data: membership } = await supabase
        .from('paper_clusters')
        .select('cluster_id')
        .eq('paper_id', paper.id)
        .limit(1)

      if (membership && membership.length > 0) {
        const clusterId = membership[0].cluster_id
        if (preExistingClusterIds.has(clusterId)) {
          updated++
        } else {
          created++
          // Add to tracked set so subsequent papers joining this cluster count as updates
          preExistingClusterIds.add(clusterId)
        }
      }
    } catch (err) {
      console.error(`[cluster] Failed to cluster paper "${paper.title}":`, err)
    }
  }

  // Clean up empty clusters (paper_count = 0 or no memberships)
  const { data: allClusters } = await supabase.from('clusters').select('id')
  if (allClusters) {
    for (const cluster of allClusters) {
      const { count } = await supabase
        .from('paper_clusters')
        .select('*', { count: 'exact', head: true })
        .eq('cluster_id', cluster.id)

      if (count === 0) {
        await supabase.from('clusters').delete().eq('id', cluster.id)
        console.log(`[cluster] Deleted empty cluster ${cluster.id}`)
      }
    }
  }

  console.log(
    `[cluster] Done. Updated: ${updated} clusters, Created: ${created} new clusters`
  )
  return { updated, created }
}

// === CLUSTER STATS ===

/**
 * Recalculate a cluster's metadata from its member papers.
 * Updates paper_count, avg_similarity, and top_gravity_score.
 */
async function refreshClusterStats(clusterId: string): Promise<void> {
  const supabase = createServiceClient()

  // Get all memberships for this cluster
  const { data: memberships } = await supabase
    .from('paper_clusters')
    .select('paper_id, similarity_score')
    .eq('cluster_id', clusterId)

  if (!memberships || memberships.length === 0) {
    return
  }

  // Calculate average similarity
  const scores = memberships
    .map((m) => m.similarity_score)
    .filter((s): s is number => s !== null)
  const avgSimilarity =
    scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0

  // Get top gravity score among member papers
  const paperIds = memberships.map((m) => m.paper_id)
  const { data: papers } = await supabase
    .from('papers')
    .select('gravity_score')
    .in('id', paperIds)
    .order('gravity_score', { ascending: false })
    .limit(1)

  const topGravityScore = papers?.[0]?.gravity_score ?? 0

  // Update cluster
  const { error: updateError } = await supabase
    .from('clusters')
    .update({
      paper_count: memberships.length,
      avg_similarity: avgSimilarity,
      top_gravity_score: topGravityScore,
    })
    .eq('id', clusterId)

  if (updateError) {
    console.error(
      `[cluster] Failed to refresh stats for cluster ${clusterId}:`,
      updateError.message
    )
  }
}

// === LABEL GENERATION ===

/**
 * Generate a human-readable cluster label from paper titles and categories.
 * Extracts the most common meaningful words from titles, combined with categories.
 */
function generateClusterLabel(titles: string[], categories: string[]): string {
  // If we have categories, use the most common one as the base
  if (categories.length > 0) {
    const categoryLabel = categories[0]

    // Extract common keywords from titles for specificity
    const keywords = extractCommonKeywords(titles)
    if (keywords.length > 0) {
      return `${categoryLabel}: ${keywords.slice(0, 3).join(', ')}`
    }

    return categoryLabel
  }

  // Fallback: use common keywords from titles
  const keywords = extractCommonKeywords(titles)
  if (keywords.length > 0) {
    return keywords.slice(0, 4).join(', ')
  }

  return `Cluster (${titles.length} papers)`
}

/**
 * Extract the most frequently occurring meaningful words across multiple titles.
 * Filters out stop words and very short words.
 */
function extractCommonKeywords(titles: string[]): string[] {
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'can', 'shall', 'not', 'no', 'nor',
    'as', 'if', 'than', 'that', 'this', 'it', 'its', 'we', 'our', 'their',
    'via', 'using', 'based', 'towards', 'toward', 'into', 'through',
    'about', 'between', 'over', 'under', 'up', 'down', 'out', 'new',
    'approach', 'method', 'methods', 'model', 'models', 'paper', 'study',
  ])

  const wordCounts = new Map<string, number>()

  for (const title of titles) {
    // Split on non-alphanumeric, lowercase, and filter
    const words = title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !stopWords.has(w))

    // Count unique words per title (avoid title with repeated word inflating count)
    const uniqueWords = new Set(words)
    for (const word of uniqueWords) {
      wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1)
    }
  }

  // Return words that appear in at least 2 titles, sorted by frequency
  return Array.from(wordCounts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
}
