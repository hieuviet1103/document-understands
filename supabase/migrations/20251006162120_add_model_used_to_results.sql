-- ─────────────────────────────────────────────────────────────────────────────
-- Add model_used column to processing_results
-- Tracks which Gemini model version processed each document.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE processing_results
  ADD COLUMN IF NOT EXISTS model_used text DEFAULT 'gemini-2.0-flash';

COMMENT ON COLUMN processing_results.model_used IS
  'Gemini model used for processing (e.g. gemini-2.0-flash, gemini-2.0-flash-lite)';
