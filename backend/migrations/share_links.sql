-- Robust Sharing System Migration
CREATE TABLE IF NOT EXISTS share_links (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id     UUID REFERENCES projects(id) ON DELETE CASCADE,
  token          TEXT UNIQUE NOT NULL,
  label          TEXT DEFAULT 'Shared Link',  -- "QA Team", "Client Review"
  role           TEXT DEFAULT 'tester' CHECK(role IN ('tester', 'viewer', 'reviewer')),
  expires_at     TIMESTAMPTZ DEFAULT NULL,     -- NULL = never expires
  max_uses       INTEGER DEFAULT NULL,         -- NULL = unlimited
  use_count      INTEGER DEFAULT 0,
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  password_hash  TEXT DEFAULT NULL             -- optional password protection
);

CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);
CREATE INDEX IF NOT EXISTS idx_share_links_project ON share_links(project_id);
