/**
 * ANCHOR MVP - NEW SUPABASE PROJECT SCHEMA
 * 
 * This is the complete SQL schema for setting up a fresh Anchor Supabase project.
 * Run these statements in order in the Supabase SQL Editor.
 * 
 * Target: International postgraduate students in their first 12 months in Ireland
 * Core focus: Mental Load Tracking (not mood)
 * 
 * NOTE: The 7 mental load domains are fixed and fundamental to the product architecture.
 *       Do not modify domain structure without explicit v2 decision.
 */

-- ============================================================================
-- 1. MENTAL LOAD DOMAINS (Reference Table)
-- ============================================================================
-- These are the 7 fixed domains that frame all user interactions.
-- Users never see numeric IDs—only labels and emojis.

CREATE TABLE IF NOT EXISTS mental_load_domains (
  id VARCHAR(50) PRIMARY KEY,
  label VARCHAR(255) NOT NULL,
  emoji VARCHAR(10) NOT NULL,
  description TEXT NOT NULL,
  sort_order INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the 7 domains (locked list)
INSERT INTO mental_load_domains (id, label, emoji, description, sort_order) VALUES
  ('academic', 'Academic Load', '📚', 'Coursework, deadlines, thesis, exams, presentations', 1),
  ('financial', 'Financial Load', '💰', 'Tuition, cost of living, work hours trade-offs', 2),
  ('belonging', 'Belonging & Social Load', '🤝', 'Friendships, community, homesickness, integration', 3),
  ('administrative', 'Administrative & Immigration Load', '📋', 'Visa, stamp conditions, residency, registrations', 4),
  ('worklife', 'Work–Life & Time Load', '⏰', 'Part-time work, commutes, study-work balance', 5),
  ('health', 'Health & Energy Load', '💚', 'Sleep, exercise, nutrition, climate adjustment, fatigue', 6),
  ('future', 'Future & Stability Load', '🎯', 'Post-graduation plans, career uncertainty, next steps', 7)
ON CONFLICT (id) DO NOTHING;

-- Index for sorting/UI
CREATE INDEX IF NOT EXISTS mental_load_domains_sort_idx ON mental_load_domains(sort_order);

-- ============================================================================
-- 2. EXTENDED USER PROFILE (Journey Context)
-- ============================================================================
-- Captures time-in-journey and semester stage for personalized prompts.
-- Links to Supabase auth.users via user_id.

CREATE TABLE IF NOT EXISTS users_extended (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Semester context (captured at onboarding)
  semester_start VARCHAR(50) NOT NULL, -- 'Early January', 'Late January', 'Early September', 'Late September', 'Other / Not sure'
  semester_position VARCHAR(50) NOT NULL, -- 'Start', 'Middle', 'End'
  
  -- Cohort bucketing for institutional view
  cohort_code VARCHAR(100) NULL, -- e.g., 'cohort_2024_spring', populated for analytics
  
  metadata JSONB DEFAULT '{}', -- Extensible for future journey markers
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_extended_user_id_idx ON users_extended(user_id);
CREATE INDEX IF NOT EXISTS users_extended_cohort_idx ON users_extended(cohort_code);

-- RLS for users_extended: Users can only view/edit their own profile
ALTER TABLE users_extended ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own extended profile"
  ON users_extended FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own extended profile"
  ON users_extended FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own extended profile"
  ON users_extended FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own extended profile"
  ON users_extended FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON users_extended TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON users_extended TO authenticated;

-- ============================================================================
-- 3. LOAD ENTRIES (Primary Load Tracking)
-- ============================================================================
-- Core table for load tracking entries.
-- Each entry captures:
-- - intensity (user sees Light/Moderate/Heavy, system stores 1-5)
-- - structured reflection (guided prompt response)
-- - domain selections (via load_domain_selections junction table)

CREATE TABLE IF NOT EXISTS load_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Intensity: User-facing label + system numeric for trending
  intensity_label VARCHAR(50) NOT NULL, -- 'Light', 'Moderate', 'Heavy'
  intensity_numeric INT NOT NULL, -- 1-5 (internal only, never shown to user)
  
  -- Structured reflection
  reflection_text TEXT NOT NULL, -- User's guided response
  
  -- Context
  week_number INT NOT NULL, -- For grouping/trending (e.g., week of semester)
  semester_year INT NOT NULL, -- Academic year for filtering
  
  -- Metadata
  has_risk_flag BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS load_entries_user_id_idx ON load_entries(user_id);
CREATE INDEX IF NOT EXISTS load_entries_week_idx ON load_entries(user_id, week_number DESC);
CREATE INDEX IF NOT EXISTS load_entries_created_at_idx ON load_entries(created_at DESC);

-- RLS: Users can only see their own load entries
ALTER TABLE load_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own load entries"
  ON load_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own load entries"
  ON load_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own load entries"
  ON load_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own load entries"
  ON load_entries FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON load_entries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON load_entries TO authenticated;

-- ============================================================================
-- 4. LOAD DOMAIN SELECTIONS (Many-to-Many Linking)
-- ============================================================================
-- Links each load entry to 1+ domains.
-- Allows tracking which domains are driving load.

CREATE TABLE IF NOT EXISTS load_domain_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_entry_id UUID NOT NULL REFERENCES load_entries(id) ON DELETE CASCADE,
  domain_id VARCHAR(50) NOT NULL REFERENCES mental_load_domains(id) ON DELETE CASCADE,
  
  -- Mark if this is the primary (top) domain for this entry
  is_primary BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS load_domain_selections_entry_idx ON load_domain_selections(load_entry_id);
CREATE INDEX IF NOT EXISTS load_domain_selections_domain_idx ON load_domain_selections(domain_id);
CREATE UNIQUE INDEX IF NOT EXISTS load_domain_selections_unique_idx ON load_domain_selections(load_entry_id, domain_id);

-- RLS: Users can only see selections for their own load entries
ALTER TABLE load_domain_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view domain selections for their entries"
  ON load_domain_selections FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM load_entries le
    WHERE le.id = load_entry_id AND le.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert domain selections for their entries"
  ON load_domain_selections FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM load_entries le
    WHERE le.id = load_entry_id AND le.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete domain selections for their entries"
  ON load_domain_selections FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM load_entries le
    WHERE le.id = load_entry_id AND le.user_id = auth.uid()
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON load_domain_selections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON load_domain_selections TO authenticated;

-- ============================================================================
-- 5. WEEKLY CHECK-IN RESPONSES (Structured Continuity)
-- ============================================================================
-- Captures the weekly structured check-in.
-- One check-in per week per user (soft gating—encouraged, not enforced).

CREATE TABLE IF NOT EXISTS weekly_checkin_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Week identifiers
  week_number INT NOT NULL,
  semester_year INT NOT NULL,
  
  -- Completion timestamp (marks when check-in was done)
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Domain selections (top 1-2)
  primary_domain_id VARCHAR(50) REFERENCES mental_load_domains(id) ON DELETE SET NULL,
  secondary_domain_id VARCHAR(50) REFERENCES mental_load_domains(id) ON DELETE SET NULL,
  
  -- Intensity: same dual-scale as load_entries
  intensity_label VARCHAR(50) NOT NULL, -- 'Light', 'Moderate', 'Heavy'
  intensity_numeric INT NOT NULL, -- 1-5
  
  -- Structured prompt response
  structured_prompt VARCHAR(500) NOT NULL, -- The question asked (e.g., "What felt heavier than expected?")
  response_text TEXT NOT NULL, -- User's answer
  
  -- Optional micro-action suggestion
  suggested_action TEXT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one check-in per user per week per year
CREATE UNIQUE INDEX IF NOT EXISTS weekly_checkin_unique_idx ON weekly_checkin_responses(user_id, week_number, semester_year);

CREATE INDEX IF NOT EXISTS weekly_checkin_user_idx ON weekly_checkin_responses(user_id);
CREATE INDEX IF NOT EXISTS weekly_checkin_week_idx ON weekly_checkin_responses(week_number, semester_year);
CREATE INDEX IF NOT EXISTS weekly_checkin_domain_idx ON weekly_checkin_responses(primary_domain_id);

-- RLS: Users can only see their own check-ins
ALTER TABLE weekly_checkin_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own weekly check-ins"
  ON weekly_checkin_responses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own weekly check-ins"
  ON weekly_checkin_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own weekly check-ins"
  ON weekly_checkin_responses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own weekly check-ins"
  ON weekly_checkin_responses FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON weekly_checkin_responses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON weekly_checkin_responses TO authenticated;

-- ============================================================================
-- 6. INSTITUTIONAL AGGREGATES (Cohort Analytics Infrastructure)
-- ============================================================================
-- Pre-computed anonymised cohort-level statistics.
-- Built from load_entries and weekly_checkin_responses.
-- NO PII. Aggregation by domain and week only.

CREATE TABLE IF NOT EXISTS institutional_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_code VARCHAR(100) NOT NULL,
  week_number INT NOT NULL,
  semester_year INT NOT NULL,
  domain_id VARCHAR(50) NOT NULL REFERENCES mental_load_domains(id) ON DELETE CASCADE,
  
  -- Aggregated metrics
  avg_intensity_numeric FLOAT NOT NULL, -- Average 1-5 scale
  median_intensity_numeric FLOAT NOT NULL,
  sample_size INT NOT NULL, -- How many entries contributed
  
  -- Trend delta (week-over-week change)
  intensity_delta FLOAT NULL, -- Positive = increase in load
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(cohort_code, week_number, semester_year, domain_id)
);

CREATE INDEX IF NOT EXISTS institutional_aggregates_cohort_idx ON institutional_aggregates(cohort_code);
CREATE INDEX IF NOT EXISTS institutional_aggregates_week_idx ON institutional_aggregates(week_number, semester_year);
CREATE INDEX IF NOT EXISTS institutional_aggregates_domain_idx ON institutional_aggregates(domain_id);

-- RLS: Only authenticated users with admin role can view (enforced at app level)
-- For now, disable RLS and trust app-level access control
ALTER TABLE institutional_aggregates DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. CHAT SESSIONS (Repurposed - Keep for Optional Structured Chat)
-- ============================================================================
-- Existing chat infrastructure, repurposed.
-- Chat is now secondary and optional, only accessible through structured entry points.
-- Added domain_context to link chats to load domains if relevant.

CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ NULL,
  message_count INT NOT NULL DEFAULT 0,
  summary_text TEXT NOT NULL DEFAULT '',
  session_title VARCHAR(255) NOT NULL DEFAULT 'Chat Session',
  mood_at_start TEXT NULL, -- Kept for backward compatibility (hidden from UI)
  messages_json JSONB DEFAULT '[]',
  has_risk_flag BOOLEAN DEFAULT FALSE,
  
  -- NEW: Link to domain if chat was domain-triggered
  domain_context VARCHAR(50) REFERENCES mental_load_domains(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_sessions_user_id_idx ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS chat_sessions_started_at_idx ON chat_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS chat_sessions_domain_idx ON chat_sessions(domain_context);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chat sessions"
  ON chat_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat sessions"
  ON chat_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat sessions"
  ON chat_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat sessions"
  ON chat_sessions FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON chat_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_sessions TO authenticated;

-- ============================================================================
-- 8. CHAT SUMMARIES (Repurposed - Keep for Optional Chat Summaries)
-- ============================================================================
-- Existing chat summaries, repurposed with domain context.

CREATE TABLE IF NOT EXISTS chat_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  mood_at_time VARCHAR(50) NOT NULL, -- Kept for backward compatibility (hidden from UI)
  message_count INTEGER DEFAULT 1,
  has_risk_flag BOOLEAN DEFAULT FALSE,
  
  -- NEW: Link to domain if summary relates to a load domain
  domain_context VARCHAR(50) REFERENCES mental_load_domains(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_summaries_user_id_idx ON chat_summaries(user_id);
CREATE INDEX IF NOT EXISTS chat_summaries_created_at_idx ON chat_summaries(created_at DESC);
CREATE INDEX IF NOT EXISTS chat_summaries_domain_idx ON chat_summaries(domain_context);

ALTER TABLE chat_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chat summaries"
  ON chat_summaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat summaries"
  ON chat_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat summaries"
  ON chat_summaries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat summaries"
  ON chat_summaries FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON chat_summaries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_summaries TO authenticated;

-- ============================================================================
-- 9. MOOD ENTRIES (Hidden - Keep for Optional Snapshot View)
-- ============================================================================
-- Existing mood tracking, kept in codebase but hidden from primary UI.
-- Available as optional "snapshot" if implemented later.

CREATE TABLE IF NOT EXISTS mood_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mood_id VARCHAR(50) NOT NULL, -- e.g., 'calm', 'okay', 'stressed'
  text TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mood_entries_user_id_idx ON mood_entries(user_id);
CREATE INDEX IF NOT EXISTS mood_entries_created_at_idx ON mood_entries(created_at DESC);

ALTER TABLE mood_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own mood entries"
  ON mood_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own mood entries"
  ON mood_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mood entries"
  ON mood_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mood entries"
  ON mood_entries FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON mood_entries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON mood_entries TO authenticated;

-- ============================================================================
-- 10. CONSENT (Existing - Keep Unchanged)
-- ============================================================================

CREATE TABLE IF NOT EXISTS consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  privacy_accepted_at TIMESTAMPTZ NULL,
  disclaimer_accepted_at TIMESTAMPTZ NULL,
  crisis_disclosure_accepted_at TIMESTAMPTZ NULL,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS consent_user_id_idx ON consent(user_id);

ALTER TABLE consent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own consent record"
  ON consent FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own consent record"
  ON consent FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own consent record"
  ON consent FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own consent record"
  ON consent FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON consent TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON consent TO authenticated;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
-- 
-- Summary of tables:
-- 1. mental_load_domains - Reference (7 fixed domains)
-- 2. users_extended - Extended profile with journey context
-- 3. load_entries - Primary load tracking
-- 4. load_domain_selections - Many-to-many linking
-- 5. weekly_checkin_responses - Weekly structured check-in
-- 6. institutional_aggregates - Anonymised cohort analytics
-- 7. chat_sessions - Repurposed (secondary)
-- 8. chat_summaries - Repurposed (secondary)
-- 9. mood_entries - Hidden (optional snapshot view)
-- 10. consent - Existing (unchanged)
--
-- All tables have:
-- - Appropriate indexes for performance
-- - Row-Level Security enabled (except institutional_aggregates for app-level control)
-- - RLS policies to enforce user isolation
-- - Proper grants to anon and authenticated roles
--
-- Next steps:
-- 1. Update types.ts with new TypeScript interfaces
-- 2. Implement weekly check-in flow
-- 3. Implement load tracking UI
-- 4. Implement institutional view route
-- 5. Update onboarding for ICP + semester context
-- 6. Hide mood-based UI elements
