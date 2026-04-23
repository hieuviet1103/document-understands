-- Ensure api_keys has key_prefix (schema cache / legacy tables may miss it)

ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS key_prefix text DEFAULT 'sk_';

-- Backfill existing rows that have NULL key_prefix
UPDATE api_keys
SET key_prefix = COALESCE(LEFT(key_hash, 8), 'sk_')
WHERE key_prefix IS NULL;

-- Ensure NOT NULL (safe if column was added without it)
ALTER TABLE api_keys
  ALTER COLUMN key_prefix SET DEFAULT 'sk_';


COMMENT ON COLUMN api_keys.key_prefix IS 'First 8 characters of key for identification';


