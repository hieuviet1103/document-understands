-- ─────────────────────────────────────────────────────────────────────────────
-- Add any missing columns to processing_results (for DBs created with minimal schema)
-- Safe to run: uses IF NOT EXISTS so existing columns are unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE processing_results
  ADD COLUMN IF NOT EXISTS output_format text DEFAULT 'json';

ALTER TABLE processing_results
  ADD COLUMN IF NOT EXISTS processing_job_id uuid REFERENCES processing_jobs(id) ON DELETE SET NULL;

ALTER TABLE processing_results
  ADD COLUMN IF NOT EXISTS processing_time integer DEFAULT 0;

ALTER TABLE processing_results
  ADD COLUMN IF NOT EXISTS tokens_used integer DEFAULT 0;

COMMENT ON COLUMN processing_results.output_format IS 'Output format: text, json, or excel';
COMMENT ON COLUMN processing_results.processing_job_id IS 'Same as job_id; alias for compatibility';
COMMENT ON COLUMN processing_results.processing_time IS 'Processing duration in seconds';
COMMENT ON COLUMN processing_results.tokens_used IS 'Token count from Gemini';
