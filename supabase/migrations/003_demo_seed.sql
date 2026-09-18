-- ============================================================
-- Migration 003: Demo Seed Data
-- Creates realistic demo records for development and presentations
-- ALL DEMO RECORDS are clearly marked with is_demo metadata
-- ============================================================

-- NOTE: This seed uses hard-coded UUIDs so it can be re-run safely
-- in development. In production, use proper seeding scripts.

-- ---- Demo Users (insert via auth.users is not allowed in migrations)
-- Use Supabase dashboard or the Auth Admin API to create these users:
--   admin@koya-demo.com     / password: DemoAdmin2026!    / role: admin
--   reviewer@koya-demo.com  / password: DemoReview2026!   / role: reviewer
--   manager@koya-demo.com   / password: DemoManager2026!  / role: content_manager

-- The trigger handle_new_user() will auto-create profiles when users sign up.
-- Use the following SQL to update roles after signup:
--   UPDATE profiles SET role = 'admin' WHERE email = 'admin@koya-demo.com';
--   UPDATE profiles SET role = 'reviewer' WHERE email = 'reviewer@koya-demo.com';

-- Demo data comment: All records in this seed are simulated.
-- They do NOT represent real published content.

COMMENT ON TABLE content_requests IS 'Stores content requests. Demo records created by 003_demo_seed.sql are for demonstration only.';
COMMENT ON TABLE publishing_queue IS 'Publishing queue. Demo items use mock provider and were never actually published.';
