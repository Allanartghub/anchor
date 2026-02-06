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
// ============================================================================
// ANCHOR MVP: MENTAL LOAD FRAMEWORK
// ============================================================================

// Mental Load Domains (7 fixed, locked domains)
export const MENTAL_LOAD_DOMAINS = [
  { id: 'academic', label: 'Academic Load', emoji: '📚' },
  { id: 'financial', label: 'Financial Load', emoji: '💰' },
  { id: 'belonging', label: 'Belonging & Social Load', emoji: '🤝' },
  { id: 'administrative', label: 'Administrative & Immigration Load', emoji: '📋' },
  { id: 'worklife', label: 'Work–Life & Time Load', emoji: '⏰' },
  { id: 'health', label: 'Health & Energy Load', emoji: '💚' },
  { id: 'future', label: 'Future & Stability Load', emoji: '🎯' },
] as const;

export type MentalLoadDomainId = typeof MENTAL_LOAD_DOMAINS[number]['id'];

export interface MentalLoadDomain {
  id: MentalLoadDomainId;
  label: string;
  emoji: string;
  description: string;
  sort_order: number;
  created_at?: string;
}

// Load Intensity (dual scale: user-facing + system)
export type LoadIntensityLabel = 'Light' | 'Moderate' | 'Heavy';
export type LoadIntensityNumeric = 1 | 2 | 3 | 4 | 5;

export const LoadIntensityMap: Record<LoadIntensityLabel, LoadIntensityNumeric> = {
  'Light': 1,
  'Moderate': 3,
  'Heavy': 5,
};

// User Extended Profile (journey context)
export interface UsersExtended {
  id: string;
  user_id: string;
  semester_start: 'Early January' | 'Late January' | 'Early September' | 'Late September' | 'Other / Not sure';
  semester_position: 'Start' | 'Middle' | 'End';
  cohort_code: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Load Entry (primary interaction)
export interface LoadEntry {
  id: string;
  user_id: string;
  intensity_label: LoadIntensityLabel;
  intensity_numeric: LoadIntensityNumeric;
  reflection_text: string;
  week_number: number;
  semester_year: number;
  has_risk_flag: boolean;
  created_at: string;
  updated_at: string;
  // Denormalized domains (joined from load_domain_selections)
  domains?: MentalLoadDomainId[];
}

// Load Domain Selection (many-to-many)
export interface LoadDomainSelection {
  id: string;
  load_entry_id: string;
  domain_id: MentalLoadDomainId;
  is_primary: boolean;
  created_at: string;
}

// Weekly Check-In Response (structured continuity)
export interface WeeklyCheckinResponse {
  id: string;
  user_id: string;
  week_number: number;
  semester_year: number;
  completed_at: string;
  primary_domain_id: MentalLoadDomainId | null;
  secondary_domain_id: MentalLoadDomainId | null;
  intensity_label: LoadIntensityLabel;
  intensity_numeric: LoadIntensityNumeric;
  structured_prompt: string;
  response_text: string;
  suggested_action: string | null;
  created_at: string;
  updated_at: string;
}

// Institutional Aggregates (cohort analytics, no PII)
export interface InstitutionalAggregate {
  id: string;
  cohort_code: string;
  week_number: number;
  semester_year: number;
  domain_id: MentalLoadDomainId;
  avg_intensity_numeric: number;
  median_intensity_numeric: number;
  sample_size: number;
  intensity_delta: number | null;
  created_at: string;
}

// ============================================================================
// EXISTING TYPES (Kept for backward compatibility)
// ============================================================================
// Mood entry (HIDDEN IN PRIMARY UI - kept for optional snapshot view only)
export interface MoodEntry {
  id: string;
  user_id: string;
  created_at: string;
  mood_id: string;
  text: string | null;
}

// Mood options (NOT USED IN PRIMARY FLOW)
export interface Mood {
  id: string;
  emoji: string;
  label: string;
}

export const MOODS_DEPRECATED: Mood[] = [
  { id: 'calm', emoji: '😌', label: 'Calm' },
  { id: 'okay', emoji: '🙂', label: 'Okay' },
  { id: 'stressed', emoji: '😰', label: 'Stressed' },
  { id: 'low', emoji: '😔', label: 'Low' },
  { id: 'angry', emoji: '😠', label: 'Angry' },
  { id: 'overwhelmed', emoji: '🌪️', label: 'Overwhelmed' },
];

// Chat Session (repurposed - secondary, optional)
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
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
  messages_json?: any;
  has_risk_flag: boolean;
    domain_context?: MentalLoadDomainId | null;
  created_at: string;
  updated_at: string;
}

export interface ChatSummary {
  id: string;
  user_id: string;
  summary_text: string;
  mood_at_time: string; // Kept for backward compat
  message_count: number;
    domain_context?: MentalLoadDomainId | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationState {
  user_id: string;
  session_mood: string | null; // mood_id from current session
  last_message_timestamp: string;
  message_count: number;
}
