-- ============================================================================
-- PaperRadar: Vector Similarity Functions
-- Desc: RPC functions for pgvector-based semantic search and paper matching.
-- Deps: pgvector extension (installed in 001_initial_schema.sql)
-- Used by: cluster.ts, future recommendation engine
-- ============================================================================

-- === match_papers ===
-- Find papers similar to a given embedding using cosine distance.
-- Called by: supabase.rpc('match_papers', { query_embedding, match_threshold, match_count, exclude_id })

CREATE OR REPLACE FUNCTION match_papers(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  exclude_id uuid
)
RETURNS TABLE (
  id uuid,
  title text,
  arxiv_id text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    papers.id,
    papers.title,
    papers.arxiv_id,
    (1 - (papers.embedding <=> query_embedding))::float AS similarity
  FROM papers
  WHERE papers.id != exclude_id
    AND papers.embedding IS NOT NULL
    AND (1 - (papers.embedding <=> query_embedding)) > match_threshold
  ORDER BY papers.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- === match_papers_for_user ===
-- Find papers similar to a user's preference embedding for personalized recommendations.
-- Called by: future recommendation API

CREATE OR REPLACE FUNCTION match_papers_for_user(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  title text,
  arxiv_id text,
  gravity_score real,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    papers.id,
    papers.title,
    papers.arxiv_id,
    papers.gravity_score,
    (1 - (papers.embedding <=> query_embedding))::float AS similarity
  FROM papers
  WHERE papers.embedding IS NOT NULL
    AND (1 - (papers.embedding <=> query_embedding)) > match_threshold
  ORDER BY papers.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
