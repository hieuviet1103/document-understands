-- Ensure webhook_deliveries has attempt_count and delivered_at (schema cache / legacy tables may miss them)

ALTER TABLE webhook_deliveries
  ADD COLUMN IF NOT EXISTS attempt_count integer DEFAULT 1;

ALTER TABLE webhook_deliveries
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

COMMENT ON COLUMN webhook_deliveries.attempt_count IS 'Number of delivery attempts';
COMMENT ON COLUMN webhook_deliveries.delivered_at IS 'When the delivery succeeded (2xx)';
