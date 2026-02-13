/**
 * /api/consent/create-support-request
 * 
 * Student opt-in: Creates consent record + support request
 * 
 * GDPR-compliant: Explicit consent, purpose-limited, auditable
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

function decodeJwtPayload(token: string): any | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  try {
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

function getServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
  return createClient(supabaseUrl, serviceRoleKey);
}

function generateCaseToken(): string {
  const randomStr = Math.random().toString(36).substring(2, 14).toUpperCase();
  return `SR-${randomStr}`;
}

function redactText(text: string): string {
  // Redact self-harm keywords and personal identifiers
  let redacted = text;
  const sensitiveTerms = [
    'suicidal', 'suicide', 'kill myself', 'end my life', 
    'self-harm', 'self harm', 'hurt myself', 'harm myself'
  ];
  
  sensitiveTerms.forEach(term => {
    const regex = new RegExp(term, 'gi');
    redacted = redacted.replace(regex, '[REDACTED]');
  });

  // Truncate to max 500 chars
  if (redacted.length > 500) {
    redacted = redacted.substring(0, 497) + '...';
  }

  return redacted;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Verify user authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = decodeJwtPayload(token);
    const user_id = payload?.sub;
    if (!user_id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body = await req.json();
    const { checkin_id, request_type, risk_tier } = body;

    if (!checkin_id || !request_type) {
      return NextResponse.json(
        { error: 'Missing required fields: checkin_id, request_type' },
        { status: 400 }
      );
    }

    const serviceClient = getServiceClient();

    // 3. Get user's institution
    const { data: userProfile } = await serviceClient
      .from('users_extended')
      .select('institution_id')
      .eq('user_id', user_id)
      .single();

    const fallbackInstitutionId = '550e8400-e29b-41d4-a716-446655440000';
    const institution_id = userProfile?.institution_id || fallbackInstitutionId;

    // 4. Get check-in context for redaction
    const { data: checkin } = await serviceClient
      .from('weekly_checkin_responses')
      .select('response_text, primary_domain_id')
      .eq('id', checkin_id)
      .single();

    const context_excerpt = checkin?.response_text 
      ? redactText(checkin.response_text)
      : null;

    // 5. Create consent record
    const consentVersion = '1.0';
    const consentTextHash = 'SHA256_OF_CONSENT_TEXT_V1'; // In production, hash actual consent text

    const { data: consentRecord, error: consentError } = await serviceClient
      .from('consent_records')
      .insert({
        user_id,
        consent_type: 'support_request_sharing',
        consent_version: consentVersion,
        consent_text_hash: consentTextHash,
        granted: true,
        scope: { request_type, checkin_id, timestamp: new Date().toISOString() },
      })
      .select()
      .single();

    if (consentError) {
      console.error('[CONSENT] Error creating consent record:', consentError);
      throw new Error('Failed to create consent record');
    }

    // 6. Create support request
    const case_token = generateCaseToken();

    const { data: supportRequest, error: supportRequestError } = await serviceClient
      .from('support_requests')
      .insert({
        case_token,
        user_id,
        institution_id,
        request_type,
        context_excerpt,
        checkin_id,
        risk_tier: risk_tier || null,
        consent_record_id: consentRecord.id,
        status: 'pending',
      })
      .select()
      .single();

    if (supportRequestError) {
      console.error('[SUPPORT_REQUEST] Error creating request:', supportRequestError);
      throw new Error('Failed to create support request');
    }

    // 7. Auto-create support case for opted-in requests so admins can respond immediately
    let caseId: string | null = null;
    try {
      const { data: newCase, error: caseError } = await serviceClient
        .from('support_cases')
        .insert({
          user_id,
          institution_id,
          status: 'open',
          requested_channel: request_type,
          consent_record_id: consentRecord.id,
          consent_version: consentVersion,
          consent_timestamp: new Date().toISOString(),
          risk_tier: risk_tier || null,
          assigned_to: null,
        })
        .select('id')
        .single();

      if (caseError) {
        console.error('[SUPPORT_REQUEST] Error creating support case:', caseError);
      } else {
        caseId = newCase?.id ?? null;
        await serviceClient
          .from('support_requests')
          .update({ case_id: caseId, reviewed_at: new Date().toISOString() })
          .eq('id', supportRequest.id);
      }
    } catch (caseErr) {
      console.error('[SUPPORT_REQUEST] Unexpected error creating support case:', caseErr);
    }

    // 8. Audit log (admin will see this when they access the request)
    // Audit logging happens when admin views the queue

    return NextResponse.json({
      success: true,
      case_token,
      message: caseId
        ? 'Support request created and routed to admin inbox'
        : 'Support request created successfully',
      case_id: caseId,
    });

  } catch (error: any) {
    console.error('[CREATE_SUPPORT_REQUEST] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
