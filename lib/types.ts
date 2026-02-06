// User types (from Supabase Auth)
export interface User {
  id: string;
  email: string;
  created_at: string;
}

// Consent record
export interface Consent {
  id: string;
  user_id: string;
  privacy_accepted_at: string | null;
  disclaimer_accepted_at: string | null;
  crisis_disclosure_accepted_at: string | null;
  version: number;
  created_at?: string;
}

// Mood entry
export interface MoodEntry {
  id: string;
  user_id: string;
  created_at: string;
  mood_id: string;
  text: string | null;
}

// Mood options
export interface Mood {
  id: string;
  emoji: string;
  label: string;
}

export const MOODS: Mood[] = [
  { id: 'calm', emoji: '😌', label: 'Calm' },
  { id: 'okay', emoji: '🙂', label: 'Okay' },
  { id: 'stressed', emoji: '😰', label: 'Stressed' },
  { id: 'low', emoji: '😔', label: 'Low' },
  { id: 'angry', emoji: '😠', label: 'Angry' },
  { id: 'overwhelmed', emoji: '🌪️', label: 'Overwhelmed' },
];

// Chat types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface ChatSummary {
  id: string;
  user_id: string;
  summary_text: string;
  mood_at_time: string; // mood_id
  message_count: number;
  has_risk_flag: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  started_at: string;
  last_message_at: string;
  ended_at: string | null;
  message_count: number;
  summary_text: string;
  session_title: string;
  mood_at_start: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationState {
  user_id: string;
  session_mood: string | null; // mood_id from current session
  last_message_timestamp: string;
  message_count: number;
}
