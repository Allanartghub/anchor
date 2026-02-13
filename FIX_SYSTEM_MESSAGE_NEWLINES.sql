-- Fix System Message Newlines
-- Run this in Supabase SQL Editor to fix the \n appearing literally in auto-response messages

CREATE OR REPLACE FUNCTION auto_respond_new_case()
RETURNS TRIGGER AS $$
DECLARE
  v_message_body TEXT;
  v_sla_config RECORD;
  v_crisis_contacts TEXT;
BEGIN
  -- Get SLA config
  SELECT 
    expected_response_window_display,
    service_hours_display_text
  INTO v_sla_config
  FROM support_sla_config
  WHERE id = 1
  LIMIT 1;
  
  -- Fallback if no config exists
  IF NOT FOUND THEN
    v_sla_config.expected_response_window_display := 'within 1 working day';
    v_sla_config.service_hours_display_text := 'Mon–Fri, 9 AM–5 PM';
  END IF;
  
  -- Crisis contact info
  v_crisis_contacts := '🇮🇪 Samaritans Ireland: 116 123 (24/7) | 🇮🇪 Pieta House: 1800 247 247 | 🌍 Crisis Text: Text HELLO to 50808';
  
  -- Build auto-response message with proper escaped newlines
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the trigger exists and is connected
-- The trigger should already exist, but here's the command to recreate it if needed:
-- DROP TRIGGER IF EXISTS on_support_case_created ON support_cases;
-- CREATE TRIGGER on_support_case_created
--   AFTER INSERT ON support_cases
--   FOR EACH ROW
--   EXECUTE FUNCTION auto_respond_new_case();
