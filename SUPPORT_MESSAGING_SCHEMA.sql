/**
 * ANKA SUPPORT MESSAGING SYSTEM - GOVERNANCE-FIRST SCHEMA
 * 
 * This schema implements asynchronous, case-based, consent-driven support messaging.
 * 
 * Core Principles:
 * - Messaging only exists within user-initiated support cases
 * - No admin-initiated cold contact unless institutionally authorized
 * - Asynchronous communication with transparent SLAs
 * - Immutable audit logging
 * - GDPR-compliant consent tracking and data exports
 * - Clear expectations about service hours and monitoring
 */

-- ============================================================================
-- 1. SUPPORT_CASES TABLE (User-Initiated Case Management)
-- ============================================================================
CREATE TABLE IF NOT EXISTS support_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  
  -- Case status lifecycle
  status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN (
    'open',           -- User just requested, awaiting admin assignment
    'assigned',       -- Admin claimed the case
    'scheduled',      -- Call/meeting scheduled
    'completed',      -- Interaction complete
    'closed',         -- Case closed
    'withdrawn'       -- User withdrew consent/request
  )),
  
  -- User's requested communication channel
  requested_channel VARCHAR(50) NOT NULL CHECK (requested_channel IN (
    'contact_me',     -- Async messaging (default)
    'request_call',   -- User wants a call scheduled
    'email_resources',-- Send resources by email
    'refer_to_support'-- Refer to external support
  )),
  
  -- Consent tracking (GDPR)
  consent_record_id UUID NOT NULL REFERENCES consent_records(id) ON DELETE CASCADE,
  consent_version VARCHAR(20) NOT NULL,
  consent_timestamp TIMESTAMPTZ NOT NULL,
  
  -- Admin assignment
  assigned_to UUID REFERENCES admin_users(auth_uid) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NULL,
  
  -- Case context
  risk_tier INT CHECK (risk_tier BETWEEN 0 AND 3),
  context_summary TEXT NULL, -- Auto-generated summary, no raw text
  
  -- Timeline
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_response_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  
  -- TTL: auto-delete 90 days after closure
  expires_at TIMESTAMPTZ NULL,
  
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE support_cases DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS support_cases_user_idx ON support_cases(user_id);
CREATE INDEX IF NOT EXISTS support_cases_institution_idx ON support_cases(institution_id);
CREATE INDEX IF NOT EXISTS support_cases_status_idx ON support_cases(status);
CREATE INDEX IF NOT EXISTS support_cases_assigned_idx ON support_cases(assigned_to);
CREATE INDEX IF NOT EXISTS support_cases_created_idx ON support_cases(created_at DESC);
CREATE INDEX IF NOT EXISTS support_cases_expires_idx ON support_cases(expires_at);

-- ============================================================================
-- 2. SUPPORT_CASE_PARTICIPANTS TABLE (Track Who Is Involved)
-- ============================================================================
CREATE TABLE IF NOT EXISTS support_case_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES support_cases(id) ON DELETE CASCADE,
  
  -- Who is participating
  participant_type VARCHAR(20) NOT NULL CHECK (participant_type IN ('user', 'admin')),
  participant_id UUID NOT NULL, -- user.id or admin_users.auth_uid
  
  -- Role in this case
  role VARCHAR(50) NOT NULL CHECK (role IN ('requester', 'assignee', 'assigned_backup')),
  
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE support_case_participants DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS case_participants_case_idx ON support_case_participants(case_id);
CREATE INDEX IF NOT EXISTS case_participants_user_idx ON support_case_participants(participant_type, participant_id);

-- ============================================================================
-- 3. SUPPORT_MESSAGES TABLE (Immutable Message Log)
-- ============================================================================
CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES support_cases(id) ON DELETE CASCADE,
  
  -- Who sent this message
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('user', 'admin', 'system')),
  sender_id UUID, -- NULL for system messages
  
  -- Message content
  body TEXT NOT NULL,
  message_type VARCHAR(50) NOT NULL DEFAULT 'text' CHECK (message_type IN (
    'text',
    'system_acknowledgement',
    'system_auto_response',
    'system_status_update',
    'call_scheduled',
    'call_completed',
    'escalation_notice'
  )),
  
  -- Risk detection (non-invasive)
  contains_high_risk BOOLEAN DEFAULT FALSE,
  risk_detected_at TIMESTAMPTZ NULL,
  
  -- Metadata
  context_metadata JSONB DEFAULT '{}', -- e.g., call duration, attachment info
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- No edits allowed - if redaction needed, create new redacted copy
  redacted_copy_of_id UUID REFERENCES support_messages(id) ON DELETE SET NULL
);

ALTER TABLE support_messages DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS support_messages_case_idx ON support_messages(case_id);
CREATE INDEX IF NOT EXISTS support_messages_sender_idx ON support_messages(sender_type, sender_id);
CREATE INDEX IF NOT EXISTS support_messages_created_idx ON support_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS support_messages_risk_idx ON support_messages(contains_high_risk);

-- ============================================================================
-- 4. SUPPORT_SLA_CONFIG TABLE (Service Hours & Expected Response Times)
-- ============================================================================
CREATE TABLE IF NOT EXISTS support_sla_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL UNIQUE REFERENCES institutions(id) ON DELETE CASCADE,
  
  -- Service hours
  service_hours_start_time TIME NOT NULL DEFAULT '09:00:00', -- e.g., 9 AM
  service_hours_end_time TIME NOT NULL DEFAULT '17:00:00',   -- e.g., 5 PM
  service_days_of_week INT[] NOT NULL DEFAULT '{1,2,3,4,5}', -- 1=Mon, 5=Fri
  
  -- SLA targets
  first_response_sla_hours INT NOT NULL DEFAULT 24, -- Max hours to first response
  follow_up_sla_hours INT NOT NULL DEFAULT 48,      -- Max hours between responses
  
  -- Emergency handling
  has_emergency_protocol BOOLEAN DEFAULT FALSE,
  emergency_escalation_contact TEXT,
  
  -- Message retention
  message_retention_days_after_closure INT NOT NULL DEFAULT 90,
  
  -- Display text (shown to users)
  service_hours_display_text TEXT NOT NULL DEFAULT 'Mon–Fri, 9 AM–5 PM',
  not_monitored_24_7_display BOOLEAN DEFAULT TRUE,
  expected_response_window_display TEXT NOT NULL DEFAULT 'within 1 working day',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE support_sla_config DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS support_sla_config_institution_idx ON support_sla_config(institution_id);

-- ============================================================================
-- 5. SUPPORT_MESSAGES_AUDIT_LOG (Immutable: every action logged)
-- ============================================================================
CREATE TABLE IF NOT EXISTS support_messages_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES support_cases(id) ON DELETE CASCADE,
  admin_user_id UUID REFERENCES admin_users(auth_uid) ON DELETE SET NULL,
  
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
    'case_created',
    'case_viewed',
    'case_assigned',
    'case_claimed',
    'case_released',
    'message_sent',
    'message_viewed',
    'message_flagged_for_risk',
    'case_escalated',
    'case_closed',
    'case_withdrawn',
    'export_requested'
  )),
  
  action_details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE support_messages_audit_log DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS support_audit_case_idx ON support_messages_audit_log(case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_audit_admin_idx ON support_messages_audit_log(admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_audit_action_idx ON support_messages_audit_log(action_type, created_at DESC);

-- ============================================================================
-- 6. AUTO-RESPONSE MESSAGE FUNCTION
-- ============================================================================
/**
 * When a user creates a support case, system immediately sends an acknowledgement
 * message that:
 * - Acknowledges receipt
 * - States response timeframe
 * - Clarifies service is not 24/7
 * - Provides emergency contact info
 */
CREATE OR REPLACE FUNCTION create_support_case_with_auto_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sla_config support_sla_config%ROWTYPE;
  v_message_body TEXT;
  v_crisis_contacts TEXT;
BEGIN
  -- Get SLA config for this institution
  SELECT * INTO v_sla_config
  FROM support_sla_config
  WHERE institution_id = NEW.institution_id
  LIMIT 1;
  
  -- Fallback if no SLA config exists
  IF v_sla_config.id IS NULL THEN
    INSERT INTO support_sla_config (institution_id, service_hours_display_text)
    VALUES (NEW.institution_id, 'Mon–Fri, 9 AM–5 PM')
    RETURNING * INTO v_sla_config;
  END IF;
  
  -- Crisis contact info
  v_crisis_contacts := '🇮🇪 Samaritans Ireland: 116 123 (24/7) | 🇮🇪 Pieta House: 1800 247 247 | 🌍 Crisis Text: Text HELLO to 50808';
  
  -- Build auto-response message
  v_message_body := E'Hi there,\n' ||
    E'Thanks for reaching out. We''ve received your support request and we''re here to help.\n' ||
    E'What to expect:\n' ||
    E'📋 Response time: ' || v_sla_config.expected_response_window_display || E'\n' ||
    E'⏰ Service hours: ' || v_sla_config.service_hours_display_text || E'\n' ||
    E'📱 This service is not monitored 24/7. If you''re in immediate danger, please contact emergency services.\n' ||
    E'Immediate support options:\n' ||
    v_crisis_contacts || E'\n' ||
    E'A member of the wellbeing team will be with you soon. You can send messages anytime, and we''ll respond during service hours.';
  
  -- Insert system auto-response message
  INSERT INTO support_messages (
    case_id,
    sender_type,
    sender_id,
    body,
    message_type
  ) VALUES (
    NEW.id,
    'system',
    NULL,
    v_message_body,
    'system_auto_response'
  );
  
  -- Log audit event
  INSERT INTO support_messages_audit_log (
    case_id,
    action_type,
    action_details
  ) VALUES (
    NEW.id,
    'case_created',
    jsonb_build_object(
      'status', NEW.status,
      'channel', NEW.requested_channel,
      'risk_tier', NEW.risk_tier
    )
  );
  
  RETURN NEW;
END;
$$;

-- Trigger auto-response on new support case
DROP TRIGGER IF EXISTS support_case_auto_response ON support_cases;
CREATE TRIGGER support_case_auto_response
AFTER INSERT ON support_cases
FOR EACH ROW
EXECUTE FUNCTION create_support_case_with_auto_response();

-- ============================================================================
-- 7. RETENTION CLEANUP FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_support_cases()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete messages from expired cases
  DELETE FROM support_messages
  WHERE case_id IN (
    SELECT id FROM support_cases
    WHERE expires_at < NOW() AND status = 'closed'
  );
  
  -- Delete case participants
  DELETE FROM support_case_participants
  WHERE case_id IN (
    SELECT id FROM support_cases
    WHERE expires_at < NOW() AND status = 'closed'
  );
  
  -- Delete audit logs
  DELETE FROM support_messages_audit_log
  WHERE case_id IN (
    SELECT id FROM support_cases
    WHERE expires_at < NOW() AND status = 'closed'
  );
  
  -- Delete the cases themselves
  DELETE FROM support_cases
  WHERE expires_at < NOW() AND status = 'closed';
  
  RAISE NOTICE 'Support case retention cleanup completed at %', NOW();
END;
$$;

-- ============================================================================
-- 8. RISK DETECTION FUNCTION (Non-Invasive)
-- ============================================================================
/**
 * When a message is inserted, check for high-risk keywords.
 * Do NOT automatically escalate. Just flag for visibility.
 * Institutional protocol determines escalation.
 */
CREATE OR REPLACE FUNCTION detect_risk_in_support_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_risk_keywords TEXT[] := ARRAY[
    'suicidal', 'suicide', 'kill myself', 'end my life', 'end it',
    'self-harm', 'self harm', 'hurt myself', 'harm myself'
  ];
  v_word TEXT;
  v_contains_risk BOOLEAN := FALSE;
BEGIN
  -- Only check user/admin messages, not system messages
  IF NEW.sender_type = 'system' THEN
    RETURN NEW;
  END IF;
  
  -- Case-insensitive keyword check
  FOREACH v_word IN ARRAY v_risk_keywords
  LOOP
    IF NEW.body ILIKE '%' || v_word || '%' THEN
      v_contains_risk := TRUE;
      EXIT;
    END IF;
  END LOOP;
  
  NEW.contains_high_risk := v_contains_risk;
  NEW.risk_detected_at := CASE WHEN v_contains_risk THEN NOW() ELSE NULL END;
  
  -- Log if risk detected
  IF v_contains_risk THEN
    INSERT INTO support_messages_audit_log (
      case_id,
      action_type,
      action_details
    ) VALUES (
      NEW.case_id,
      'message_flagged_for_risk',
      jsonb_build_object(
        'message_id', NEW.id,
        'sender_type', NEW.sender_type
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_message_risk_detection ON support_messages;
CREATE TRIGGER support_message_risk_detection
BEFORE INSERT ON support_messages
FOR EACH ROW
EXECUTE FUNCTION detect_risk_in_support_message();

-- ============================================================================
-- 9. CLOSE CASE & SET EXPIRATION FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION close_support_case(
  p_case_id UUID,
  p_admin_user_id UUID
)
RETURNS support_cases
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_case support_cases%ROWTYPE;
  v_retention_days INT;
BEGIN
  -- Get case
  SELECT * INTO v_case FROM support_cases WHERE id = p_case_id;
  
  IF v_case.id IS NULL THEN
    RAISE EXCEPTION 'Support case not found: %', p_case_id;
  END IF;
  
  -- Get retention config
  SELECT message_retention_days_after_closure INTO v_retention_days
  FROM support_sla_config
  WHERE institution_id = v_case.institution_id;
  
  -- Fallback
  v_retention_days := COALESCE(v_retention_days, 90);
  
  -- Update case
  UPDATE support_cases
  SET
    status = 'closed',
    completed_at = NOW(),
    expires_at = NOW() + (v_retention_days || ' days')::INTERVAL,
    updated_at = NOW()
  WHERE id = p_case_id
  RETURNING * INTO v_case;
  
  -- Log closure
  INSERT INTO support_messages_audit_log (
    case_id,
    admin_user_id,
    action_type,
    action_details
  ) VALUES (
    p_case_id,
    p_admin_user_id,
    'case_closed',
    jsonb_build_object(
      'closed_by', p_admin_user_id,
      'retention_until', v_case.expires_at
    )
  );
  
  RETURN v_case;
END;
$$;

-- ============================================================================
-- 10. VERIFICATION QUERIES
-- ============================================================================

-- Check schema
SELECT 
  'support_cases' as table_name, 
  COUNT(*) as count,
  ARRAY_AGG(DISTINCT status) as statuses
FROM support_cases;

SELECT 
  'support_messages' as table_name,
  COUNT(*) as count,
  SUM(CASE WHEN contains_high_risk THEN 1 ELSE 0 END) as risk_flagged
FROM support_messages;

SELECT 
  'support_messages_audit_log' as table_name,
  COUNT(*) as count,
  ARRAY_AGG(DISTINCT action_type) as actions
FROM support_messages_audit_log;

-- ============================================================================
-- END SCHEMA
-- ============================================================================
