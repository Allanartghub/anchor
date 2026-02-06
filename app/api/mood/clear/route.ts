import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// POST /api/mood/clear
// Delete all mood entries for the authenticated user
export async function POST(request: NextRequest) {
  try {
    // Get auth token from request headers
    const authToken = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!authToken) {
      console.error('[Mood Clear] No auth token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify token and get user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authToken);

    if (authError || !user?.id) {
      console.error('[Mood Clear] Auth failed:', authError?.message || 'No user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    console.log('[Mood Clear] User verified:', userId);

    // Create authenticated client
    const authedSupabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    });

    // Delete all mood entries for this user (RLS policy enforces auth.uid() = user_id)
    const { error: deleteError } = await authedSupabase
      .from('mood_entries')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('[Mood Clear] Delete failed:', deleteError);
      return NextResponse.json(
        { error: 'Failed to clear mood history' },
        { status: 500 }
      );
    }

    console.log('[Mood Clear] All mood entries deleted for user:', userId);
    return NextResponse.json({ success: true, message: 'Mood history cleared' });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Mood Clear] Error:', errorMsg);
    return NextResponse.json(
      { error: 'Failed to clear mood history', details: errorMsg },
      { status: 500 }
    );
  }
}
