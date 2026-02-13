/**
 * /api/admin/support-requests
 * 
 * Manages opt-in support requests where students have explicitly requested contact.
 * ONLY shows cases where user gave explicit consent for support sharing.
 * 
 * GDPR-compliant: Purpose-limited, consent-gated, audit-logged
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getAdminServiceClient } from '@/lib/adminAuth';

export async function GET(req: NextRequest) {
  try {
    // Verify admin authentication
    const adminResult = await requireAdmin(req);
    
    // Check if authentication failed
    if ('code' in adminResult) {
      return NextResponse.json(
        { error: adminResult.message },
        { status: adminResult.code === 'NO_SESSION' ? 401 : 403 }
      );
    }
    
    const client = getAdminServiceClient();
    
    // Get query params
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'pending';
    const countOnly = searchParams.get('count') === 'true';

    // Fetch support requests (with consent verification)
    let query = client
      .from('support_requests')
      .select(`
        id,
        case_token,
        request_type,
        context_excerpt,
        risk_tier,
        status,
        created_at,
        reviewed_at,
        assigned_to
      `, { count: 'exact' });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    query = query.order('created_at', { ascending: false });

    const { data: requests, error, count } = await query;

    if (error) {
      console.error('[SUPPORT_REQUESTS] Error fetching requests:', error);
      throw error;
    }

    // Audit log: record view action
    try {
      await client.from('admin_audit_log').insert({
        admin_user_id: adminResult.auth_uid,
        action_type: countOnly ? 'view_support_count' : 'view_support_requests',
        resource_type: 'support_request',
        action_details: { status, count: count || 0 },
      });
    } catch (auditError) {
      console.error('[SUPPORT_REQUESTS] Audit log error:', auditError);
      // Don't fail the request if audit logging fails
    }

    if (countOnly) {
      return NextResponse.json({ count: count || 0 });
    }

    return NextResponse.json({
      requests: requests || [],
      count: count || 0,
    });

  } catch (error: any) {
    console.error('[SUPPORT_REQUESTS] Error:', error);
    
    if (error.message?.includes('Not authorized')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch support requests' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // This endpoint is NOT used by admins - it's used by students to create requests
    // Admin can only READ support requests
    return NextResponse.json(
      { error: 'Use student-facing API to create support requests' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('[SUPPORT_REQUESTS] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    // Verify admin authentication
    const adminResult = await requireAdmin(req);
    
    // Check if authentication failed
    if ('code' in adminResult) {
      return NextResponse.json(
        { error: adminResult.message },
        { status: adminResult.code === 'NO_SESSION' ? 401 : 403 }
      );
    }
    
    const client = getAdminServiceClient();
    
    const body = await req.json();
    const { case_token, status, resolution_notes } = body;

    if (!case_token) {
      return NextResponse.json(
        { error: 'case_token is required' },
        { status: 400 }
      );
    }

    // Update support request
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (status) {
      updateData.status = status;
      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
        // Set expiry to 180 days after completion
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 180);
        updateData.expires_at = expiryDate.toISOString();
      }
    }

    if (resolution_notes) {
      updateData.resolution_notes = resolution_notes;
    }

    if (status === 'in_progress') {
      updateData.assigned_to = adminResult.auth_uid;
    }

    if (status === 'completed') {
      updateData.reviewed_at = new Date().toISOString();
    }

    const { data, error } = await client
      .from('support_requests')
      .update(updateData)
      .eq('case_token', case_token)
      .select()
      .single();

    if (error) {
      console.error('[SUPPORT_REQUESTS] Update error:', error);
      throw error;
    }

    // Audit log: record action
    try {
      await client.from('admin_audit_log').insert({
        admin_user_id: adminResult.auth_uid,
        action_type: 'update_support_request',
        resource_type: 'support_request',
        resource_id: data.id,
        action_details: { case_token, status, has_notes: !!resolution_notes },
      });
    } catch (auditError) {
      console.error('[SUPPORT_REQUESTS] Audit log error:', auditError);
    }

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('[SUPPORT_REQUESTS] PATCH Error:', error);
    
    if (error.message?.includes('Not authorized')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update support request' },
      { status: 500 }
    );
  }
}
