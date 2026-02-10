// ============================================================================
// PaperRadar: Database Types
// Desc: TypeScript interfaces mirroring the Supabase/PostgreSQL schema.
// Deps: none (pure types)
// Used by: API routes, lib/supabase, components, pipeline tasks
// ============================================================================

// === DOMAIN VALUE TYPES ===

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert'
export type SocialSource = 'reddit' | 'hackernews' | 'huggingface' | 'twitter' | 'github'
export type InteractionType = 'view' | 'click' | 'save' | 'share' | 'unsave'
export type DigestFrequency = 'daily' | 'weekly' | 'none'
export type UserTier = 'free' | 'pro' | 'team'
export type PipelineStatus = 'running' | 'completed' | 'failed'

// === JSONB SUB-TYPES ===

export interface AuthorEntry {
  name: string
  affiliation?: string
}

export interface GravityBreakdown {
  novelty?: number
  social_buzz?: number
  builder_relevance?: number
  citation_velocity?: number
  author_reputation?: number
  technical_depth?: number
}

// === PAPERS ===

export interface Paper {
  id: string
  arxiv_id: string
  title: string
  authors: AuthorEntry[]
  abstract: string
  tldr: string | null
  tldr_rich: string | null
  key_findings: string[]
  novelty_assessment: string | null
  practical_applicability: string | null
  categories: string[]
  difficulty: Difficulty | null
  gravity_score: number
  gravity_breakdown: GravityBreakdown
  embedding: number[] | null
  source_url: string | null
  pdf_url: string | null
  code_url: string | null
  published_at: string
  enriched_at: string | null
  embedded_at: string | null
  scored_at: string | null
  created_at: string
  updated_at: string
}

export interface PaperInsert {
  arxiv_id: string
  title: string
  abstract: string
  published_at: string
  authors?: AuthorEntry[]
  tldr?: string | null
  tldr_rich?: string | null
  key_findings?: string[]
  novelty_assessment?: string | null
  practical_applicability?: string | null
  categories?: string[]
  difficulty?: Difficulty | null
  gravity_score?: number
  gravity_breakdown?: GravityBreakdown
  embedding?: number[] | null
  source_url?: string | null
  pdf_url?: string | null
  code_url?: string | null
  enriched_at?: string | null
  embedded_at?: string | null
  scored_at?: string | null
}

export interface PaperUpdate {
  arxiv_id?: string
  title?: string
  authors?: AuthorEntry[]
  abstract?: string
  tldr?: string | null
  tldr_rich?: string | null
  key_findings?: string[]
  novelty_assessment?: string | null
  practical_applicability?: string | null
  categories?: string[]
  difficulty?: Difficulty | null
  gravity_score?: number
  gravity_breakdown?: GravityBreakdown
  embedding?: number[] | null
  source_url?: string | null
  pdf_url?: string | null
  code_url?: string | null
  published_at?: string
  enriched_at?: string | null
  embedded_at?: string | null
  scored_at?: string | null
}

// === CLUSTERS ===

export interface Cluster {
  id: string
  label: string
  description: string | null
  paper_count: number
  avg_similarity: number
  top_gravity_score: number
  created_at: string
  updated_at: string
}

export interface ClusterInsert {
  label: string
  description?: string | null
  paper_count?: number
  avg_similarity?: number
  top_gravity_score?: number
}

export interface ClusterUpdate {
  label?: string
  description?: string | null
  paper_count?: number
  avg_similarity?: number
  top_gravity_score?: number
}

// === PAPER_CLUSTERS ===

export interface PaperCluster {
  paper_id: string
  cluster_id: string
  similarity_score: number | null
}

export interface PaperClusterInsert {
  paper_id: string
  cluster_id: string
  similarity_score?: number | null
}

// === SOCIAL SIGNALS ===

export interface SocialSignal {
  id: string
  paper_id: string
  source: SocialSource
  external_url: string | null
  score: number
  comments: number
  metadata: Record<string, unknown>
  fetched_at: string
}

export interface SocialSignalInsert {
  paper_id: string
  source: SocialSource
  external_url?: string | null
  score?: number
  comments?: number
  metadata?: Record<string, unknown>
}

export interface SocialSignalUpdate {
  source?: SocialSource
  external_url?: string | null
  score?: number
  comments?: number
  metadata?: Record<string, unknown>
  fetched_at?: string
}

// === AUTHORS ===

export interface Author {
  id: string
  name: string
  affiliations: string[]
  h_index: number | null
  paper_count: number
  semantic_scholar_id: string | null
  created_at: string
}

export interface AuthorInsert {
  name: string
  affiliations?: string[]
  h_index?: number | null
  paper_count?: number
  semantic_scholar_id?: string | null
}

export interface AuthorUpdate {
  name?: string
  affiliations?: string[]
  h_index?: number | null
  paper_count?: number
  semantic_scholar_id?: string | null
}

// === PAPER_AUTHORS ===

export interface PaperAuthor {
  paper_id: string
  author_id: string
  position: number | null
}

export interface PaperAuthorInsert {
  paper_id: string
  author_id: string
  position?: number | null
}

// === PROFILES ===

export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  categories: string[]
  digest_frequency: DigestFrequency
  tier: UserTier
  profile_embedding: number[] | null
  papers_read: number
  papers_saved: number
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created_at: string
  updated_at: string
}

export interface ProfileInsert {
  id: string  // must match auth.users.id
  display_name?: string | null
  avatar_url?: string | null
  categories?: string[]
  digest_frequency?: DigestFrequency
  tier?: UserTier
  profile_embedding?: number[] | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
}

export interface ProfileUpdate {
  display_name?: string | null
  avatar_url?: string | null
  categories?: string[]
  digest_frequency?: DigestFrequency
  tier?: UserTier
  profile_embedding?: number[] | null
  papers_read?: number
  papers_saved?: number
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
}

// === SAVED PAPERS ===

export interface SavedPaper {
  user_id: string
  paper_id: string
  saved_at: string
}

export interface SavedPaperInsert {
  user_id: string
  paper_id: string
}

// === USER INTERACTIONS ===

export interface UserInteraction {
  id: string
  user_id: string
  paper_id: string
  interaction_type: InteractionType
  created_at: string
}

export interface UserInteractionInsert {
  user_id: string
  paper_id: string
  interaction_type: InteractionType
}

// === PIPELINE RUNS ===

export interface PipelineRun {
  id: string
  task_name: string
  status: PipelineStatus
  papers_processed: number
  error_message: string | null
  started_at: string
  completed_at: string | null
}

export interface PipelineRunInsert {
  task_name: string
  status: PipelineStatus
  papers_processed?: number
  error_message?: string | null
}

export interface PipelineRunUpdate {
  status?: PipelineStatus
  papers_processed?: number
  error_message?: string | null
  completed_at?: string | null
}

// === DATABASE TYPE (Supabase-style) ===

export interface Database {
  public: {
    Tables: {
      papers: {
        Row: Paper
        Insert: PaperInsert
        Update: PaperUpdate
      }
      clusters: {
        Row: Cluster
        Insert: ClusterInsert
        Update: ClusterUpdate
      }
      paper_clusters: {
        Row: PaperCluster
        Insert: PaperClusterInsert
        Update: Partial<PaperClusterInsert>
      }
      social_signals: {
        Row: SocialSignal
        Insert: SocialSignalInsert
        Update: SocialSignalUpdate
      }
      authors: {
        Row: Author
        Insert: AuthorInsert
        Update: AuthorUpdate
      }
      paper_authors: {
        Row: PaperAuthor
        Insert: PaperAuthorInsert
        Update: Partial<PaperAuthorInsert>
      }
      profiles: {
        Row: Profile
        Insert: ProfileInsert
        Update: ProfileUpdate
      }
      saved_papers: {
        Row: SavedPaper
        Insert: SavedPaperInsert
        Update: Partial<SavedPaperInsert>
      }
      user_interactions: {
        Row: UserInteraction
        Insert: UserInteractionInsert
        Update: Partial<UserInteractionInsert>
      }
      pipeline_runs: {
        Row: PipelineRun
        Insert: PipelineRunInsert
        Update: PipelineRunUpdate
      }
    }
  }
}

// === UTILITY TYPES ===

/** Extract the Row type for a given table name */
export type TableRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

/** Extract the Insert type for a given table name */
export type TableInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

/** Extract the Update type for a given table name */
export type TableUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
