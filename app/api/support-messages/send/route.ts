/**
 * POST /api/support-messages/send
 * 
 * User sends a message in a support case.
 * System:
 * - Validates case ownership
 * - Detects high-risk language
 * - Logs message
 * - Audit trail
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    // Extract token from Authorization header
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
      
      // Proper base64 decoding with padding
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
      const decoded = JSON.parse(
        Buffer.from(padded, 'base64').toString('utf-8')
      );
      
      userId = decoded.sub;
      if (!userId) {
        throw new Error('No user ID in token');
      }
    } catch (parseError) {
      console.error('[SEND_MESSAGE] Token decode error:', parseError);
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { case_id, body } = await req.json();

    if (!case_id || !body) {
      return NextResponse.json(
        { error: 'Missing case_id or body' },
        { status: 400 }
      );
    }

    // Create service client (using Supabase key)
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify case ownership
    const { data: supportCase, error: caseError } = await serviceClient
      .from('support_cases')
      .select('id, user_id, status')
      .eq('id', case_id)
      .single();

    if (caseError || !supportCase) {
      console.error('[SEND_MESSAGE] Case lookup error:', caseError);
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      );
    }

    if (supportCase.user_id !== userId) {
      console.warn('[SEND_MESSAGE] Unauthorized - case ownership mismatch:', {
        userId,
        caseUserId: supportCase.user_id,
      });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    if (supportCase.status === 'closed' || supportCase.status === 'withdrawn') {
      return NextResponse.json(
        { error: 'Case is closed' },
        { status: 400 }
      );
    }

    // Insert message (risk detection happens via trigger)
    const { data: message, error: msgError } = await serviceClient
      .from('support_messages')
      .insert({
        case_id,
        sender_type: 'user',
        sender_id: userId,
        body,
        message_type: 'text',
      })
      .select()
      .single();

    if (msgError) {
      console.error('[SEND_MESSAGE] Insert error:', msgError);
      throw msgError;
    }

    // Log audit entry
    await serviceClient
      .from('support_messages_audit_log')
      .insert({
        case_id,
        action_type: 'message_sent',
        action_details: {
          sender_type: 'user',
          has_risk: message.contains_high_risk,
        },
      });

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error('[SEND_MESSAGE_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
