-- ============================================================
-- Migration 001: Initial Schema
-- Koya Content Agent
-- ============================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---- Enums --------------------------------------------------

CREATE TYPE user_role AS ENUM ('content_manager', 'reviewer', 'admin');

CREATE TYPE workflow_status AS ENUM (
  'DRAFT',
  'RESEARCHING',
  'RESEARCH_COMPLETE',
  'PLANNING',
  'GENERATING',
  'EVALUATING',
  'REVISING',
  'AWAITING_REVIEW',
  'REVISION_REQUESTED',
  'APPROVED',
  'REJECTED',
  'CHANNEL_ADAPTATION',
  'READY_TO_SCHEDULE',
  'SCHEDULED',
  'PUBLISHING',
  'PUBLISHED',
  'FAILED'
);

CREATE TYPE research_status AS ENUM ('pending', 'running', 'complete', 'failed');

CREATE TYPE source_retrieval_status AS ENUM (
  'pending', 'retrieved', 'failed', 'skipped', 'paywall', 'empty', 'too_large'
);

CREATE TYPE evaluation_status AS ENUM ('PASS', 'REVISE', 'REJECT');

CREATE TYPE review_decision AS ENUM ('approved', 'revision_requested', 'rejected');

CREATE TYPE channel_type AS ENUM ('article', 'linkedin', 'x', 'newsletter');

CREATE TYPE publishing_status AS ENUM (
  'READY', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED'
);

CREATE TYPE channel_validation_status AS ENUM (
  'pending', 'valid', 'invalid', 'revision_needed'
);

CREATE TYPE draft_created_by AS ENUM ('ai', 'human', 'ai_revision');

-- ---- Profiles -----------------------------------------------

CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  full_name   TEXT,
  role        user_role NOT NULL DEFAULT 'content_manager',
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'content_manager')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ---- Content Requests ---------------------------------------

CREATE TABLE content_requests (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  content_idea            TEXT NOT NULL CHECK (LENGTH(content_idea) >= 10),
  target_audience         TEXT NOT NULL CHECK (LENGTH(target_audience) >= 5),
  primary_keyword         TEXT,
  content_goal            TEXT,
  source_url              TEXT CHECK (source_url IS NULL OR source_url ~* '^https?://'),
  supporting_material     TEXT,
  tone                    TEXT,
  additional_instructions TEXT,
  requested_channels      TEXT[] NOT NULL DEFAULT ARRAY['article'],
  status                  workflow_status NOT NULL DEFAULT 'DRAFT',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_requests_user_id ON content_requests(user_id);
CREATE INDEX idx_content_requests_status ON content_requests(status);
CREATE INDEX idx_content_requests_created_at ON content_requests(created_at DESC);

-- ---- Research Runs ------------------------------------------

CREATE TABLE research_runs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_request_id    UUID NOT NULL REFERENCES content_requests(id) ON DELETE CASCADE,
  status                research_status NOT NULL DEFAULT 'pending',
  error_message         TEXT,
  source_count          INTEGER NOT NULL DEFAULT 0,
  selected_source_count INTEGER NOT NULL DEFAULT 0,
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_research_runs_content_request_id ON research_runs(content_request_id);
CREATE INDEX idx_research_runs_status ON research_runs(status);

-- ---- Content Sources ----------------------------------------

CREATE TABLE content_sources (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  research_run_id    UUID NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
  content_request_id UUID NOT NULL REFERENCES content_requests(id) ON DELETE CASCADE,
  url                TEXT NOT NULL,
  title              TEXT,
  domain             TEXT,
  author             TEXT,
  published_at       TIMESTAMPTZ,
  retrieved_at       TIMESTAMPTZ,
  content            TEXT,
  summary            TEXT,
  relevance_score    NUMERIC(4,2) CHECK (relevance_score IS NULL OR (relevance_score >= 0 AND relevance_score <= 10)),
  selected           BOOLEAN NOT NULL DEFAULT FALSE,
  selection_reason   TEXT,
  retrieval_status   source_retrieval_status NOT NULL DEFAULT 'pending',
  content_hash       TEXT,
  word_count         INTEGER,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Prevent duplicate URLs within the same research run
  UNIQUE(research_run_id, url)
);

CREATE INDEX idx_content_sources_research_run_id ON content_sources(research_run_id);
CREATE INDEX idx_content_sources_content_request_id ON content_sources(content_request_id);
CREATE INDEX idx_content_sources_selected ON content_sources(selected) WHERE selected = TRUE;

-- ---- Content Plans ------------------------------------------

CREATE TABLE content_plans (
  id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_request_id              UUID NOT NULL REFERENCES content_requests(id) ON DELETE CASCADE,
  working_title                   TEXT NOT NULL,
  primary_keyword                 TEXT NOT NULL,
  secondary_keywords              TEXT[] NOT NULL DEFAULT '{}',
  search_intent                   TEXT NOT NULL,
  target_audience                 TEXT NOT NULL,
  content_goal                    TEXT NOT NULL,
  outline                         JSONB NOT NULL DEFAULT '[]',
  key_points                      TEXT[] NOT NULL DEFAULT '{}',
  source_mapping                  JSONB NOT NULL DEFAULT '[]',
  recommended_links               JSONB NOT NULL DEFAULT '[]',
  recommended_image_description   TEXT,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_plans_content_request_id ON content_plans(content_request_id);

-- ---- Content Drafts -----------------------------------------
-- Drafts are IMMUTABLE — never update, only insert new versions

CREATE TABLE content_drafts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_request_id  UUID NOT NULL REFERENCES content_requests(id) ON DELETE CASCADE,
  content_plan_id     UUID REFERENCES content_plans(id) ON DELETE SET NULL,
  version_number      INTEGER NOT NULL CHECK (version_number > 0),
  parent_version_id   UUID REFERENCES content_drafts(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  summary             TEXT NOT NULL,
  article             TEXT NOT NULL,
  primary_keyword     TEXT NOT NULL,
  secondary_keywords  TEXT[] NOT NULL DEFAULT '{}',
  source_ids          UUID[] NOT NULL DEFAULT '{}',
  key_claims          JSONB NOT NULL DEFAULT '[]',
  word_count          INTEGER NOT NULL DEFAULT 0,
  reading_time_minutes INTEGER NOT NULL DEFAULT 0,
  change_summary      TEXT,
  created_by          draft_created_by NOT NULL,
  created_by_user_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Enforce unique version numbers per content request
  UNIQUE(content_request_id, version_number)
);

CREATE INDEX idx_content_drafts_content_request_id ON content_drafts(content_request_id);
CREATE INDEX idx_content_drafts_version_number ON content_drafts(content_request_id, version_number DESC);

-- ---- Draft Evaluations --------------------------------------
-- Evaluations are IMMUTABLE

CREATE TABLE draft_evaluations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draft_id            UUID NOT NULL REFERENCES content_drafts(id) ON DELETE CASCADE,
  content_request_id  UUID NOT NULL REFERENCES content_requests(id) ON DELETE CASCADE,
  overall_status      evaluation_status NOT NULL,
  scores              JSONB NOT NULL,
  unsupported_claims  JSONB NOT NULL DEFAULT '[]',
  weak_sections       JSONB NOT NULL DEFAULT '[]',
  recommended_changes TEXT[] NOT NULL DEFAULT '{}',
  summary             TEXT NOT NULL,
  model               TEXT NOT NULL,
  input_tokens        INTEGER,
  output_tokens       INTEGER,
  estimated_cost_usd  NUMERIC(10,6),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_draft_evaluations_draft_id ON draft_evaluations(draft_id);
CREATE INDEX idx_draft_evaluations_content_request_id ON draft_evaluations(content_request_id);

-- ---- Draft Revisions ----------------------------------------

CREATE TABLE draft_revisions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_draft_id   UUID NOT NULL REFERENCES content_drafts(id) ON DELETE CASCADE,
  revised_draft_id    UUID NOT NULL REFERENCES content_drafts(id) ON DELETE CASCADE,
  content_request_id  UUID NOT NULL REFERENCES content_requests(id) ON DELETE CASCADE,
  revision_number     INTEGER NOT NULL CHECK (revision_number > 0),
  changes_made        TEXT[] NOT NULL DEFAULT '{}',
  revision_reason     TEXT NOT NULL,
  model               TEXT NOT NULL,
  input_tokens        INTEGER,
  output_tokens       INTEGER,
  estimated_cost_usd  NUMERIC(10,6),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_draft_revisions_content_request_id ON draft_revisions(content_request_id);

-- ---- Human Reviews ------------------------------------------
-- Reviews are IMMUTABLE

CREATE TABLE human_reviews (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_request_id    UUID NOT NULL REFERENCES content_requests(id) ON DELETE CASCADE,
  draft_id              UUID NOT NULL REFERENCES content_drafts(id) ON DELETE CASCADE,
  draft_version         INTEGER NOT NULL,
  reviewer_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  decision              review_decision NOT NULL,
  feedback              TEXT,
  revision_instructions TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_human_reviews_content_request_id ON human_reviews(content_request_id);
CREATE INDEX idx_human_reviews_reviewer_id ON human_reviews(reviewer_id);
CREATE INDEX idx_human_reviews_draft_id ON human_reviews(draft_id);

-- ---- Channel Content ----------------------------------------

CREATE TABLE channel_content (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_request_id UUID NOT NULL REFERENCES content_requests(id) ON DELETE CASCADE,
  approved_draft_id  UUID NOT NULL REFERENCES content_drafts(id) ON DELETE RESTRICT,
  channel            channel_type NOT NULL,
  title              TEXT,
  subject_line       TEXT,
  content            TEXT NOT NULL,
  hashtags           TEXT[] NOT NULL DEFAULT '{}',
  cta                TEXT,
  word_count         INTEGER NOT NULL DEFAULT 0,
  character_count    INTEGER NOT NULL DEFAULT 0,
  validation_status  channel_validation_status NOT NULL DEFAULT 'pending',
  validation_errors  JSONB NOT NULL DEFAULT '[]',
  generation_model   TEXT,
  revision_count     INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One channel per approved draft per request
  UNIQUE(content_request_id, approved_draft_id, channel)
);

CREATE INDEX idx_channel_content_content_request_id ON channel_content(content_request_id);
CREATE INDEX idx_channel_content_approved_draft_id ON channel_content(approved_draft_id);

-- ---- Publishing Queue ---------------------------------------

CREATE TABLE publishing_queue (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_request_id  UUID NOT NULL REFERENCES content_requests(id) ON DELETE RESTRICT,
  channel_content_id  UUID NOT NULL REFERENCES channel_content(id) ON DELETE RESTRICT,
  channel             channel_type NOT NULL,
  approved_draft_id   UUID NOT NULL REFERENCES content_drafts(id) ON DELETE RESTRICT,
  approved_version    INTEGER NOT NULL,
  -- Idempotency key prevents duplicate publishing
  idempotency_key     TEXT NOT NULL UNIQUE,
  status              publishing_status NOT NULL DEFAULT 'READY',
  scheduled_at        TIMESTAMPTZ,
  published_at        TIMESTAMPTZ,
  error_message       TEXT,
  retry_count         INTEGER NOT NULL DEFAULT 0,
  provider            TEXT NOT NULL DEFAULT 'mock',
  provider_post_id    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_publishing_queue_content_request_id ON publishing_queue(content_request_id);
CREATE INDEX idx_publishing_queue_status ON publishing_queue(status);
CREATE INDEX idx_publishing_queue_scheduled_at ON publishing_queue(scheduled_at) WHERE scheduled_at IS NOT NULL;

-- ---- Audit Logs ---------------------------------------------
-- Audit logs are IMMUTABLE — no updates or deletes allowed

CREATE TABLE audit_logs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_email         TEXT,
  action              TEXT NOT NULL,
  entity_type         TEXT NOT NULL,
  entity_id           UUID NOT NULL,
  content_request_id  UUID REFERENCES content_requests(id) ON DELETE SET NULL,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_content_request_id ON audit_logs(content_request_id);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ---- Workflow Runs ------------------------------------------

CREATE TABLE workflow_runs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_request_id  UUID NOT NULL REFERENCES content_requests(id) ON DELETE CASCADE,
  operation           TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'running',
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  duration_ms         INTEGER,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_runs_content_request_id ON workflow_runs(content_request_id);
CREATE INDEX idx_workflow_runs_status ON workflow_runs(status);

-- ---- Failure Events -----------------------------------------

CREATE TABLE failure_events (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_run_id     UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
  content_request_id  UUID REFERENCES content_requests(id) ON DELETE SET NULL,
  operation           TEXT NOT NULL,
  error_type          TEXT NOT NULL,
  message             TEXT NOT NULL,
  stack_trace         TEXT,
  retry_count         INTEGER NOT NULL DEFAULT 0,
  max_retries         INTEGER NOT NULL DEFAULT 3,
  is_retryable        BOOLEAN NOT NULL DEFAULT TRUE,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_failure_events_content_request_id ON failure_events(content_request_id);
CREATE INDEX idx_failure_events_error_type ON failure_events(error_type);

-- ---- AI Usage Tracking --------------------------------------

CREATE TABLE ai_usage (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_request_id  UUID REFERENCES content_requests(id) ON DELETE SET NULL,
  operation           TEXT NOT NULL,
  model               TEXT NOT NULL,
  input_tokens        INTEGER NOT NULL DEFAULT 0,
  output_tokens       INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd  NUMERIC(10,6) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_content_request_id ON ai_usage(content_request_id);
CREATE INDEX idx_ai_usage_created_at ON ai_usage(created_at DESC);

-- ---- Updated_at Trigger -------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_content_requests
  BEFORE UPDATE ON content_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_research_runs
  BEFORE UPDATE ON research_runs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_content_sources
  BEFORE UPDATE ON content_sources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_content_plans
  BEFORE UPDATE ON content_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_channel_content
  BEFORE UPDATE ON channel_content
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_publishing_queue
  BEFORE UPDATE ON publishing_queue
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
