/**
 * POST /api/admin/support-requests/auto-create-cases
 * 
 * Admin utility: Auto-create support cases from pending support requests with:
 * - High-risk or flagged content
 * - User consent to be contacted
 * - No case yet created
 * 
 * Returns count of cases created.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getAdminServiceClient } from '@/lib/adminAuth';

export async function POST(req: NextRequest) {
  try {
    const adminResult = await requireAdmin(req);

    if ('code' in adminResult) {
      return NextResponse.json(
        { error: adminResult.message },
        { status: adminResult.code === 'NO_SESSION' ? 401 : 403 }
      );
    }

    const client = getAdminServiceClient();

    console.log('[AUTO_CREATE_CASES] Finding pending support requests...');

    // Get all support requests that:
    // 1. Have a consent_record_id (user opted-in)
    // 2. Have contains_high_risk = true
    // 3. Don't have a case_id yet (not already converted)
    const { data: pendingRequests, error: fetchError } = await client
      .from('support_requests')
      .select('id, user_id, institution_id, consent_record_id, context_excerpt, contains_high_risk')
      .eq('contains_high_risk', true)
      .is('case_id', null)
      .not('consent_record_id', 'is', null)
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('[AUTO_CREATE_CASES] Query error:', fetchError);
      throw fetchError;
    }

    const pendingCount = pendingRequests?.length || 0;
    console.log('[AUTO_CREATE_CASES] Found', pendingCount, 'pending requests');

    if (pendingCount === 0) {
      return NextResponse.json({
        success: true,
        casesCreated: 0,
        message: 'No pending high-risk support requests to convert',
      });
    }

    // Create cases for each pending request
    let createdCount = 0;
    const createdCases = [];

    for (const request of pendingRequests || []) {
      try {
        // Determine risk tier based on context
        let riskTier = 1;
        if (request.context_excerpt) {
          const contextLower = request.context_excerpt.toLowerCase();
          if (contextLower.includes('suicide') || contextLower.includes('kill myself')) {
            riskTier = 3;
          } else if (contextLower.includes('harm') || contextLower.includes('self-harm')) {
            riskTier = 2;
          }
        }

        // Create support case
        const { data: newCase, error: caseError } = await client
          .from('support_cases')
          .insert({
            user_id: request.user_id,
            institution_id: request.institution_id,
            status: 'open',
            requested_channel: 'auto_flagged',
            consent_record_id: request.consent_record_id,
            consent_version: '1.0',
            consent_timestamp: new Date().toISOString(),
            risk_tier: riskTier,
            assigned_to: null, // Unassigned; admin picks up from inbox
          })
          .select('id')
          .single();

        if (caseError || !newCase) {
          console.error('[AUTO_CREATE_CASES] Error creating case for request', request.id, caseError);
          continue;
        }

        // Link request to case
        await client
          .from('support_requests')
          .update({
            case_id: newCase.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', request.id);

        createdCount++;
        createdCases.push({
          requestId: request.id,
          caseId: newCase.id,
          riskTier,
        });

        console.log('[AUTO_CREATE_CASES] Created case', newCase.id, 'from request', request.id);
      } catch (err) {
        console.error('[AUTO_CREATE_CASES] Error processing request', request.id, err);
      }
    }

    // Audit log
    try {
      await client.from('admin_audit_log').insert({
        admin_user_id: adminResult.auth_uid,
        action_type: 'auto_create_cases_from_requests',
        resource_type: 'support_request',
        action_details: {
          count: createdCount,
          cases: createdCases,
        },
      });
    } catch (auditErr) {
      console.warn('[AUTO_CREATE_CASES] Audit log error:', auditErr);
    }

    return NextResponse.json({
      success: true,
      casesCreated: createdCount,
      message: `Auto-created ${createdCount} support case${createdCount === 1 ? '' : 's'} from flagged requests`,
      caseIds: createdCases,
    });
  } catch (error: any) {
    console.error('[AUTO_CREATE_CASES] Error:', error);
    return NextResponse.json(
      { error: 'Failed to auto-create cases: ' + error.message },
      { status: 500 }
    );
  }
}
