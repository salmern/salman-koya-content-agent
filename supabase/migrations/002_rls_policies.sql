-- ============================================================
-- Migration 002: Row Level Security Policies
-- ============================================================

-- ---- Enable RLS on all tables ------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE human_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE publishing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE failure_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- ---- Helper function: get current user role ----------------

CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---- Profiles -----------------------------------------------

-- Users can read their own profile
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Admins can read all profiles
CREATE POLICY "profiles_select_admin"
  ON profiles FOR SELECT
  USING (get_current_user_role() = 'admin');

-- Users can update their own profile (not role)
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

-- Admins can update any profile (including role)
CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE
  USING (get_current_user_role() = 'admin');

-- ---- Content Requests ---------------------------------------

-- Content managers see only their own requests
CREATE POLICY "content_requests_select_own"
  ON content_requests FOR SELECT
  USING (user_id = auth.uid());

-- Reviewers and admins see all requests
CREATE POLICY "content_requests_select_reviewer"
  ON content_requests FOR SELECT
  USING (get_current_user_role() IN ('reviewer', 'admin'));

-- Only content managers (and admins) can create requests
CREATE POLICY "content_requests_insert"
  ON content_requests FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND get_current_user_role() IN ('content_manager', 'admin')
  );

-- Status updates allowed for owner (for AI pipeline) and admins
CREATE POLICY "content_requests_update_own"
  ON content_requests FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can update any request
CREATE POLICY "content_requests_update_admin"
  ON content_requests FOR UPDATE
  USING (get_current_user_role() = 'admin');

-- ---- Research Runs ------------------------------------------

-- Accessible if you can see the parent content request
CREATE POLICY "research_runs_select"
  ON research_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM content_requests cr
      WHERE cr.id = research_runs.content_request_id
      AND (cr.user_id = auth.uid() OR get_current_user_role() IN ('reviewer', 'admin'))
    )
  );

CREATE POLICY "research_runs_insert"
  ON research_runs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_requests cr
      WHERE cr.id = research_runs.content_request_id
      AND cr.user_id = auth.uid()
    )
  );

CREATE POLICY "research_runs_update"
  ON research_runs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM content_requests cr
      WHERE cr.id = research_runs.content_request_id
      AND cr.user_id = auth.uid()
    )
  );

-- ---- Content Sources ----------------------------------------

CREATE POLICY "content_sources_select"
  ON content_sources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM content_requests cr
      WHERE cr.id = content_sources.content_request_id
      AND (cr.user_id = auth.uid() OR get_current_user_role() IN ('reviewer', 'admin'))
    )
  );

CREATE POLICY "content_sources_insert"
  ON content_sources FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_requests cr
      WHERE cr.id = content_sources.content_request_id
      AND cr.user_id = auth.uid()
    )
  );

CREATE POLICY "content_sources_update"
  ON content_sources FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM content_requests cr
      WHERE cr.id = content_sources.content_request_id
      AND cr.user_id = auth.uid()
    )
  );

-- ---- Content Plans ------------------------------------------

CREATE POLICY "content_plans_select"
  ON content_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM content_requests cr
      WHERE cr.id = content_plans.content_request_id
      AND (cr.user_id = auth.uid() OR get_current_user_role() IN ('reviewer', 'admin'))
    )
  );

CREATE POLICY "content_plans_insert"
  ON content_plans FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_requests cr
      WHERE cr.id = content_plans.content_request_id
      AND cr.user_id = auth.uid()
    )
  );

-- ---- Content Drafts -----------------------------------------

CREATE POLICY "content_drafts_select"
  ON content_drafts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM content_requests cr
      WHERE cr.id = content_drafts.content_request_id
      AND (cr.user_id = auth.uid() OR get_current_user_role() IN ('reviewer', 'admin'))
    )
  );

CREATE POLICY "content_drafts_insert"
  ON content_drafts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_requests cr
      WHERE cr.id = content_drafts.content_request_id
      AND cr.user_id = auth.uid()
    )
    OR get_current_user_role() = 'admin'
  );

-- No UPDATE or DELETE on drafts (immutable)

-- ---- Draft Evaluations --------------------------------------

CREATE POLICY "draft_evaluations_select"
  ON draft_evaluations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM content_requests cr
      WHERE cr.id = draft_evaluations.content_request_id
      AND (cr.user_id = auth.uid() OR get_current_user_role() IN ('reviewer', 'admin'))
    )
  );

CREATE POLICY "draft_evaluations_insert"
  ON draft_evaluations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_requests cr
      WHERE cr.id = draft_evaluations.content_request_id
      AND cr.user_id = auth.uid()
    )
  );

-- ---- Draft Revisions ----------------------------------------

CREATE POLICY "draft_revisions_select"
  ON draft_revisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM content_requests cr
      WHERE cr.id = draft_revisions.content_request_id
      AND (cr.user_id = auth.uid() OR get_current_user_role() IN ('reviewer', 'admin'))
    )
  );

CREATE POLICY "draft_revisions_insert"
  ON draft_revisions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_requests cr
      WHERE cr.id = draft_revisions.content_request_id
      AND cr.user_id = auth.uid()
    )
  );

-- ---- Human Reviews ------------------------------------------

-- Reviewers can see reviews they need to do; content managers see reviews of their work
CREATE POLICY "human_reviews_select"
  ON human_reviews FOR SELECT
  USING (
    reviewer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM content_requests cr
      WHERE cr.id = human_reviews.content_request_id
      AND (cr.user_id = auth.uid() OR get_current_user_role() = 'admin')
    )
  );

-- Only reviewers and admins can insert reviews
CREATE POLICY "human_reviews_insert"
  ON human_reviews FOR INSERT
  WITH CHECK (
    reviewer_id = auth.uid()
    AND get_current_user_role() IN ('reviewer', 'admin')
  );

-- ---- Channel Content ----------------------------------------

CREATE POLICY "channel_content_select"
  ON channel_content FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM content_requests cr
      WHERE cr.id = channel_content.content_request_id
      AND (cr.user_id = auth.uid() OR get_current_user_role() IN ('reviewer', 'admin'))
    )
  );

CREATE POLICY "channel_content_insert"
  ON channel_content FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_requests cr
      WHERE cr.id = channel_content.content_request_id
      AND cr.user_id = auth.uid()
    )
  );

CREATE POLICY "channel_content_update"
  ON channel_content FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM content_requests cr
      WHERE cr.id = channel_content.content_request_id
      AND cr.user_id = auth.uid()
    )
  );

-- ---- Publishing Queue ---------------------------------------

CREATE POLICY "publishing_queue_select"
  ON publishing_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM content_requests cr
      WHERE cr.id = publishing_queue.content_request_id
      AND (cr.user_id = auth.uid() OR get_current_user_role() IN ('reviewer', 'admin'))
    )
  );

CREATE POLICY "publishing_queue_insert"
  ON publishing_queue FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_requests cr
      WHERE cr.id = publishing_queue.content_request_id
      AND cr.user_id = auth.uid()
    )
  );

CREATE POLICY "publishing_queue_update"
  ON publishing_queue FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM content_requests cr
      WHERE cr.id = publishing_queue.content_request_id
      AND cr.user_id = auth.uid()
    )
    OR get_current_user_role() = 'admin'
  );

-- ---- Audit Logs ---------------------------------------------
-- Read-only for relevant parties; insert allowed for authenticated users (server will use service role)
-- No updates or deletes

CREATE POLICY "audit_logs_select_own"
  ON audit_logs FOR SELECT
  USING (
    actor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM content_requests cr
      WHERE cr.id = audit_logs.content_request_id
      AND cr.user_id = auth.uid()
    )
  );

CREATE POLICY "audit_logs_select_admin"
  ON audit_logs FOR SELECT
  USING (get_current_user_role() = 'admin');

-- Only server-side (service role) should insert; this allows authenticated inserts as fallback
CREATE POLICY "audit_logs_insert"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---- Workflow Runs ------------------------------------------

CREATE POLICY "workflow_runs_select"
  ON workflow_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM content_requests cr
      WHERE cr.id = workflow_runs.content_request_id
      AND (cr.user_id = auth.uid() OR get_current_user_role() IN ('reviewer', 'admin'))
    )
  );

CREATE POLICY "workflow_runs_insert"
  ON workflow_runs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "workflow_runs_update"
  ON workflow_runs FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- ---- Failure Events -----------------------------------------

CREATE POLICY "failure_events_select"
  ON failure_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM content_requests cr
      WHERE cr.id = failure_events.content_request_id
      AND (cr.user_id = auth.uid() OR get_current_user_role() IN ('reviewer', 'admin'))
    )
    OR get_current_user_role() = 'admin'
  );

CREATE POLICY "failure_events_insert"
  ON failure_events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---- AI Usage -----------------------------------------------

CREATE POLICY "ai_usage_select"
  ON ai_usage FOR SELECT
  USING (get_current_user_role() = 'admin');

CREATE POLICY "ai_usage_insert"
  ON ai_usage FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
