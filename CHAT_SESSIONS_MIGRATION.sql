-- Migration: Add messages_json and has_risk_flag to existing chat_sessions table
-- Run this in Supabase SQL Editor

-- Add messages_json column (stores conversation for summary building)
ALTER TABLE chat_sessions 
ADD COLUMN IF NOT EXISTS messages_json JSONB DEFAULT '[]';

-- Add has_risk_flag column (tracks if risk phrases detected)
ALTER TABLE chat_sessions 
ADD COLUMN IF NOT EXISTS has_risk_flag BOOLEAN DEFAULT FALSE;

-- Verify columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'chat_sessions' 
  AND column_name IN ('messages_json', 'has_risk_flag');
