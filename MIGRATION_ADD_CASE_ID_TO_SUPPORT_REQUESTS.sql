/**
 * MIGRATION: Link support_requests to support_cases
 * 
 * Adds case_id column to support_requests so that when an admin
 * creates a support case from a request, they can be linked together.
 * 
 * This allows the support_request queue system to connect with the
 * full messaging system.
 */

-- Add case_id column to support_requests
ALTER TABLE support_requests 
ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES support_cases(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS support_requests_case_id_idx ON support_requests(case_id);

-- After this migration, admins can:
-- 1. Click "Contact Student" on a support_request
-- 2. This creates a support_case
-- 3. The support_request.case_id is set to point to that case
-- 4. Admin is redirected to /admin/support-inbox/[case_id] for messaging

-- Verify the change
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'support_requests' 
  AND column_name = 'case_id';
