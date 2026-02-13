import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }
  return { supabaseUrl, supabaseKey };
}

// POST /api/chat/clear
// Delete all chat sessions for the authenticated user
export async function POST(request: NextRequest) {
  try {
    const { supabaseUrl, supabaseKey } = getSupabaseConfig();
    const supabase = createClient(supabaseUrl, supabaseKey);
    // Get auth token from request headers
    const authToken = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!authToken) {
      console.error('[Chat Clear] No auth token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify token and get user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authToken);

    if (authError || !user?.id) {
      console.error('[Chat Clear] Auth failed:', authError?.message || 'No user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    console.log('[Chat Clear] User verified:', userId);

    // Create authenticated client
    const authedSupabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    });

    // Delete all chat sessions for this user (RLS policy enforces auth.uid() = user_id)
    const { error: deleteError } = await authedSupabase
      .from('chat_sessions')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('[Chat Clear] Delete failed:', deleteError);
      return NextResponse.json(
        { error: 'Failed to clear chat history' },
        { status: 500 }
      );
    }

    console.log('[Chat Clear] All chat sessions deleted for user:', userId);
    return NextResponse.json({ success: true, message: 'Chat history cleared' });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Chat Clear] Error:', errorMsg);
    return NextResponse.json(
      { error: 'Failed to clear chat history', details: errorMsg },
      { status: 500 }
    );
  }
}
