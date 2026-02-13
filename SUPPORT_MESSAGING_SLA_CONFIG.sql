/**
 * SUPPORT MESSAGING - INITIAL SLA CONFIGURATION
 * 
 * Run this in your Supabase SQL Editor after running:
 * 1. SUPPORT_MESSAGING_SCHEMA.sql
 * 2. SUPPORT_MESSAGING_RLS.sql
 */

-- Insert SLA configuration for National College of Ireland
INSERT INTO support_sla_config (
  institution_id,
  service_hours_start_time,
  service_hours_end_time,
  service_days_of_week,
  first_response_sla_hours,
  follow_up_sla_hours,
  has_emergency_protocol,
  emergency_escalation_contact,
  message_retention_days_after_closure,
  service_hours_display_text,
  not_monitored_24_7_display,
  expected_response_window_display
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',  -- NCE institution_id
  '09:00:00',                                 -- Service starts at 9 AM
  '17:00:00',                                 -- Service ends at 5 PM
  ARRAY[1, 2, 3, 4, 5],                      -- Mon-Fri only (1=Mon, 5=Fri)
  24,                                         -- First response within 24 hours
  48,                                         -- Follow-up within 48 hours
  true,                                       -- Has emergency protocol
  'wellbeing@nci.ie',                        -- Emergency contact
  90,                                         -- Retain messages 90 days after closure
  'Mon–Fri, 9 AM–5 PM',                      -- Display text for users
  true,                                       -- Show "not monitored 24/7"
  'within 1 working day'                     -- Expected response window
);

-- Verify it was inserted
SELECT * FROM support_sla_config 
WHERE institution_id = '550e8400-e29b-41d4-a716-446655440000';
