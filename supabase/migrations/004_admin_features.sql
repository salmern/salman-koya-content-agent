-- ============================================================
-- Migration 004: Admin Features — Soft Deletes & User Management
-- ============================================================

-- ---- Soft delete for content_requests ----------------------

ALTER TABLE content_requests
  ADD COLUMN IF NOT EXISTS archived_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by    UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_content_requests_deleted_at
  ON content_requests(deleted_at) WHERE deleted_at IS NULL;

-- ---- Deactivate users (without deleting) -------------------

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- ---- RLS: hide soft-deleted content from non-admins --------

-- Drop existing policies and recreate with delete filter
DROP POLICY IF EXISTS "content_requests_select_own" ON content_requests;
DROP POLICY IF EXISTS "content_requests_select_reviewer" ON content_requests;

CREATE POLICY "content_requests_select_own"
  ON content_requests FOR SELECT
  USING (user_id = auth.uid() AND deleted_at IS NULL);

CREATE POLICY "content_requests_select_reviewer"
  ON content_requests FOR SELECT
  USING (get_current_user_role() IN ('reviewer', 'admin') AND deleted_at IS NULL);

-- Admins can see deleted content
CREATE POLICY "content_requests_select_admin_deleted"
  ON content_requests FOR SELECT
  USING (get_current_user_role() = 'admin');
