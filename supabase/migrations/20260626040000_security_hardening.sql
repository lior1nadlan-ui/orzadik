-- Rate limiting table for webhook IP throttling
CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  count int NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON rate_limits(expires_at);

-- Upsert a counter for the given key and return the new count.
-- Automatically evicts expired entries.
CREATE OR REPLACE FUNCTION increment_rate_limit(p_key text, p_ttl_seconds int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
BEGIN
  -- Evict expired keys (cheap housekeeping, runs opportunistically)
  DELETE FROM rate_limits WHERE expires_at < now();

  INSERT INTO rate_limits (key, count, expires_at)
  VALUES (p_key, 1, now() + (p_ttl_seconds || ' seconds')::interval)
  ON CONFLICT (key) DO UPDATE
    SET count = rate_limits.count + 1,
        expires_at = GREATEST(rate_limits.expires_at, now() + (p_ttl_seconds || ' seconds')::interval)
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$$;

-- Only service_role can touch rate_limits (called from server-only code)
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON rate_limits
  USING (false)
  WITH CHECK (false);

GRANT EXECUTE ON FUNCTION increment_rate_limit(text, int) TO service_role;
