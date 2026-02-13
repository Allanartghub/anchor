/**
 * GET /api/student/support-cases
 * 
 * Fetch all active support cases for the authenticated student
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  try {
    console.log('[STUDENT_CASES] Fetching active cases');

    // Get authenticated user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);

    // Decode JWT to get user ID
    let userId: string;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }
      const decoded = JSON.parse(
        Buffer.from(parts[1], 'base64').toString('utf-8')
      );
      userId = decoded.sub;
      console.log('[STUDENT_CASES] User from JWT:', userId);
    } catch (parseError) {
      console.log('[STUDENT_CASES] Could not parse JWT:', (parseError as Error).message);
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Create service client
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch active support cases for this student
    const { data: cases, error: casesError } = await serviceClient
      .from('support_cases')
      .select('id, status, created_at, first_response_at, requested_channel, risk_tier')
      .eq('user_id', userId)
      .in('status', ['open', 'assigned', 'scheduled', 'completed'])
      .order('created_at', { ascending: false });

    if (casesError) {
      console.error('[STUDENT_CASES] Error:', casesError.message);
      return NextResponse.json(
        { error: 'Failed to load cases' },
        { status: 500 }
      );
    }

    console.log('[STUDENT_CASES] Found', cases?.length || 0, 'active cases');

    return NextResponse.json({
      cases: cases || [],
    });
  } catch (error) {
    console.error('[STUDENT_CASES_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
