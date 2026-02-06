/**
 * Centralized chat API client.
 * Handles authentication, token management, and all /api/chat requests.
 * Single source of truth for auth in chat interactions.
 */

import { supabase } from '@/lib/supabase';

export interface ChatRequestPayload {
  message: string;
  domainContext: string | null;
  session_id?: string | null;
}

export interface ChatResponse {
  success: boolean;
  response: string;
  usedFallback?: boolean;
  messageCount?: number;
  summaryUpdated?: boolean;
  riskFlagRaised?: boolean;
  sessionId?: string;
  error?: string;
}

/**
 * Sends a message to the chat API.
 * Automatically handles auth token retrieval and attachment.
 * 
 * @throws Error if user is not authenticated
 * @throws Error if API returns non-200 status
 */
export async function sendChatMessage(
  payload: ChatRequestPayload
): Promise<ChatResponse> {
  // Step 1: Get Supabase session and token
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(`Failed to get session: ${sessionError.message}`);
  }

  if (!session || !session.access_token) {
    throw new Error('Not authenticated. Please sign in to continue.');
  }

  const token = session.access_token;

  // Step 2: Call /api/chat with Bearer token
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  // Step 3: Handle response
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[ChatClient] API error (${response.status}):`, errorText);
    throw new Error(
      `Chat API error (${response.status}): ${errorText || 'Unknown error'}`
    );
  }

  const data: ChatResponse = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to process message');
  }

  return data;
}
