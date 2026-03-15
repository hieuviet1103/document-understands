-- ─────────────────────────────────────────────────────────────────────────────
-- Webhooks: add template_id (optional), ensure updated_at exists
-- template_id: when set, webhook only fires for jobs using this template
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE webhooks
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES output_templates(id) ON DELETE SET NULL;

ALTER TABLE webhooks
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

COMMENT ON COLUMN webhooks.template_id IS 'If set, this webhook only fires for jobs that use this template; null = all jobs in org';
