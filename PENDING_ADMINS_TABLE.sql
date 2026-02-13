/**
 * PENDING ADMINS TABLE
 * 
 * Temporary storage for admin sign-up requests before they authenticate.
 * 
 * Run this in Supabase SQL Editor:
 */

CREATE TABLE IF NOT EXISTS pending_admins (
  email VARCHAR(255) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days' -- Expire after 7 days
);

CREATE INDEX IF NOT EXISTS pending_admins_institution_idx ON pending_admins(institution_id);
CREATE INDEX IF NOT EXISTS pending_admins_expires_at_idx ON pending_admins(expires_at);

-- RLS: Disabled (server-side only)
ALTER TABLE pending_admins DISABLE ROW LEVEL SECURITY;
