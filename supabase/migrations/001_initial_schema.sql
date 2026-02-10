-- ============================================================================
-- PaperRadar: Initial Schema Migration
-- Desc: Core tables, indexes, RLS policies, and triggers for the PaperRadar platform.
-- Deps: pgvector extension
-- Used by: Supabase backend, Next.js API routes, Trigger.dev pipeline
-- ============================================================================

-- === EXTENSIONS ===

CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";

-- === HELPER FUNCTIONS ===

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- === TABLES ===

-- Papers: core entity storing arXiv papers with AI enrichments
CREATE TABLE papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arxiv_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  authors JSONB NOT NULL DEFAULT '[]',           -- [{name, affiliation}]
  abstract TEXT NOT NULL,
  tldr TEXT,
  tldr_rich TEXT,                                 -- keyword-dense version for embedding
  key_findings JSONB DEFAULT '[]',               -- string array
  novelty_assessment TEXT,
  practical_applicability TEXT,
  categories TEXT[] NOT NULL DEFAULT '{}',        -- NLP, CV, RL, etc.
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced', 'expert')),
  gravity_score REAL DEFAULT 0,
  gravity_breakdown JSONB DEFAULT '{}',          -- {novelty, social_buzz, builder_relevance, citation_velocity, author_reputation, technical_depth}
  embedding vector(1536),
  source_url TEXT,
  pdf_url TEXT,
  code_url TEXT,                                 -- GitHub link if available
  published_at TIMESTAMPTZ NOT NULL,
  enriched_at TIMESTAMPTZ,
  embedded_at TIMESTAMPTZ,
  scored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Clusters: groups of semantically similar papers
CREATE TABLE clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  description TEXT,
  paper_count INT DEFAULT 0,
  avg_similarity REAL DEFAULT 0,
  top_gravity_score REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Junction: paper <-> cluster (many-to-many)
CREATE TABLE paper_clusters (
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  similarity_score REAL,
  PRIMARY KEY (paper_id, cluster_id)
);

-- Social signals: buzz from Reddit, HN, HuggingFace, Twitter, GitHub
CREATE TABLE social_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('reddit', 'hackernews', 'huggingface', 'twitter', 'github')),
  external_url TEXT,
  score INT DEFAULT 0,           -- upvotes / stars
  comments INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  fetched_at TIMESTAMPTZ DEFAULT now()
);

-- Authors: canonical author records with bibliometric data
CREATE TABLE authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  affiliations TEXT[] DEFAULT '{}',
  h_index INT,
  paper_count INT DEFAULT 0,
  semantic_scholar_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Junction: paper <-> author (many-to-many, ordered)
CREATE TABLE paper_authors (
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  position INT,                  -- author order in paper
  PRIMARY KEY (paper_id, author_id)
);

-- Profiles: extends Supabase auth.users with app-specific data
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  categories TEXT[] DEFAULT '{}',       -- followed categories
  digest_frequency TEXT DEFAULT 'weekly' CHECK (digest_frequency IN ('daily', 'weekly', 'none')),
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'team')),
  profile_embedding vector(1536),       -- user preference vector
  papers_read INT DEFAULT 0,
  papers_saved INT DEFAULT 0,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Saved papers: user bookmarks
CREATE TABLE saved_papers (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, paper_id)
);

-- User interactions: clickstream for personalization
CREATE TABLE user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('view', 'click', 'save', 'share', 'unsave')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pipeline runs: observability for data pipeline tasks
CREATE TABLE pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  papers_processed INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- === INDEXES ===

-- Semantic search over paper embeddings (IVFFlat, cosine distance)
CREATE INDEX idx_papers_embedding ON papers
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Timeline & ranking queries
CREATE INDEX idx_papers_published_at ON papers (published_at DESC);
CREATE INDEX idx_papers_gravity_score ON papers (gravity_score DESC);

-- Category filtering (GIN for array containment queries)
CREATE INDEX idx_papers_categories ON papers USING GIN (categories);

-- Social signal lookups per paper+source
CREATE INDEX idx_social_signals_paper_source ON social_signals (paper_id, source);

-- User activity feed
CREATE INDEX idx_user_interactions_user_created ON user_interactions (user_id, created_at DESC);

-- Semantic search over user preference vectors
CREATE INDEX idx_profiles_embedding ON profiles
  USING ivfflat (profile_embedding vector_cosine_ops) WITH (lists = 100);

-- === TRIGGERS ===

CREATE TRIGGER trg_papers_updated_at
  BEFORE UPDATE ON papers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_clusters_updated_at
  BEFORE UPDATE ON clusters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- === ROW LEVEL SECURITY ===

ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;

-- --- papers: public read, service_role write ---

CREATE POLICY "papers_public_read" ON papers
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "papers_service_write" ON papers
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- --- clusters: public read, service_role write ---

CREATE POLICY "clusters_public_read" ON clusters
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "clusters_service_write" ON clusters
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- --- paper_clusters: public read, service_role write ---

CREATE POLICY "paper_clusters_public_read" ON paper_clusters
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "paper_clusters_service_write" ON paper_clusters
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- --- social_signals: public read, service_role write ---

CREATE POLICY "social_signals_public_read" ON social_signals
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "social_signals_service_write" ON social_signals
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- --- authors: public read, service_role write ---

CREATE POLICY "authors_public_read" ON authors
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "authors_service_write" ON authors
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- --- paper_authors: public read, service_role write ---

CREATE POLICY "paper_authors_public_read" ON paper_authors
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "paper_authors_service_write" ON paper_authors
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- --- profiles: users read/update own ---

CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_service_all" ON profiles
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- --- saved_papers: users manage own ---

CREATE POLICY "saved_papers_select_own" ON saved_papers
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "saved_papers_insert_own" ON saved_papers
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_papers_delete_own" ON saved_papers
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "saved_papers_service_all" ON saved_papers
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- --- user_interactions: users manage own ---

CREATE POLICY "user_interactions_select_own" ON user_interactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_interactions_insert_own" ON user_interactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_interactions_delete_own" ON user_interactions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_interactions_service_all" ON user_interactions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- --- pipeline_runs: service_role only ---

CREATE POLICY "pipeline_runs_service_all" ON pipeline_runs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
