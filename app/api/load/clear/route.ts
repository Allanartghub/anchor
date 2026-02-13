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

// POST /api/load/clear
// Delete all load entries for the authenticated user
export async function POST(request: NextRequest) {
  try {
    const { supabaseUrl, supabaseKey } = getSupabaseConfig();
    const supabase = createClient(supabaseUrl, supabaseKey);
    const authToken = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!authToken) {
      console.error('[Load Clear] No auth token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authToken);

    if (authError || !user?.id) {
      console.error('[Load Clear] Auth failed:', authError?.message || 'No user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    const authedSupabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    });

    const { error: deleteError } = await authedSupabase
      .from('load_entries')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('[Load Clear] Delete failed:', deleteError);
      return NextResponse.json(
        { error: 'Failed to clear load entries' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Load entries cleared' });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Load Clear] Error:', errorMsg);
    return NextResponse.json(
      { error: 'Failed to clear load entries', details: errorMsg },
      { status: 500 }
    );
  }
}
