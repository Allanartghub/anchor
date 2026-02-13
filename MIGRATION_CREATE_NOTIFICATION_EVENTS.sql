-- Migration: Create notification_events table
CREATE TYPE notification_event_type AS ENUM (
    'WEEKLY_REMINDER_1',
    'WEEKLY_REMINDER_2',
    'SUPPORT_REPLY'
);

CREATE TABLE IF NOT EXISTS notification_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type notification_event_type NOT NULL,
    period_key text,
    case_id uuid,
    sent_at timestamptz NOT NULL DEFAULT now(),
    sent_at_date date NOT NULL DEFAULT CURRENT_DATE,
    provider_message_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, type, period_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_events_user_id ON notification_events(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_events_type ON notification_events(type);
-- Unique index for support reply rate limiting (per day)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notification_events_support_reply_per_day
    ON notification_events (user_id, type, case_id, sent_at_date);
