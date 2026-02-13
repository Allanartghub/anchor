/**
 * GET /api/support-cases/[caseId]
 * 
 * Student-facing endpoint to fetch their support case + messages
 * Verifies ownership before returning data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await params;

    console.log('[STUDENT_CASE] Fetching case:', caseId);

    // Get authenticated user
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
      console.log('[STUDENT_CASE] User from JWT:', userId);
    } catch (parseError) {
      console.log('[STUDENT_CASE] Could not parse JWT:', (parseError as Error).message);
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Create service client for queries
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch the support case
    const { data: supportCase, error: caseError } = await serviceClient
      .from('support_cases')
      .select('*')
      .eq('id', caseId)
      .eq('user_id', userId)
      .single();

    if (caseError || !supportCase) {
      console.log('[STUDENT_CASE] Case not found or unauthorized:', caseError?.message);
      return NextResponse.json(
        { error: 'Support case not found' },
        { status: 404 }
      );
    }

    console.log('[STUDENT_CASE] Case found:', supportCase.id, 'Status:', supportCase.status);

    // Fetch messages (ordered ascending by created_at)
    const { data: messages, error: messagesError } = await serviceClient
      .from('support_messages')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('[STUDENT_CASE] Messages error:', messagesError.message);
      return NextResponse.json(
        { error: 'Failed to load messages' },
        { status: 500 }
      );
    }

    console.log('[STUDENT_CASE] Loaded', messages?.length || 0, 'messages');

    // Fetch SLA config for display
    const { data: slaConfig } = await serviceClient
      .from('support_sla_config')
      .select('*')
      .eq('institution_id', supportCase.institution_id)
      .single();

    return NextResponse.json({
      case: supportCase,
      messages: messages || [],
      slaConfig: slaConfig || {
        service_hours_display_text: 'Mon–Fri, 9 AM–5 PM',
        expected_response_window_display: 'within 1 working day',
      },
    });
  } catch (error) {
    console.error('[STUDENT_CASE_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
