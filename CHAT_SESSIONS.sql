-- Chat Sessions Table
-- Stores per-session summaries (no full transcripts)
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ NULL,
  message_count INT NOT NULL DEFAULT 0,
  summary_text TEXT NOT NULL DEFAULT '',
  session_title VARCHAR(255) NOT NULL DEFAULT 'Chat Session',
  mood_at_start TEXT NULL,
  messages_json JSONB DEFAULT '[]',
  has_risk_flag BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_sessions_user_id_idx ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS chat_sessions_started_at_idx ON chat_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS chat_sessions_last_message_at_idx ON chat_sessions(last_message_at DESC);

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
-- Backfill session_title for existing sessions
-- Generates human-readable titles based on started_at and mood_at_start
UPDATE chat_sessions
SET session_title = CASE
  WHEN started_at::DATE = CURRENT_DATE THEN
    'Today · ' || COALESCE(mood_at_start, 'Session')
  WHEN started_at::DATE = CURRENT_DATE - INTERVAL '1 day' THEN
    'Yesterday · ' || COALESCE(mood_at_start, 'Session')
  ELSE
    TO_CHAR(started_at, 'Mon DD') || ' · ' || COALESCE(mood_at_start, 'Session')
END
WHERE session_title = 'Chat Session' OR session_title = '';