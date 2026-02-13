/**
 * ANCHOR INSTITUTIONAL BACKEND - SCHEMA ADDITIONS
 * 
 * Extends the existing Anchor MVP schema with institutional admin views,
 * risk tracking, and cohort-level insights.
 * 
 * Run these statements in order after the main ANCHOR_SUPABASE_SCHEMA.sql
 * 
 * Tables:
 * 1. institutions - Multi-institution support (MVP uses 1, designed for growth)
 * 2. admin_users - Admin access control (mapped to auth.users)
 * 3. weekly_checkins_extended - Extensions to weekly_checkin_responses (risk fields)
 * 4. risk_events - Audit log of flagged high-risk cases
 * 5. institutional_risk_queue - Materialized view for admin risk dashboard
 */

-- ============================================================================
-- 1. INSTITUTIONS
-- ============================================================================
-- Multi-institution support. MVP pins to 1 institution, but schema ready for scale.

CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  country VARCHAR(100) NOT NULL DEFAULT 'Ireland',
  -- Can add: region, contact_email, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed MVP institution (NCI as pilot)
INSERT INTO institutions (id, name, country) 
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'National College of Ireland', 'Ireland')
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS institutions_name_idx ON institutions(name);

-- RLS: No RLS on institutions (reference-like table)
ALTER TABLE institutions DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. ADMIN_USERS
-- ============================================================================
-- Maps Supabase auth.users to admin roles and institutions.
-- Only users in this table have admin access.

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  
  -- Role hierarchy: counsellor → lead → admin (MVP enforces at app level)
  role VARCHAR(50) NOT NULL CHECK (role IN ('counsellor', 'lead', 'admin')),
  
  -- Admin metadata
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  
  -- Soft delete for audit trail
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_users_auth_uid_idx ON admin_users(auth_uid);
CREATE INDEX IF NOT EXISTS admin_users_institution_idx ON admin_users(institution_id);
CREATE INDEX IF NOT EXISTS admin_users_role_idx ON admin_users(role);
CREATE INDEX IF NOT EXISTS admin_users_active_idx ON admin_users(is_active);

-- RLS: Service role (server-side only) can read all. Disable to avoid client-side exposure.
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. EXTEND WEEKLY_CHECKIN_RESPONSES WITH RISK FIELDS
-- ============================================================================
-- Add risk tracking to existing weekly check-ins.
-- Can only be run if weekly_checkin_responses exists.

ALTER TABLE weekly_checkin_responses
ADD COLUMN IF NOT EXISTS risk_score INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS high_risk BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trigger_reasons JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS reviewed BOOLEAN DEFAULT FALSE;

-- Index for risk queries
CREATE INDEX IF NOT EXISTS weekly_checkin_risk_score_idx ON weekly_checkin_responses(risk_score DESC);
CREATE INDEX IF NOT EXISTS weekly_checkin_high_risk_idx ON weekly_checkin_responses(high_risk);
CREATE INDEX IF NOT EXISTS weekly_checkin_reviewed_idx ON weekly_checkin_responses(reviewed);

-- ============================================================================
-- 4. RISK_EVENTS
-- ============================================================================
-- Audit log of detected high-risk cases.
-- One record per flagged check-in; links to admin review workflow.
-- Future: can track escalations, interventions.

CREATE TABLE IF NOT EXISTS risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_id UUID NOT NULL REFERENCES weekly_checkin_responses(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  
  -- Risk metadata
  risk_score INT NOT NULL,
  trigger_reasons JSONB NOT NULL, -- Structured reasons (e.g., ["self_harm_often", "intensity_spike"])
  
  -- Admin review workflow
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by_user_id UUID REFERENCES admin_users(auth_uid) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NULL,
  review_notes TEXT NULL,
  
  -- Escalation hook (reserved for future)
  is_escalated BOOLEAN DEFAULT FALSE,
  escalation_reason VARCHAR(255) NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS risk_events_user_id_idx ON risk_events(user_id);
CREATE INDEX IF NOT EXISTS risk_events_institution_idx ON risk_events(institution_id);
CREATE INDEX IF NOT EXISTS risk_events_reviewed_idx ON risk_events(reviewed);
CREATE INDEX IF NOT EXISTS risk_events_created_at_idx ON risk_events(created_at DESC);
CREATE INDEX IF NOT EXISTS risk_events_high_score_idx ON risk_events(risk_score DESC);

-- RLS: Disable. Service role reads; app enforces institution scoping.
ALTER TABLE risk_events DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. INSTITUTIONAL_INSIGHTS (Pre-computed Strategic Insights)
-- ============================================================================
-- Cache for trend insights: top domains, spikes, recommendations.
-- Refreshed on-demand or via scheduled job (future).

CREATE TABLE IF NOT EXISTS institutional_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  
  -- Time window
  week_number INT NOT NULL,
  semester_year INT NOT NULL,
  
  -- Insight payload (JSON)
  top_domain VARCHAR(50),
  top_domain_count INT,
  weekly_spike_percent FLOAT,
  spike_description TEXT,
  repeated_spike_domains JSONB DEFAULT '[]', -- Array of domain IDs
  risk_event_count INT,
  high_intensity_pct FLOAT,
  recommendation_hint TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS institutional_insights_institution_idx ON institutional_insights(institution_id);
CREATE INDEX IF NOT EXISTS institutional_insights_week_idx ON institutional_insights(week_number, semester_year);

ALTER TABLE institutional_insights DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. PROFILE ALIGNMENT (Link to Institution)
-- ============================================================================
-- Extend users_extended to include institution_id for student profile.
-- This allows the institutional backend to filter by institution.

ALTER TABLE users_extended
ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS users_extended_institution_idx ON users_extended(institution_id);

-- ============================================================================
-- 7. HELPER FUNCTIONS (Server-side aggregation)
-- ============================================================================

-- Function to calculate cohort size by institution + week
CREATE OR REPLACE FUNCTION get_cohort_size(
  p_institution_id UUID,
  p_week_number INT,
  p_semester_year INT
)
RETURNS INT AS $$
  SELECT COUNT(DISTINCT wcr.user_id)
  FROM weekly_checkin_responses wcr
  JOIN users_extended ue ON ue.user_id = wcr.user_id
  WHERE ue.institution_id = p_institution_id
    AND wcr.week_number = p_week_number
    AND wcr.semester_year = p_semester_year;
$$ LANGUAGE SQL STABLE;

-- Function to get top domain for institution + week
CREATE OR REPLACE FUNCTION get_top_domain(
  p_institution_id UUID,
  p_week_number INT,
  p_semester_year INT
)
RETURNS VARCHAR AS $$
  SELECT primary_domain_id
  FROM weekly_checkin_responses wcr
  JOIN users_extended ue ON ue.user_id = wcr.user_id
  WHERE ue.institution_id = p_institution_id
    AND wcr.week_number = p_week_number
    AND wcr.semester_year = p_semester_year
  GROUP BY primary_domain_id
  ORDER BY COUNT(*) DESC
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- END OF INSTITUTIONAL SCHEMA
-- ============================================================================
-- Next steps:
-- 1. Update types.ts with institutional types
-- 2. Build riskEngine.ts
-- 3. Build insightsEngine.ts
-- 4. Build adminAuth.ts
-- 5. Create API routes
-- 6. Build admin dashboard
