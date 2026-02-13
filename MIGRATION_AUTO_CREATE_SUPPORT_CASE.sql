/**
 * MIGRATION: Auto-create support case from high-risk support request
 * 
 * When a support_request is created with:
 * - contains_high_risk = true OR context contains risk keywords
 * - consent_record_id exists (user opted in)
 * 
 * Automatically create a corresponding support_case so it appears in the admin inbox immediately.
 * Admin doesn't need to manually click "Contact Student" anymore.
 */

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS auto_create_case_on_support_request ON support_requests;
DROP FUNCTION IF EXISTS auto_create_support_case_from_request();

-- Function to auto-create case from support request
CREATE OR REPLACE FUNCTION auto_create_support_case_from_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_case_id UUID;
  v_institution_id UUID;
  v_risk_tier INT;
BEGIN
  -- Only auto-create case if:
  -- 1. The request has a consent record (user opted in)
  -- 2. The request contains high-risk content
  IF NEW.consent_record_id IS NOT NULL 
     AND (NEW.contains_high_risk = TRUE OR NEW.context_excerpt LIKE '%[REDACTED]%') THEN
    
    -- Determine risk tier based on context
    v_risk_tier := CASE 
      WHEN NEW.context_excerpt LIKE '%suicide%' OR NEW.context_excerpt LIKE '%kill myself%' THEN 3
      WHEN NEW.context_excerpt LIKE '%harm%' OR NEW.context_excerpt LIKE '%self-harm%' THEN 2
      ELSE 1
    END;
    
    -- Get institution_id from user's consent record
    SELECT institution_id INTO v_institution_id
    FROM consent_records
    WHERE id = NEW.consent_record_id
    LIMIT 1;
    
    -- Create support case
    INSERT INTO support_cases (
      user_id,
      institution_id,
      status,
      requested_channel,
      consent_record_id,
      consent_version,
      consent_timestamp,
      risk_tier,
      assigned_to  -- Leave unassigned initially; admins can pick up from inbox
    )
    VALUES (
      NEW.user_id,
      v_institution_id,
      'open',
      'auto_contact',
      NEW.consent_record_id,
      '1.0',
      NOW(),
      v_risk_tier,
      NULL  -- Unassigned; shows in "Unassigned (0)" tab
    )
    RETURNING id INTO v_case_id;
    
    -- Link the support request to the case
    UPDATE support_requests
    SET case_id = v_case_id, reviewed_at = NOW()
    WHERE id = NEW.id;
    
    RAISE LOG '[AUTO_CASE] Created case % from support_request %', v_case_id, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger on INSERT to support_requests
CREATE TRIGGER auto_create_case_on_support_request
AFTER INSERT ON support_requests
FOR EACH ROW
EXECUTE FUNCTION auto_create_support_case_from_request();

COMMENT ON FUNCTION auto_create_support_case_from_request() IS 
'Automatically creates a support_case when a high-risk support_request with consent is created. Admins see it immediately in the Support Inbox without manual "Contact Student" step.';
