-- Migration: Add notification fields to weekly_checkin_responses if needed
-- (Assumes weekly_checkin_responses already exists)
-- Add period_key for rolling 7-day logic if not present
ALTER TABLE weekly_checkin_responses
ADD COLUMN IF NOT EXISTS period_key TEXT;

-- Add completed_at as nullable for incomplete check-ins (if not already nullable)
ALTER TABLE weekly_checkin_responses
ALTER COLUMN completed_at DROP NOT NULL;

-- Add index for notification queries
CREATE INDEX IF NOT EXISTS idx_weekly_checkin_responses_user_period ON weekly_checkin_responses(user_id, period_key);
