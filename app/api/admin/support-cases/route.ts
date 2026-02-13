/**
 * GET /api/admin/support-cases
 * 
 * Returns support cases assigned to the authenticated admin.
 * RLS ensures only assigned cases are visible.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getAdminServiceClient } from '@/lib/adminAuth';

export async function GET(req: NextRequest) {
  try {
    const adminResult = await requireAdmin(req);

    if ('code' in adminResult) {
      return NextResponse.json(
        { error: adminResult.message },
        { status: adminResult.code === 'NO_SESSION' ? 401 : 403 }
      );
    }

    const url = new URL(req.url);
    const statusParam = url.searchParams.get('status');
    const statuses = statusParam ? statusParam.split(',').map(s => s.trim()) : null;

    console.log('[SUPPORT_CASES_LIST] Fetching cases for admin:', {
      adminId: adminResult.auth_uid,
      statuses,
    });

    const client = getAdminServiceClient();

    // Fetch cases assigned to this admin
    const { data: assignedCases, error: assignedError } = await client
      .from('support_cases')
      .select(`
        id,
        status,
        requested_channel,
        risk_tier,
        assigned_to,
        created_at,
        first_response_at,
        updated_at
      `)
      .eq('assigned_to', adminResult.auth_uid)
      .order('created_at', { ascending: false });

    if (assignedError) {
      console.error('[SUPPORT_CASES] Query error (assigned):', assignedError);
      throw assignedError;
    }

    // Fetch unassigned open cases
    const { data: unassignedCases, error: unassignedError } = await client
      .from('support_cases')
      .select(`
        id,
        status,
        requested_channel,
        risk_tier,
        assigned_to,
        created_at,
        first_response_at,
        updated_at
      `)
      .is('assigned_to', null)
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (unassignedError) {
      console.error('[SUPPORT_CASES] Query error (unassigned):', unassignedError);
      throw unassignedError;
    }

    // Merge both lists (assigned first, then unassigned)
    const cases = [...(assignedCases || []), ...(unassignedCases || [])];

    // Get unread count for each case
    const casesWithCounts = await Promise.all(
      cases.map(async (supportCase) => {
        const { count } = await client
          .from('support_messages')
          .select('*', { count: 'exact', head: true })
          .eq('case_id', supportCase.id)
          .gt('created_at', supportCase.first_response_at || supportCase.created_at)
          .eq('sender_type', 'user');

        const { data: riskMessages } = await client
          .from('support_messages')
          .select('contains_high_risk')
          .eq('case_id', supportCase.id)
          .eq('contains_high_risk', true)
          .limit(1);

        return {
          ...supportCase,
          unread_count: count || 0,
          contains_risk: (riskMessages?.length || 0) > 0,
        };
      })
    );

    return NextResponse.json({
      success: true,
      cases: casesWithCounts,
    });
  } catch (error) {
    console.error('[SUPPORT_CASES_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to load support cases' },
      { status: 500 }
    );
  }
}
