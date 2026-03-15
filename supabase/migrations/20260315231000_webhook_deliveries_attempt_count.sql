-- Ensure webhook_deliveries has attempt_count (schema cache / legacy tables may miss it)

ALTER TABLE webhook_deliveries
  ADD COLUMN IF NOT EXISTS attempt_count integer DEFAULT 1;

COMMENT ON COLUMN webhook_deliveries.attempt_count IS 'Number of delivery attempts';
