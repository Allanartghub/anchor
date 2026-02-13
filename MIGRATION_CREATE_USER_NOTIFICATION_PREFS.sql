-- Migration: Create user_notification_prefs table
CREATE TABLE IF NOT EXISTS user_notification_prefs (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    weekly_checkin_emails_enabled boolean NOT NULL DEFAULT false,
    support_message_emails_enabled boolean NOT NULL DEFAULT false,
    timezone text NOT NULL DEFAULT 'Europe/Dublin',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_user_notification_prefs_user_id ON user_notification_prefs(user_id);
