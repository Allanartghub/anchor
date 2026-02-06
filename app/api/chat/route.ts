import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callSereneAI, checkForRiskTriggers, getIrelandCrisisResources, generateSessionTitle } from '@/lib/ai';
import { getMicroSuggestion, getOfflineMessage } from '@/lib/microSuggestions';

// Create server-side Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// POST /api/chat
// Send a message to Anchor and get a response
// Also handles summary storage every 5 messages or ~5 minutes
export async function POST(request: NextRequest) {
  try {
    // Set a 30-second timeout for the entire request (allows HuggingFace to respond)
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000)
    );

    const requestPromise = handleChatRequest(request);
    return await Promise.race([requestPromise, timeoutPromise]);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Chat API] Error:', errorMsg);
    return NextResponse.json(
      { error: 'Failed to process message', details: errorMsg },
      { status: 500 }
    );
  }
}

async function handleChatRequest(request: NextRequest) {
  try {
    console.log('[Chat API Handler] Starting...');
    const { message, domainContext, session_id } = await request.json();
    console.log('[Chat API Handler] Received message:', message.substring(0, 50));
    console.log('[Chat API Handler] Session ID from client:', session_id || 'none');

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      console.error('[Chat API Handler] Empty message');
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get auth token from request headers (sent by client)
    const authToken = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!authToken) {
      console.error('[Chat API Handler] No auth token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify token and get user
    console.log('[Chat API Handler] Verifying auth token...');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authToken);

    if (authError || !user?.id) {
      console.error('[Chat API Handler] Auth failed:', authError?.message || 'No user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    console.log('[Chat API Handler] User verified:', userId);

    const authedSupabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    });

    const nowIso = new Date().toISOString();
    const cutoffIso = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // On EVERY request: Close any open stale sessions (5+ min inactive)
    await closeStaleSessions(authedSupabase, userId, cutoffIso);

    // If client sent session_id, validate it
    let session = null;
    if (session_id) {
      session = await getSessionById(authedSupabase, session_id, userId);
      // Validate: must exist, belong to user, be active, and within timeout window
      if (session && (!session.ended_at && session.last_message_at >= cutoffIso)) {
        console.log('[Chat API Handler] Continuing existing session:', session_id);
      } else {
        console.log('[Chat API Handler] Session invalid or expired, creating new');
        session = null;
      }
    }

    // If no valid session from client, create one
    // (Page reload clears session_id, so this creates new session on reload)
    if (!session) {
      session = await createSession(authedSupabase, userId, domainContext || null, nowIso);
      console.log('[Chat API Handler] Created new session:', session?.id);
    }

    if (!session) {
      console.error('[Chat API Handler] Failed to create or find chat session');
      return NextResponse.json({ error: 'Failed to create chat session' }, { status: 500 });
    }

    const nextMessageCount = (session.message_count || 0) + 1;
    await updateSessionActivity(authedSupabase, session.id, nextMessageCount, nowIso);
    session = {
      ...session,
      message_count: nextMessageCount,
      last_message_at: nowIso,
    };

    // Try to get AI response
    console.log('[Chat API Handler] Calling AI...');
    const aiResponse = await callSereneAI(message, domainContext);
    console.log('[Chat API Handler] AI response:', aiResponse.success ? 'success' : 'failed');

    let assistantMessage = '';
    let useFallback = false;

    if (aiResponse.success && aiResponse.message) {
      assistantMessage = aiResponse.message;
      console.log('[Chat API] AI response received successfully');
    } else {
      // AI unavailable - use offline fallback
      useFallback = true;
      const microSuggestion = getMicroSuggestion(domainContext || null);
      assistantMessage = `${getOfflineMessage()}\n\n💡 ${microSuggestion.text}`;
      console.log('[Chat API] Using offline fallback - AI service unavailable');
    }

    // Check for risk triggers in user message (improved detection for self-harm, self-hate)
    const userHasRiskFlag = checkForRiskTriggers(message);
    const assistantHasRiskFlag = checkForRiskTriggers(assistantMessage);
    const hasRiskFlag = userHasRiskFlag || assistantHasRiskFlag;

    // DEV LOGGING: Risk detection status
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Risk Detection] User message has risk flag:', userHasRiskFlag);
      console.log('[Risk Detection] Assistant response has risk flag:', assistantHasRiskFlag);
      console.log('[Risk Detection] Overall risk flag:', hasRiskFlag);
    }

    // If crisis detected, append Ireland crisis resources to the response message (unified message)
    if (hasRiskFlag && !useFallback) {
      const crisisResources = getIrelandCrisisResources();
      assistantMessage = `${assistantMessage}\n\n---\n\n${crisisResources}`;
      console.log('[Chat API] Crisis resources appended to message');
    }

    // Store messages in session for summary building
    const newMessages = session.messages_json || [];
    newMessages.push({
      role: 'user',
      content: message,
      timestamp: nowIso,
    });
    newMessages.push({
      role: 'assistant',
      content: assistantMessage,
      timestamp: nowIso,
    });

    const lastSummaryAt = session.updated_at || session.created_at || session.started_at;
    const lastSummaryMs = new Date(lastSummaryAt).getTime();
    const shouldUpdateSummary =
      nextMessageCount === 1 ||
      nextMessageCount % 5 === 0 ||
      hasRiskFlag ||
      Date.now() - lastSummaryMs >= 5 * 60 * 1000;

    if (shouldUpdateSummary) {
      console.log('[Chat API Handler] Updating summary...');
      const summaryText = await buildSessionSummary({
        messageCount: nextMessageCount,
        domainContext: session.domain_context,
        hasRiskFlag,
        messages: newMessages,
      });
      await updateSessionSummary(authedSupabase, session.id, summaryText, newMessages, hasRiskFlag, nowIso);
      console.log('[Chat API Handler] Summary updated');
      if (process.env.NODE_ENV !== 'production' && hasRiskFlag) {
        console.log('[Risk Detection] ⚠️ Risk flag set to TRUE in database for session:', session.id);
      }
    } else {
      // Update messages even if not rebuilding summary
      await updateSessionMessages(authedSupabase, session.id, newMessages, hasRiskFlag);
      if (process.env.NODE_ENV !== 'production' && hasRiskFlag) {
        console.log('[Risk Detection] ⚠️ Risk flag set to TRUE in database for session:', session.id);
      }
    }

    // Return response
    console.log('[Chat API Handler] Returning success response');
    return NextResponse.json({
      success: true,
      response: assistantMessage,
      usedFallback: useFallback,
      messageCount: nextMessageCount,
      summaryUpdated: shouldUpdateSummary,
      riskFlagRaised: hasRiskFlag,
      sessionId: session.id,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Chat API Handler] Error:', errorMsg);
    console.error('[Chat API Handler] Full error:', error);
    return NextResponse.json(
      { error: `Failed to process message: ${errorMsg}` },
      { status: 500 }
    );
  }
}

async function getSessionById(
  client: any,
  sessionId: string,
  userId: string
) {
  const { data, error } = await client
    .from('chat_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('[Chat Sessions] Get session by ID failed:', error);
    return null;
  }

  return data;
}

async function closeStaleSessions(
  client: any,
  userId: string,
  cutoffIso: string
) {
  const { data, error } = await client
    .from('chat_sessions')
    .select('id,last_message_at')
    .eq('user_id', userId)
    .is('ended_at', null)
    .lt('last_message_at', cutoffIso);

  if (error) {
    console.error('[Chat Sessions] Stale session lookup failed:', error);
    return;
  }

  if (!data || data.length === 0) return;

  await Promise.all(
    data.map((session: { id: string; last_message_at: string }) =>
      client
        .from('chat_sessions')
        .update({
          ended_at: session.last_message_at,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.id)
    )
  );
}

async function createSession(
  client: any,
  userId: string,
  domainContext: string | null,
  nowIso: string
) {
  const sessionTitle = generateSessionTitle(nowIso, domainContext);
  
  const { data, error } = await client
    .from('chat_sessions')
    .insert({
      user_id: userId,
      started_at: nowIso,
      last_message_at: nowIso,
      message_count: 0,
      summary_text: '',
      session_title: sessionTitle,
      mood_at_start: null,
      domain_context: domainContext,
      messages_json: [],
      has_risk_flag: false,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[Chat Sessions] Create session failed:', error);
    return null;
  }

  return data;
}

async function updateSessionActivity(
  client: any,
  sessionId: string,
  messageCount: number,
  nowIso: string
) {
  const { error } = await client
    .from('chat_sessions')
    .update({
      message_count: messageCount,
      last_message_at: nowIso,
    })
    .eq('id', sessionId);

  if (error) {
    console.error('[Chat Sessions] Activity update failed:', error);
  }
}

async function buildSessionSummary(input: {
  messageCount: number;
  domainContext: string | null;
  hasRiskFlag: boolean;
  messages: any[];
}) {
  const { messageCount, domainContext, hasRiskFlag, messages } = input;

  // If no messages, return placeholder
  if (!messages || messages.length === 0) {
    return 'Session summary: Chat session started. No messages exchanged yet.';
  }

  // Filter to ONLY user messages for summarization
  const userMessages = messages.filter((msg: any) => msg.role === 'user');
  
  if (userMessages.length === 0) {
    return 'Session in progress.';
  }

  // Build user-only transcript for AI summarization
  const userContent = userMessages
    .map((msg: any) => msg.content)
    .join('\n');

  console.log(`[Summary Builder] Creating summary from ${userMessages.length} user messages`);

  try {
    // Use AI to generate neutral summary of USER content only
    const aiResponse = await callSereneAI(
      `Summarize the user's session in 2-3 neutral sentences (max 300 characters). Describe what the user expressed or reflected on. Do NOT provide advice, reassurance, or crisis resources. Do NOT speak directly to the user. Do NOT include assistant responses. Write in third person describing the user's reflections.\n\nUser messages:\n${userContent}`,
      domainContext || undefined
    );

    if (aiResponse.success && aiResponse.message) {
      let summary = aiResponse.message.trim();
      // Cap at 400 characters as specified
      if (summary.length > 400) {
        summary = summary.slice(0, 397) + '...';
      }
      return summary;
    }
  } catch (error) {
    console.warn('[Summary Builder] AI summarization failed, using fallback');
  }

  // Fallback: Generate neutral summary from user messages
  let summary = '';
  
  if (domainContext) {
    summary = `The user focused on ${domainContext} load and `;
  } else {
    summary = 'The user ';
  }
  
  // Build neutral description based on user message count
  const hasMultipleTopics = userMessages.length > 3;
  
  if (hasMultipleTopics) {
    summary += 'reflected on multiple themes and pressures';
  } else {
    summary += 'shared a specific source of pressure';
  }
  
  summary += ` across ${userMessages.length} message${userMessages.length !== 1 ? 's' : ''}.`;

  // Cap at 400 characters
  if (summary.length > 400) {
    summary = summary.slice(0, 397) + '...';
  }

  return summary;
}

async function updateSessionSummary(
  client: any,
  sessionId: string,
  summaryText: string,
  messages: any[],
  hasRiskFlag: boolean,
  nowIso: string
) {
  const { error } = await client
    .from('chat_sessions')
    .update({
      summary_text: summaryText,
      messages_json: messages,
      has_risk_flag: hasRiskFlag,
      updated_at: nowIso,
    })
    .eq('id', sessionId);

  if (error) {
    console.error('[Chat Sessions] Summary update failed:', error);
  }
}

async function updateSessionMessages(
  client: any,
  sessionId: string,
  messages: any[],
  hasRiskFlag: boolean
) {
  const { error } = await client
    .from('chat_sessions')
    .update({
      messages_json: messages,
      has_risk_flag: hasRiskFlag,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) {
    console.error('[Chat Sessions] Message update failed:', error);
  }
}
