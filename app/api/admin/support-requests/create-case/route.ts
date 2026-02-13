/**
 * /api/admin/support-requests/create-case
 * 
 * Converts a support request into a support case so admin can message the student.
 * Creates a new support_case and links it to the original support_request.
 * 
 * Only admins can create cases from requests.
 * GDPR-compliant: Audited, consent-based.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getAdminServiceClient } from '@/lib/adminAuth';

export async function POST(req: NextRequest) {
  try {
    // Verify admin authentication
    const adminResult = await requireAdmin(req);
    
    if ('code' in adminResult) {
      return NextResponse.json(
        { error: adminResult.message },
        { status: adminResult.code === 'NO_SESSION' ? 401 : 403 }
      );
    }

    const body = await req.json();
    const { request_id, case_token, context, risk_tier } = body;

    console.log('[CREATE_CASE] Received request:', { request_id, case_token, risk_tier });

    if (!request_id || !case_token) {
      return NextResponse.json(
        { error: 'Missing required fields: request_id, case_token' },
        { status: 400 }
      );
    }

    const client = getAdminServiceClient();

    // Step 1: Get the support request to find the user
    console.log('[CREATE_CASE] Querying support_requests with id:', request_id);
    
    const { data: supportRequest, error: requestError } = await client
      .from('support_requests')
      .select('id, user_id, institution_id, consent_record_id, created_at')
      .eq('id', request_id)
      .single();

    console.log('[CREATE_CASE] Query result:', { supportRequest, requestError });

    if (requestError) {
      console.error('[CREATE_CASE] Error querying support request:', requestError);
      return NextResponse.json(
        { error: `Database error: ${requestError.message}` },
        { status: 500 }
      );
    }

    if (!supportRequest) {
      console.error('[CREATE_CASE] Support request not found for id:', request_id);
      return NextResponse.json(
        { error: 'Support request not found' },
        { status: 404 }
      );
    }

    console.log('[CREATE_CASE] Found support request:', supportRequest);

    // Get consent details if available
    let consentVersion = '1.0';
    let consentTimestamp = new Date().toISOString();
    
    if (supportRequest.consent_record_id) {
      const { data: consentRecord } = await client
        .from('consent_records')
        .select('consent_version, granted_at')
        .eq('id', supportRequest.consent_record_id)
        .single();
      
      if (consentRecord) {
        consentVersion = consentRecord.consent_version || '1.0';
        consentTimestamp = consentRecord.granted_at || new Date().toISOString();
      }
    }

    // Step 2: Create a new support case
    const { data: newCase, error: caseError } = await client
      .from('support_cases')
      .insert({
        user_id: supportRequest.user_id,
        institution_id: supportRequest.institution_id,
        status: 'open',
        requested_channel: 'contact_me',
        consent_record_id: supportRequest.consent_record_id,
        consent_version: consentVersion,
        consent_timestamp: consentTimestamp,
        risk_tier: risk_tier || 0,
        assigned_to: adminResult.auth_uid, // Auto-assign to the admin creating the case
      })
      .select('id')
      .single();

    if (caseError || !newCase) {
      console.error('[CREATE_CASE] Error creating case:', caseError);
      return NextResponse.json(
        { error: 'Failed to create support case' },
        { status: 500 }
      );
    }

    console.log('[CREATE_CASE] Created support case:', newCase.id);

    // Step 3: Update support request with link to case
    try {
      await client
        .from('support_requests')
        .update({ 
          case_id: newCase.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', request_id);
      
      console.log('[CREATE_CASE] Updated support_request with case_id');
    } catch (err) {
      console.warn('[CREATE_CASE] Warning updating support_request:', err);
      // Don't fail if this fails - case was created successfully
    }

    // Step 4: Audit log
    try {
      await client.from('admin_audit_log').insert({
        admin_user_id: adminResult.auth_uid,
        action_type: 'create_case_from_request',
        resource_type: 'support_request',
        action_details: {
          request_id,
          case_id: newCase.id,
          case_token,
          context_excerpt: context,
        },
      });
    } catch (auditError) {
      console.warn('[CREATE_CASE] Audit log error:', auditError);
      // Don't fail if audit logging fails
    }

    return NextResponse.json({
      success: true,
      case_id: newCase.id,
      message: 'Support case created successfully',
    });

  } catch (error: any) {
    console.error('[CREATE_CASE] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}
