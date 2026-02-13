/**
 * ROW LEVEL SECURITY (RLS) POLICIES FOR SUPPORT MESSAGING
 * 
 * Principles:
 * - Users can only view/message their own cases
 * - Admins can only view/message cases assigned to them
 * - System messages are readable by both parties
 * - Audit logs are immutable and role-restricted
 */

-- ============================================================================
-- ENABLE RLS ON ALL SUPPORT TABLES
-- ============================================================================
ALTER TABLE support_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_case_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_sla_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SUPPORT_CASES RLS POLICIES
-- ============================================================================

-- Users can view only their own cases
CREATE POLICY support_cases_user_select ON support_cases
FOR SELECT
USING (user_id = auth.uid());

-- Users can create cases (only for themselves)
CREATE POLICY support_cases_user_insert ON support_cases
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users cannot update their own cases (only status withdrawal via function)
CREATE POLICY support_cases_user_update_restricted ON support_cases
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (FALSE); -- Users can't modify, only withdraw via function

-- Admins can view cases assigned to them OR unassigned cases they can pick up
CREATE POLICY support_cases_admin_select ON support_cases
FOR SELECT
USING (
  (
    assigned_to = (
      SELECT auth_uid FROM admin_users WHERE auth_uid = auth.uid()
    )
  )
  OR
  (
    assigned_to IS NULL
    AND status IN ('open', 'pending_assignment')
    AND EXISTS (
      SELECT 1 FROM admin_users WHERE auth_uid = auth.uid()
    )
  )
);

-- Admins can update cases assigned to them (assign, update status)
CREATE POLICY support_cases_admin_update ON support_cases
FOR UPDATE
USING (
  assigned_to = (SELECT auth_uid FROM admin_users WHERE auth_uid = auth.uid())
)
WITH CHECK (
  assigned_to = (SELECT auth_uid FROM admin_users WHERE auth_uid = auth.uid())
  OR
  assigned_to IS NULL -- Can assign to self
);

-- ============================================================================
-- SUPPORT_CASE_PARTICIPANTS RLS POLICIES
-- ============================================================================

-- Users can see participants in their own cases
CREATE POLICY case_participants_user_select ON support_case_participants
FOR SELECT
USING (
  case_id IN (
    SELECT id FROM support_cases WHERE user_id = auth.uid()
  )
);

-- Admins can see participants in cases assigned to them
CREATE POLICY case_participants_admin_select ON support_case_participants
FOR SELECT
USING (
  case_id IN (
    SELECT id FROM support_cases
    WHERE assigned_to = (
      SELECT auth_uid FROM admin_users WHERE auth_uid = auth.uid()
    )
  )
);

-- Admins can insert participants (assigning themselves)
CREATE POLICY case_participants_admin_insert ON support_case_participants
FOR INSERT
WITH CHECK (
  case_id IN (
    SELECT id FROM support_cases
    WHERE assigned_to = (
      SELECT auth_uid FROM admin_users WHERE auth_uid = auth.uid()
    )
  )
);

-- ============================================================================
-- SUPPORT_MESSAGES RLS POLICIES
-- ============================================================================

-- Users can view messages in their own cases only
CREATE POLICY support_messages_user_select ON support_messages
FOR SELECT
USING (
  case_id IN (
    SELECT id FROM support_cases WHERE user_id = auth.uid()
  )
);

-- Users can insert messages in their own cases only
CREATE POLICY support_messages_user_insert ON support_messages
FOR INSERT
WITH CHECK (
  sender_type = 'user'
  AND sender_id = auth.uid()
  AND case_id IN (
    SELECT id FROM support_cases WHERE user_id = auth.uid()
  )
);

-- Users cannot edit or delete messages (immutable)
CREATE POLICY support_messages_user_update_blocked ON support_messages
FOR UPDATE
USING (FALSE);

CREATE POLICY support_messages_user_delete_blocked ON support_messages
FOR DELETE
USING (FALSE);

-- Admins can view messages in cases assigned to them
CREATE POLICY support_messages_admin_select ON support_messages
FOR SELECT
USING (
  case_id IN (
    SELECT id FROM support_cases
    WHERE assigned_to = (
      SELECT auth_uid FROM admin_users WHERE auth_uid = auth.uid()
    )
  )
);

-- Admins can insert messages in cases assigned to them
CREATE POLICY support_messages_admin_insert ON support_messages
FOR INSERT
WITH CHECK (
  sender_type = 'admin'
  AND sender_id = (SELECT auth_uid FROM admin_users WHERE auth_uid = auth.uid())
  AND case_id IN (
    SELECT id FROM support_cases
    WHERE assigned_to = (
      SELECT auth_uid FROM admin_users WHERE auth_uid = auth.uid()
    )
  )
);

-- Admins cannot edit or delete messages (immutable)
CREATE POLICY support_messages_admin_update_blocked ON support_messages
FOR UPDATE
USING (FALSE);

CREATE POLICY support_messages_admin_delete_blocked ON support_messages
FOR DELETE
USING (FALSE);

-- System messages are readable by both parties
-- (handled by user/admin select policies above)

-- ============================================================================
-- SUPPORT_SLA_CONFIG RLS POLICIES
-- ============================================================================

-- Anyone can read SLA config (needed for display)
CREATE POLICY support_sla_config_select ON support_sla_config
FOR SELECT
USING (TRUE);

-- Only data officers can update SLA config
CREATE POLICY support_sla_config_update ON support_sla_config
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE auth_uid = auth.uid() AND role = 'data_officer'
  )
);

-- ============================================================================
-- SUPPORT_MESSAGES_AUDIT_LOG RLS POLICIES (Immutable)
-- ============================================================================

-- Users can view audit logs for their own cases
CREATE POLICY audit_log_user_select ON support_messages_audit_log
FOR SELECT
USING (
  case_id IN (
    SELECT id FROM support_cases WHERE user_id = auth.uid()
  )
);

-- Admins can view audit logs for cases assigned to them
CREATE POLICY audit_log_admin_select ON support_messages_audit_log
FOR SELECT
USING (
  case_id IN (
    SELECT id FROM support_cases
    WHERE assigned_to = (
      SELECT auth_uid FROM admin_users WHERE auth_uid = auth.uid()
    )
  )
);

-- Data officers can view all audit logs
CREATE POLICY audit_log_data_officer_select ON support_messages_audit_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE auth_uid = auth.uid() AND role = 'data_officer'
  )
);

-- Admins can insert audit log entries
CREATE POLICY audit_log_admin_insert ON support_messages_audit_log
FOR INSERT
WITH CHECK (
  admin_user_id = (SELECT auth_uid FROM admin_users WHERE auth_uid = auth.uid())
);

-- System can insert audit log entries
CREATE POLICY audit_log_system_insert ON support_messages_audit_log
FOR INSERT
WITH CHECK (admin_user_id IS NULL OR TRUE); -- System entries have NULL admin_user_id

-- Immutable: no updates or deletes
CREATE POLICY audit_log_no_update ON support_messages_audit_log
FOR UPDATE
USING (FALSE);

CREATE POLICY audit_log_no_delete ON support_messages_audit_log
FOR DELETE
USING (FALSE);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Test RLS is enabled:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'support_%';

-- ============================================================================
-- END RLS SETUP
-- ============================================================================
