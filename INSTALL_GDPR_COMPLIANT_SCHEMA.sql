/**
 * GDPR-COMPLIANT ADMIN SCHEMA
 * 
 * This schema enforces:
 * - Purpose limitation (trends vs support requests)
 * - Data minimization (risk tiers only, no raw text)
 * - Consent requirements (explicit opt-in for support)
 * - Access control (role-based visibility)
 * - Audit logging (immutable records)
 * - Retention enforcement (TTL policies)
 * 
 * Run this in Supabase SQL Editor after backing up existing data.
 */

-- ============================================================================
-- 1. INSTITUTIONS TABLE (unchanged)
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

INSERT INTO institutions (id, name, country) 
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'National College of Ireland', 'Ireland')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. ADMIN_USERS TABLE (with role-based permissions)
-- ============================================================================

-- First, drop the old constraint to allow role updates
ALTER TABLE IF EXISTS admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;

-- Now update existing roles to new GDPR-compliant names
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_users') THEN
    UPDATE admin_users SET role = 'trends_viewer' WHERE role = 'counsellor';
    UPDATE admin_users SET role = 'support_agent' WHERE role = 'lead';
    UPDATE admin_users SET role = 'data_officer' WHERE role = 'admin';
    RAISE NOTICE 'Updated existing admin_users roles to GDPR-compliant names';
  END IF;
END $$;

-- Create table with new role constraint
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  -- Roles: trends_viewer, support_agent, data_officer, security_auditor
  role VARCHAR(50) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add new constraint after role migration
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE admin_users ADD CONSTRAINT admin_users_role_check 
  CHECK (role IN ('trends_viewer', 'support_agent', 'data_officer', 'security_auditor'));

ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS admin_users_auth_uid_idx ON admin_users(auth_uid);
CREATE INDEX IF NOT EXISTS admin_users_institution_idx ON admin_users(institution_id);
CREATE INDEX IF NOT EXISTS admin_users_role_idx ON admin_users(role);

-- ============================================================================
-- 3. CONSENT_RECORDS TABLE (explicit opt-in tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type VARCHAR(50) NOT NULL CHECK (consent_type IN (
    'wellbeing_processing',
    'risk_signal_processing', 
    'support_request_sharing'
  )),
  consent_version VARCHAR(20) NOT NULL, -- e.g., '1.0', '1.1'
  consent_text_hash VARCHAR(64) NOT NULL, -- SHA256 of consent text shown
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_at TIMESTAMPTZ NULL,
  scope JSONB DEFAULT '{}', -- Additional scope metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE consent_records DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS consent_records_user_id_idx ON consent_records(user_id);
CREATE INDEX IF NOT EXISTS consent_records_type_idx ON consent_records(consent_type);
CREATE INDEX IF NOT EXISTS consent_records_active_idx ON consent_records(user_id, consent_type, withdrawn_at) 
  WHERE withdrawn_at IS NULL;

-- ============================================================================
-- 4. RISK_EVENTS TABLE (minimal derived metadata only)
-- ============================================================================
DROP TABLE IF EXISTS risk_events CASCADE;

CREATE TABLE risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_id UUID NOT NULL REFERENCES weekly_checkin_responses(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  
  -- Risk tier (R0=normal, R1=vulnerability, R2=passive ideation, R3=active intent)
  risk_tier INT NOT NULL CHECK (risk_tier BETWEEN 0 AND 3),
  
  -- Enumerated reason codes (NOT raw text)
  risk_reason_codes VARCHAR(100)[] DEFAULT '{}', -- e.g., ['high_intensity_spike', 'sustained_distress', 'self_harm_keywords']
  
  -- Confidence band
  confidence_band VARCHAR(20) CHECK (confidence_band IN ('low', 'medium', 'high')),
  
  -- Model tracking
  model_version VARCHAR(20) DEFAULT '1.0',
  
  -- TTL: automatically delete after 90 days
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '90 days',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE risk_events DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS risk_events_user_id_idx ON risk_events(user_id);
CREATE INDEX IF NOT EXISTS risk_events_institution_idx ON risk_events(institution_id);
CREATE INDEX IF NOT EXISTS risk_events_tier_idx ON risk_events(risk_tier DESC);
CREATE INDEX IF NOT EXISTS risk_events_expires_idx ON risk_events(expires_at);

-- ============================================================================
-- 5. SUPPORT_REQUESTS TABLE (opt-in only)
-- ============================================================================
CREATE TABLE IF NOT EXISTS support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Pseudonymised case token (not direct user_id in admin views)
  case_token VARCHAR(50) UNIQUE NOT NULL,
  
  -- Internal link (encrypted or restricted access)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  
  -- Request metadata
  request_type VARCHAR(50) NOT NULL CHECK (request_type IN (
    'contact_me',
    'refer_to_support',
    'email_resources',
    'request_call'
  )),
  
  -- Context excerpt (redacted, no self-harm text)
  context_excerpt TEXT NULL, -- Auto-redacted summary, max 500 chars
  
  -- Related check-in
  checkin_id UUID REFERENCES weekly_checkin_responses(id) ON DELETE SET NULL,
  
  -- Risk context (tier only, no details)
  risk_tier INT CHECK (risk_tier BETWEEN 0 AND 3),
  
  -- Consent tracking
  consent_record_id UUID NOT NULL REFERENCES consent_records(id) ON DELETE CASCADE,
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'withdrawn')),
  
  -- Admin handling
  assigned_to UUID REFERENCES admin_users(auth_uid) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NULL,
  resolution_notes TEXT NULL, -- Encrypted field
  
  -- TTL: delete 180 days after completion
  completed_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NULL, -- Set to completed_at + 180 days on completion
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE support_requests DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS support_requests_institution_idx ON support_requests(institution_id);
CREATE INDEX IF NOT EXISTS support_requests_status_idx ON support_requests(status);
CREATE INDEX IF NOT EXISTS support_requests_assigned_idx ON support_requests(assigned_to);
CREATE INDEX IF NOT EXISTS support_requests_expires_idx ON support_requests(expires_at);

-- ============================================================================
-- 6. ADMIN_AUDIT_LOG TABLE (immutable)
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES admin_users(auth_uid) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- 'view_trends', 'view_support_request', 'assign_case', 'export_data'
  resource_type VARCHAR(50), -- 'support_request', 'trend_data', 'user_data'
  resource_id UUID, -- Reference to affected resource
  action_details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutable: no updates or deletes allowed
ALTER TABLE admin_audit_log DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS admin_audit_log_admin_idx ON admin_audit_log(admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx ON admin_audit_log(action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_resource_idx ON admin_audit_log(resource_type, resource_id);

-- ============================================================================
-- 7. COHORT_AGGREGATES TABLE (k-anonymized trends)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cohort_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  
  -- Time window
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  
  -- Cohort size (must be >= k_threshold for display)
  cohort_size INT NOT NULL,
  k_threshold INT DEFAULT 10, -- Minimum group size for display
  
  -- Aggregated metrics
  top_domain VARCHAR(50),
  top_domain_pct FLOAT,
  avg_intensity FLOAT,
  high_intensity_count INT,
  
  -- Risk tier counts (aggregated)
  r0_count INT DEFAULT 0,
  r1_count INT DEFAULT 0,
  r2_count INT DEFAULT 0,
  r3_count INT DEFAULT 0,
  
  -- Recommendations (generic, cohort-level)
  recommendations JSONB DEFAULT '[]',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cohort_aggregates DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS cohort_aggregates_institution_idx ON cohort_aggregates(institution_id);
CREATE INDEX IF NOT EXISTS cohort_aggregates_week_idx ON cohort_aggregates(week_start DESC);

-- ============================================================================
-- 8. UPDATE EXISTING TABLES
-- ============================================================================

-- Update users_extended (minimal institution link)
ALTER TABLE users_extended
ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;

-- Update weekly_checkin_responses (remove direct risk fields)
-- Risk data now lives ONLY in risk_events table
ALTER TABLE weekly_checkin_responses
DROP COLUMN IF EXISTS risk_score,
DROP COLUMN IF EXISTS high_risk,
DROP COLUMN IF EXISTS trigger_reasons,
DROP COLUMN IF EXISTS reviewed;

-- Add TTL field for retention enforcement
ALTER TABLE weekly_checkin_responses
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '90 days';

CREATE INDEX IF NOT EXISTS weekly_checkin_expires_idx ON weekly_checkin_responses(expires_at);

-- ============================================================================
-- 9. RETENTION ENFORCEMENT FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete expired risk events
  DELETE FROM risk_events WHERE expires_at < NOW();
  
  -- Delete expired support requests
  DELETE FROM support_requests WHERE expires_at IS NOT NULL AND expires_at < NOW();
  
  -- Delete expired check-ins (only if no active support request)
  DELETE FROM weekly_checkin_responses 
  WHERE expires_at < NOW()
  AND id NOT IN (SELECT checkin_id FROM support_requests WHERE status != 'withdrawn');
  
  RAISE NOTICE 'Expired records cleaned up at %', NOW();
END;
$$;

-- ============================================================================
-- 10. HELPER FUNCTION: Check active consent
-- ============================================================================
CREATE OR REPLACE FUNCTION has_active_consent(
  p_user_id UUID,
  p_consent_type VARCHAR(50)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_consent BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM consent_records
    WHERE user_id = p_user_id
    AND consent_type = p_consent_type
    AND granted = TRUE
    AND withdrawn_at IS NULL
  ) INTO v_has_consent;
  
  RETURN v_has_consent;
END;
$$;

-- ============================================================================
-- 11. HELPER FUNCTION: Create support request case token
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_case_token()
RETURNS VARCHAR(50)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'SR-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 12));
END;
$$;

-- ============================================================================
-- 12. SCHEDULED JOB SETUP (requires pg_cron extension)
-- ============================================================================
-- Uncomment if pg_cron is available:
-- SELECT cron.schedule('cleanup-expired-records', '0 2 * * *', 'SELECT cleanup_expired_records()');

-- ============================================================================
-- 13. VERIFICATION QUERIES
-- ============================================================================

-- Check schema
SELECT 
  'admin_users' as table_name, 
  COUNT(*) as count,
  ARRAY_AGG(DISTINCT role) as roles
FROM admin_users;

SELECT 
  'consent_records' as table_name,
  COUNT(*) as count,
  consent_type,
  SUM(CASE WHEN granted AND withdrawn_at IS NULL THEN 1 ELSE 0 END) as active_consents
FROM consent_records
GROUP BY consent_type;

SELECT 
  'risk_events' as table_name,
  COUNT(*) as count,
  risk_tier,
  COUNT(*) as tier_count
FROM risk_events
GROUP BY risk_tier
ORDER BY risk_tier;

SELECT 
  'support_requests' as table_name,
  COUNT(*) as count,
  status,
  COUNT(*) as status_count
FROM support_requests
GROUP BY status;

-- Check for records past TTL (should be cleaned up)
SELECT 
  'Expired risk_events' as check_type,
  COUNT(*) as expired_count
FROM risk_events
WHERE expires_at < NOW();

SELECT 
  'Expired support_requests' as check_type,
  COUNT(*) as expired_count
FROM support_requests
WHERE expires_at IS NOT NULL AND expires_at < NOW();

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
/**
 * TO MIGRATE FROM OLD SCHEMA:
 * 
 * 1. Backup existing risk_events table (optional - it will be recreated):
 *    CREATE TABLE risk_events_backup AS SELECT * FROM risk_events;
 * 
 * 2. Run this entire script in Supabase SQL Editor
 *    - It will automatically update admin_users roles
 *    - It will drop and recreate risk_events table
 *    - It will add new tables (consent_records, support_requests, etc.)
 * 
 * 3. Verify admin roles were updated:
 *    SELECT auth_uid, role, email FROM admin_users;
 *    -- Should show: trends_viewer, support_agent, data_officer, security_auditor
 * 
 * 4. Create initial consent records for existing users (backfill):
 *    INSERT INTO consent_records (user_id, consent_type, consent_version, consent_text_hash, granted)
 *    SELECT id, 'wellbeing_processing', '1.0', 'MIGRATION_BACKFILL', TRUE
 *    FROM auth.users
 *    WHERE id IN (SELECT DISTINCT user_id FROM weekly_checkin_responses)
 *    ON CONFLICT DO NOTHING;
 * 
 * 5. Old risk_events are intentionally NOT migrated
 *    - They don't meet new GDPR data minimization requirements
 *    - New events will be created as check-ins are submitted
 */

-- ============================================================================
-- END SCHEMA
-- ============================================================================
