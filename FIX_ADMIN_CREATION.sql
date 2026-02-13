-- FIX: Create institutions table and seed NCI institution
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/mvpkcicbyyrxoacfvwtx/sql/new

-- 1. Create institutions table if it doesn't exist
CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  country VARCHAR(100) NOT NULL DEFAULT 'Ireland',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Disable RLS
ALTER TABLE institutions DISABLE ROW LEVEL SECURITY;

-- 3. Create index
CREATE INDEX IF NOT EXISTS institutions_name_idx ON institutions(name);

-- 4. Seed NCI institution (this ID is what the admin creation code expects)
INSERT INTO institutions (id, name, country) 
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'National College of Ireland', 'Ireland')
ON CONFLICT (id) DO NOTHING;

-- 5. Verify it was created
SELECT * FROM institutions;
