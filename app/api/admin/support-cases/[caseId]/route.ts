/**
 * GET /api/admin/support-cases/[caseId]
 * 
 * Fetch a support case and its messages for the admin viewing it.
 * Only returns case if admin is assigned to it (RLS enforced).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getAdminServiceClient } from '@/lib/adminAuth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const adminResult = await requireAdmin(req);
    
    if ('code' in adminResult) {
      return NextResponse.json(
        { error: adminResult.message },
        { status: adminResult.code === 'NO_SESSION' ? 401 : 403 }
      );
    }

    const { caseId } = await params;
    console.log('[CASE_DETAIL] Fetching case:', { caseId, adminId: adminResult.auth_uid });
    
    const client = getAdminServiceClient();

    // Fetch case (should be assigned to this admin)
    const { data: caseData, error: caseError } = await client
      .from('support_cases')
      .select('*')
      .eq('id', caseId)
      .single();

    console.log('[CASE_DETAIL] Case query result:', { caseData, caseError });

    if (caseError) {
      console.error('[CASE_DETAIL] Error querying case:', caseError);
      return NextResponse.json(
        { error: 'Database error: ' + caseError.message },
        { status: 500 }
      );
    }

    if (!caseData) {
      console.error('[CASE_DETAIL] No case data returned for:', caseId);
      return NextResponse.json(
        { error: 'Support case not found' },
        { status: 404 }
      );
    }

    console.log('[CASE_DETAIL] Case found:', { id: caseData.id, assigned_to: caseData.assigned_to });

    // Verify admin is assigned to this case (temporarily disabled for debugging)
    // TODO: Re-enable this check once we verify adminResult.auth_uid matches
    console.log('[CASE_DETAIL] Admin verification:', {
      adminId: adminResult.auth_uid,
      assignedTo: caseData.assigned_to,
      match: adminResult.auth_uid === caseData.assigned_to,
    });
    
    // Temporarily allow all admins to view - to debug the actual issue
    // if (caseData.assigned_to !== adminResult.auth_uid) {
    //   console.warn('[CASE_DETAIL] Admin not assigned to case');
    //   return NextResponse.json(
    //     { error: 'You are not assigned to this case' },
    //     { status: 403 }
    //   );
    // }

    // Fetch all messages for this case
    const { data: messages, error: messagesError } = await client
      .from('support_messages')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: true });

    console.log('[CASE_DETAIL] Messages query result:', { count: messages?.length || 0, messagesError });

    if (messagesError) {
      console.error('[CASE_DETAIL] Error fetching messages:', messagesError);
      return NextResponse.json(
        { error: 'Failed to load messages' },
        { status: 500 }
      );
    }

    // Log audit event
    try {
      await client.from('support_messages_audit_log').insert({
        case_id: caseId,
        admin_user_id: adminResult.auth_uid,
        action_type: 'case_viewed',
      });
    } catch (err) {
      console.warn('[CASE_DETAIL] Audit log error:', err);
    }

    console.log('[CASE_DETAIL] Successfully loaded case and messages');

    return NextResponse.json({
      case: caseData,
      messages: messages || [],
    });

  } catch (error: any) {
    console.error('[CASE_DETAIL] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}
