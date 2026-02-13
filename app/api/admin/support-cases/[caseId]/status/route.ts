/**
 * PATCH /api/admin/support-cases/[caseId]/status
 * 
 * Admin updates case status (assigned, scheduled, completed, closed, withdrawn).
 * System:
 * - Validates admin assignment
 * - Sets expiration if closing
 * - Audit trail
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getAdminServiceClient } from '@/lib/adminAuth';

export async function PATCH(
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

    const { status } = await req.json();
    const { caseId } = await params;
    const adminId = adminResult.auth_uid;

    if (!status || !['open', 'assigned', 'scheduled', 'completed', 'closed', 'withdrawn'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    const client = getAdminServiceClient();

    // Get case and verify assignment or allow unassigned cases
    const { data: supportCase, error: caseError } = await client
      .from('support_cases')
      .select('id, assigned_to')
      .eq('id', caseId)
      .single();

    if (caseError || !supportCase) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      );
    }

    // Allow update if case is unassigned or assigned to this admin
    if (supportCase.assigned_to && supportCase.assigned_to !== adminId) {
      return NextResponse.json(
        { error: 'Case assigned to another admin' },
        { status: 403 }
      );
    }

    // Auto-assign case if updating status and currently unassigned
    if (!supportCase.assigned_to) {
      await client
        .from('support_cases')
        .update({ assigned_to: adminId })
        .eq('id', caseId);
      
      console.log('[STATUS_UPDATE] Auto-assigned case to admin:', {
        caseId,
        adminId,
      });
    }

    // Prepare update object
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    // If closing, set expiration
    if (status === 'closed') {
      updateData.completed_at = new Date().toISOString();
      updateData.expires_at = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    }

    // Update case
    const { data: updatedCase, error: updateError } = await client
      .from('support_cases')
      .update(updateData)
      .eq('id', caseId)
      .select()
      .single();

    if (updateError) {
      console.error('[CASE_UPDATE_ERROR]', updateError);
      throw updateError;
    }

    // Log audit entry
    await client
      .from('support_messages_audit_log')
      .insert({
        case_id: caseId,
        admin_user_id: adminId,
        action_type: `case_${status}`,
        action_details: {
          from_status: supportCase.assigned_to ? 'assigned' : 'open',
          to_status: status,
        },
      });

    return NextResponse.json({
      success: true,
      case: updatedCase,
    });
  } catch (error) {
    console.error('[CASE_STATUS_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to update case status' },
      { status: 500 }
    );
  }
}
