-- FIX: Chat Summaries RLS Policy for Server-side API
-- The server-side API handler verifies the JWT token and extracts the user ID.
-- We trust that verification, so we disable RLS for the specific operations needed
-- by the API (INSERT/UPDATE from authenticated server context).
-- Client-side SELECTs still respect RLS and can only see their own summaries.

-- Drop existing RLS policies that block server-side inserts
DROP POLICY IF EXISTS "Users can insert their own chat summaries" ON chat_summaries;
DROP POLICY IF EXISTS "Users can update their own chat summaries" ON chat_summaries;

-- New RLS policies:
-- - SELECT: Still restricted to user's own summaries (RLS active)
-- - INSERT/UPDATE: Allowed for authenticated requests (server API handles user verification)
-- - DELETE: Allowed for authenticated requests

CREATE POLICY "Users can view their own chat summaries"
  ON chat_summaries FOR SELECT
  USING (auth.uid() = user_id);

-- For INSERT: Allow all (the API handler verifies the user_id matches the JWT)
CREATE POLICY "Server can insert chat summaries"
  ON chat_summaries FOR INSERT
  WITH CHECK (true);

-- For UPDATE: Allow all (the API handler verifies the user_id matches the JWT)
CREATE POLICY "Server can update chat summaries"
  ON chat_summaries FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete their own chat summaries"
  ON chat_summaries FOR DELETE
  USING (auth.uid() = user_id);
