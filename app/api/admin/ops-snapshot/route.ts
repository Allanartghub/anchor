/**
 * GET /api/admin/ops-snapshot
 *
 * Governance-first operational snapshot.
 * Aggregated counts only (no identifiers, no raw content).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getAdminServiceClient } from '@/lib/adminAuth';

function getWeekStart(date: Date) {
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

function getDayStart(date: Date) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  return dayStart;
}

function getDayEnd(date: Date) {
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);
  return dayEnd;
}

export async function GET(req: NextRequest) {
  try {
    const adminResult = await requireAdmin(req);

    if ('code' in adminResult) {
      return NextResponse.json(
        { error: adminResult.message },
        { status: adminResult.code === 'NO_SESSION' ? 401 : 403 }
      );
    }

    const client = getAdminServiceClient();
    const institutionId = adminResult.institution_id;

    const now = new Date();
    const weekStart = getWeekStart(now);
    const dayStart = getDayStart(now);
    const dayEnd = getDayEnd(now);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const { data: slaConfig } = await client
      .from('support_sla_config')
      .select('first_response_sla_hours')
      .eq('institution_id', institutionId)
      .maybeSingle();

    const slaHours = slaConfig?.first_response_sla_hours ?? 24;
    const overdueCutoff = new Date(now.getTime() - slaHours * 60 * 60 * 1000);

    const { count: openCases } = await client
      .from('support_cases')
      .select('id', { count: 'exact', head: true })
      .eq('institution_id', institutionId)
      .in('status', ['open', 'assigned', 'scheduled']);

    const { count: awaitingResponse } = await client
      .from('support_cases')
      .select('id', { count: 'exact', head: true })
      .eq('institution_id', institutionId)
      .in('status', ['open', 'assigned', 'scheduled'])
      .is('first_response_at', null);

    const { count: overdueCases } = await client
      .from('support_cases')
      .select('id', { count: 'exact', head: true })
      .eq('institution_id', institutionId)
      .in('status', ['open', 'assigned', 'scheduled'])
      .is('first_response_at', null)
      .lte('created_at', overdueCutoff.toISOString());

    let scheduledToday = 0;
    try {
      const { count } = await client
        .from('support_messages')
        .select('id, support_cases!inner(institution_id)', { count: 'exact', head: true })
        .eq('message_type', 'call_scheduled')
        .gte('created_at', dayStart.toISOString())
        .lte('created_at', dayEnd.toISOString())
        .eq('support_cases.institution_id', institutionId);

      scheduledToday = count || 0;
    } catch (error) {
      console.warn('[OPS_SNAPSHOT] Scheduled call lookup failed:', error);
    }

    const { data: responseCases } = await client
      .from('support_cases')
      .select('created_at, first_response_at')
      .eq('institution_id', institutionId)
      .gte('created_at', sevenDaysAgo.toISOString());

    let avgResponseHours: number | null = null;
    let slaComplianceRate: number | null = null;

    if (responseCases && responseCases.length > 0) {
      let totalResponseHours = 0;
      let responseCount = 0;
      let compliantCount = 0;

      responseCases.forEach((supportCase) => {
        if (supportCase.first_response_at) {
          const createdAt = new Date(supportCase.created_at).getTime();
          const firstResponseAt = new Date(supportCase.first_response_at).getTime();
          const diffHours = (firstResponseAt - createdAt) / (1000 * 60 * 60);
          totalResponseHours += diffHours;
          responseCount += 1;
          if (diffHours <= slaHours) {
            compliantCount += 1;
          }
        }
      });

      avgResponseHours = responseCount > 0 ? totalResponseHours / responseCount : null;
      slaComplianceRate = responseCases.length > 0 ? compliantCount / responseCases.length : null;
    }

    const { count: supportRequestsThisWeek } = await client
      .from('support_requests')
      .select('id', { count: 'exact', head: true })
      .eq('institution_id', institutionId)
      .gte('created_at', weekStart.toISOString());

    const { count: highRiskEvents } = await client
      .from('risk_events')
      .select('id', { count: 'exact', head: true })
      .eq('institution_id', institutionId)
      .gte('created_at', weekStart.toISOString());

    const { data: latestRiskEvent } = await client
      .from('risk_events')
      .select('model_version')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { count: expiredCases } = await client
      .from('support_cases')
      .select('id', { count: 'exact', head: true })
      .eq('institution_id', institutionId)
      .lte('expires_at', now.toISOString());

    return NextResponse.json({
      supportOps: {
        openCases: openCases || 0,
        awaitingResponse: awaitingResponse || 0,
        scheduledToday,
        overdueCases: overdueCases || 0,
        avgResponseHours,
      },
      governance: {
        slaComplianceRate,
        supportRequestsThisWeek: supportRequestsThisWeek || 0,
        highRiskEvents: highRiskEvents || 0,
        modelVersion: latestRiskEvent?.model_version || '1.0',
        retentionStatus: (expiredCases || 0) > 0 ? 'attention' : 'healthy',
        expiredCases: expiredCases || 0,
      },
    });
  } catch (error) {
    console.error('[OPS_SNAPSHOT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load operational snapshot' },
      { status: 500 }
    );
  }
}
