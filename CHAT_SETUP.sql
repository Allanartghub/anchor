
-- Chat Summaries Table
-- Stores only summary text and metadata (not full message history)
CREATE TABLE IF NOT EXISTS chat_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  mood_at_time VARCHAR(50) NOT NULL, -- mood_id reference
  message_count INTEGER DEFAULT 1,
  has_risk_flag BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS chat_summaries_user_id_idx ON chat_summaries(user_id);
CREATE INDEX IF NOT EXISTS chat_summaries_created_at_idx ON chat_summaries(created_at DESC);

-- Row-Level Security (RLS)
ALTER TABLE chat_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chat summaries"
  ON chat_summaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat summaries"
  ON chat_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat summaries"
  ON chat_summaries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat summaries"
  ON chat_summaries FOR DELETE
  USING (auth.uid() = user_id);

-- Grant permissions to anon role (for public signup)
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_summaries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_summaries TO authenticated;

-- Note on Conversation State:
-- For MVP, conversation state (message_count, session_mood, last_message_timestamp)
-- is stored in-memory on the client and is session-only (resets on page reload).
-- 
-- If persistent conversation state is needed later, create a conversation_state table:
-- CREATE TABLE IF NOT EXISTS conversation_state (
--   user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
--   session_mood VARCHAR(50),
--   last_message_timestamp TIMESTAMP DEFAULT NOW(),
--   message_count INTEGER DEFAULT 0,
--   updated_at TIMESTAMP DEFAULT NOW()
-- );
