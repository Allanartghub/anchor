/**
 * CRITICAL FIX: Install all required admin tables
 * 
 * Run this ENTIRE script in Supabase SQL Editor:
 * https://app.supabase.com/project/mvpkcicbyyrxoacfvwtx/sql/new
 * 
 * This will create:
 * 1. institutions table
 * 2. pending_admins table  
 * 3. admin_users table
 * 4. Extend users_extended with institution_id
 * 5. Extend weekly_checkin_responses with risk fields
 * 6. risk_events table
 * 
 * All with proper foreign keys and relationships
 */

-- ============================================================================
-- 1. INSTITUTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  country VARCHAR(100) NOT NULL DEFAULT 'Ireland',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE institutions DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS institutions_name_idx ON institutions(name);

-- Seed NCI institution (CRITICAL: this exact UUID is hardcoded in the app)
INSERT INTO institutions (id, name, country) 
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'National College of Ireland', 'Ireland')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. PENDING_ADMINS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS pending_admins (
  email VARCHAR(255) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

ALTER TABLE pending_admins DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS pending_admins_institution_idx ON pending_admins(institution_id);
CREATE INDEX IF NOT EXISTS pending_admins_expires_at_idx ON pending_admins(expires_at);

-- ============================================================================
-- 3. ADMIN_USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('counsellor', 'lead', 'admin')),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS admin_users_auth_uid_idx ON admin_users(auth_uid);
CREATE INDEX IF NOT EXISTS admin_users_institution_idx ON admin_users(institution_id);
CREATE INDEX IF NOT EXISTS admin_users_role_idx ON admin_users(role);
CREATE INDEX IF NOT EXISTS admin_users_active_idx ON admin_users(is_active);

-- ============================================================================
-- 4. EXTEND USERS_EXTENDED WITH INSTITUTION_ID
-- ============================================================================
ALTER TABLE users_extended
ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS users_extended_institution_idx ON users_extended(institution_id);

-- ============================================================================
-- 5. EXTEND WEEKLY_CHECKIN_RESPONSES WITH RISK FIELDS
-- ============================================================================
ALTER TABLE weekly_checkin_responses
ADD COLUMN IF NOT EXISTS risk_score INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS high_risk BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trigger_reasons JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS reviewed BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS weekly_checkin_risk_score_idx ON weekly_checkin_responses(risk_score DESC);
CREATE INDEX IF NOT EXISTS weekly_checkin_high_risk_idx ON weekly_checkin_responses(high_risk);
CREATE INDEX IF NOT EXISTS weekly_checkin_reviewed_idx ON weekly_checkin_responses(reviewed);

-- ============================================================================
-- 6. RISK_EVENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_id UUID NOT NULL REFERENCES weekly_checkin_responses(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  risk_score INT NOT NULL,
  trigger_reasons JSONB NOT NULL DEFAULT '{}',
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by_user_id UUID REFERENCES admin_users(auth_uid) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NULL,
  review_notes TEXT NULL,
  is_escalated BOOLEAN DEFAULT FALSE,
  escalation_reason VARCHAR(255) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE risk_events DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS risk_events_user_id_idx ON risk_events(user_id);
CREATE INDEX IF NOT EXISTS risk_events_institution_idx ON risk_events(institution_id);
CREATE INDEX IF NOT EXISTS risk_events_reviewed_idx ON risk_events(reviewed);
CREATE INDEX IF NOT EXISTS risk_events_created_at_idx ON risk_events(created_at DESC);
CREATE INDEX IF NOT EXISTS risk_events_high_score_idx ON risk_events(risk_score DESC);

-- ============================================================================
-- 7. INSTITUTIONAL_INSIGHTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS institutional_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  week_number INT NOT NULL,
  semester_year INT NOT NULL,
  top_domain VARCHAR(50),
  top_domain_count INT,
  weekly_spike_percent FLOAT,
  spike_description TEXT,
  repeated_spike_domains JSONB DEFAULT '[]',
  risk_event_count INT,
  high_intensity_pct FLOAT,
  recommendation_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE institutional_insights DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS institutional_insights_institution_idx ON institutional_insights(institution_id);
CREATE INDEX IF NOT EXISTS institutional_insights_week_idx ON institutional_insights(week_number, semester_year);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify everything is set up correctly:

-- Check institutions
SELECT 'institutions' as table_name, COUNT(*) as record_count FROM institutions;

-- Check pending_admins
SELECT 'pending_admins' as table_name, COUNT(*) as record_count FROM pending_admins;

-- Check admin_users
SELECT 'admin_users' as table_name, COUNT(*) as record_count FROM admin_users;

-- Verify NCI institution exists
SELECT id, name FROM institutions WHERE name = 'National College of Ireland';

-- ============================================================================
-- END SCRIPT
-- ============================================================================
