/**
 * POST /api/admin/support-cases/[caseId]/respond
 * 
 * Admin sends a response message in a support case.
 * System:
 * - Validates case assignment
 * - Updates first_response_at if first response
 * - Records admin action
 * - Audit trail with IP/User-Agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getAdminServiceClient } from '@/lib/adminAuth';
import { maybeSendSupportReplyNotification } from '@/lib/supportReplyNotificationJob';

export async function POST(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const adminResult = await requireAdmin(req);

    if ('code' in adminResult) {
      return NextResponse.json(
        { error: adminResult.message },
        { status: adminResult.code === 'NO_SESSION' ? 401 : 403 }
      );
    }

    const { caseId } = await params;
    const { body } = await req.json();

    if (!body || !body.trim()) {
      return NextResponse.json(
        { error: 'Message body required' },
        { status: 400 }
      );
    }

    console.log('[SEND_MESSAGE] Admin sending message:', {
      caseId,
      adminId: adminResult.auth_uid,
      messageLength: body.length,
    });

    const client = getAdminServiceClient();

    // Get case and check if unassigned or assigned to this admin
    const { data: supportCase, error: caseError } = await client
      .from('support_cases')
      .select('id, assigned_to, first_response_at, user_id, status')
      .eq('id', caseId)
      .single();

    if (caseError || !supportCase) {
      console.error('[SEND_MESSAGE] Case not found:', caseError);
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      );
    }

    // Auto-assign case to this admin if unassigned (first responder rule)
    const wasUnassigned = !supportCase.assigned_to;
    
    if (wasUnassigned) {
      console.log('[SEND_MESSAGE] Auto-assigning case to first responder:', {
        caseId,
        adminId: adminResult.auth_uid,
      });

      const { error: assignError } = await client
        .from('support_cases')
        .update({
          assigned_to: adminResult.auth_uid,
        })
        .eq('id', caseId);

      if (assignError) {
        console.error('[SEND_MESSAGE] Auto-assignment failed:', assignError);
        // Continue anyway - assignment is not critical to message delivery
      }

      // Update local supportCase object for subsequent logic
      supportCase.assigned_to = adminResult.auth_uid;
    } else if (supportCase.assigned_to !== adminResult.auth_uid) {
      // If already assigned to someone else, block access
      console.warn('[SEND_MESSAGE] Case assigned to another admin:', {
        adminId: adminResult.auth_uid,
        assignedTo: supportCase.assigned_to,
      });
      return NextResponse.json(
        { error: 'Case already assigned to another admin' },
        { status: 403 }
      );
    }

    // Insert message
    const { data: message, error: msgError } = await client
      .from('support_messages')
      .insert({
        case_id: caseId,
        sender_type: 'admin',
        sender_id: adminResult.auth_uid,
        body: body.trim(),
        message_type: 'text',
      })
      .select()
      .single();

    if (msgError) {
      console.error('[SEND_MESSAGE] Insert error:', msgError);
      return NextResponse.json(
        { error: 'Failed to send message' },
        { status: 500 }
      );
    }

    // Trigger support reply notification (push/email)
    try {
      await maybeSendSupportReplyNotification(supportCase.user_id, caseId);
    } catch (notifyErr) {
      console.warn('[SEND_MESSAGE] Notification error:', notifyErr);
    }

    // Update first_response_at and status if this is the first admin response
    if (!supportCase.first_response_at) {
      await client
        .from('support_cases')
        .update({
          first_response_at: new Date().toISOString(),
          status: 'assigned',
        })
        .eq('id', caseId);
    }

    // Log audit entry (with IP and User-Agent)
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || '';

    try {
      await client
        .from('support_messages_audit_log')
        .insert({
          case_id: caseId,
          admin_user_id: adminResult.auth_uid,
          action_type: 'message_sent',
          action_details: {
            sender_type: 'admin',
            user_id: supportCase.user_id,
          },
          ip_address: ip,
          user_agent: userAgent,
        });
    } catch (auditErr) {
      console.warn('[SEND_MESSAGE] Audit log error:', auditErr);
    }

    console.log('[SEND_MESSAGE] Message sent successfully:', message.id);

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error: any) {
    console.error('[SEND_MESSAGE] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to send message: ' + error.message },
      { status: 500 }
    );
  }
}
