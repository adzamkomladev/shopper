CREATE TABLE IF NOT EXISTS cache_entry (
  org_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (org_id, key)
);
