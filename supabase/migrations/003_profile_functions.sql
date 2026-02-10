-- ============================================================================
-- PaperRadar: Profile & Feed Functions
-- Desc: SQL functions for profile counter management and personalized feed generation.
-- Deps: pgvector extension (installed in 001_initial_schema.sql)
-- Used by: API routes (save/unsave, interact), feed system
-- ============================================================================

-- === increment_profile_counter ===
-- Safely increment a named counter on a user profile.
-- Called by: supabase.rpc('increment_profile_counter', { p_user_id, p_counter_name })

CREATE OR REPLACE FUNCTION increment_profile_counter(
  p_user_id uuid,
  p_counter_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_counter_name = 'papers_saved' THEN
    UPDATE profiles SET papers_saved = papers_saved + 1 WHERE id = p_user_id;
  ELSIF p_counter_name = 'papers_read' THEN
    UPDATE profiles SET papers_read = papers_read + 1 WHERE id = p_user_id;
  ELSE
    RAISE EXCEPTION 'Unknown counter: %', p_counter_name;
  END IF;
END;
$$;

-- === decrement_profile_counter ===
-- Safely decrement a named counter (floor at 0) on a user profile.
-- Called by: supabase.rpc('decrement_profile_counter', { p_user_id, p_counter_name })

CREATE OR REPLACE FUNCTION decrement_profile_counter(
  p_user_id uuid,
  p_counter_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_counter_name = 'papers_saved' THEN
    UPDATE profiles SET papers_saved = GREATEST(papers_saved - 1, 0) WHERE id = p_user_id;
  ELSIF p_counter_name = 'papers_read' THEN
    UPDATE profiles SET papers_read = GREATEST(papers_read - 1, 0) WHERE id = p_user_id;
  ELSE
    RAISE EXCEPTION 'Unknown counter: %', p_counter_name;
  END IF;
END;
$$;

-- === get_personalized_feed ===
-- Find papers ranked by personalization_score = (gravity_score / 100) * cosine_similarity.
-- Combines quality (gravity) with relevance (embedding similarity) for recommendations.
-- Called by: personalized feed system via supabase.rpc('get_personalized_feed', {...})

CREATE OR REPLACE FUNCTION get_personalized_feed(
  p_user_embedding vector(1536),
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0,
  p_min_gravity float DEFAULT 0,
  p_categories text[] DEFAULT NULL,
  p_since timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  tldr text,
  categories text[],
  difficulty text,
  gravity_score real,
  gravity_breakdown jsonb,
  published_at timestamptz,
  authors jsonb,
  arxiv_id text,
  code_url text,
  personalization_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.title,
    p.tldr,
    p.categories,
    p.difficulty,
    p.gravity_score,
    p.gravity_breakdown,
    p.published_at,
    p.authors,
    p.arxiv_id,
    p.code_url,
    -- personalization_score: gravity quality * cosine similarity
    -- gravity_score is 0-100, normalize to 0-1 then multiply by similarity (0-1)
    (p.gravity_score::float / 100.0 * (1 - (p.embedding <=> p_user_embedding))::float) AS personalization_score
  FROM papers p
  WHERE p.embedding IS NOT NULL
    AND p.enriched_at IS NOT NULL
    AND p.gravity_score >= p_min_gravity
    AND (p_categories IS NULL OR p.categories && p_categories)
    AND (p_since IS NULL OR p.published_at >= p_since)
  ORDER BY personalization_score DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
