-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: Default organization
-- Run once after the initial schema migration.
-- The admin user is created separately via create_admin.py script.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO organizations (id, name, slug, settings)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Default Organization',
  'default',
  '{}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;
