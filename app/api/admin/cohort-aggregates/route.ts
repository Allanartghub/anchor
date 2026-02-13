/**
 * /api/admin/cohort-aggregates
 * 
 * Returns k-anonymized cohort-level statistics.
 * Enforces minimum threshold (k=10) to prevent singling out individuals.
 * 
 * GDPR-compliant: No individual identifiers, purpose-limited to population insights
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getAdminServiceClient } from '@/lib/adminAuth';

const K_THRESHOLD = 10; // Minimum cohort size for display

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
    
    // Get rolling 7-day window (last 7 days)
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setHours(23, 59, 59, 999);
    
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7); // 7 days ago
    weekStart.setHours(0, 0, 0, 0);

    // Get check-ins for the current week
    const { data: checkins, error: checkinsError } = await client
      .from('weekly_checkin_responses')
      .select(`
        id,
        user_id,
        primary_domain_id,
        secondary_domain_id,
        intensity_numeric,
        created_at
      `)
      .gte('created_at', weekStart.toISOString())
      .lte('created_at', weekEnd.toISOString());

    if (checkinsError) {
      console.error('[COHORT_AGGREGATES] Error fetching check-ins:', checkinsError);
      throw checkinsError;
    }

    // Check cohort size against k-threshold
    const uniqueUsers = new Set((checkins || []).map(c => c.user_id));
    const cohortSize = uniqueUsers.size;

    if (cohortSize < K_THRESHOLD) {
      return NextResponse.json({
        cohortSize,
        topDomain: null,
        topDomainPct: 0,
        avgIntensity: 0,
        highIntensityPct: 0,
        riskTierCounts: { r0: 0, r1: 0, r2: 0, r3: 0 },
        recommendations: [],
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        belowThreshold: true,
      });
    }

    // Compute domain frequencies
    const domainCounts: Record<string, number> = {};
    let totalIntensity = 0;
    let highIntensityCount = 0;

    (checkins || []).forEach(checkin => {
      // Count domains (now using primary_domain_id and secondary_domain_id)
      if (checkin.primary_domain_id) {
        const domainId = String(checkin.primary_domain_id);
        domainCounts[domainId] = (domainCounts[domainId] || 0) + 1;
      }
      if (checkin.secondary_domain_id) {
        const domainId = String(checkin.secondary_domain_id);
        domainCounts[domainId] = (domainCounts[domainId] || 0) + 1;
      }

      // Intensity metrics
      if (typeof checkin.intensity_numeric === 'number') {
        totalIntensity += checkin.intensity_numeric;
        if (checkin.intensity_numeric >= 4) {
          highIntensityCount++;
        }
      }
    });

    // Get top domain
    const topDomainEntry = Object.entries(domainCounts).reduce<[string, number] | null>(
      (max, [domain, count]) => (!max || count > max[1] ? [domain, count] : max),
      null
    );
    const topDomain = topDomainEntry?.[0] ?? null;
    const topDomainCount = topDomainEntry?.[1] ?? 0;

    const topDomainPct = checkins && checkins.length > 0 
      ? topDomainCount / checkins.length 
      : 0;

    // Average intensity
    const avgIntensity = checkins && checkins.length > 0
      ? totalIntensity / checkins.length
      : 0;

    const highIntensityPct = checkins && checkins.length > 0
      ? highIntensityCount / checkins.length
      : 0;

    // Get aggregated risk tier counts (from risk_events)
    const { data: riskEvents, error: riskError } = await client
      .from('risk_events')
      .select('risk_tier')
      .gte('created_at', weekStart.toISOString())
      .lte('created_at', weekEnd.toISOString());

    if (riskError) {
      console.error('[COHORT_AGGREGATES] Error fetching risk events:', riskError);
    }

    const riskTierCounts = {
      r0: 0,
      r1: 0,
      r2: 0,
      r3: 0,
    };

    (riskEvents || []).forEach(event => {
      if (event.risk_tier === 0) riskTierCounts.r0++;
      else if (event.risk_tier === 1) riskTierCounts.r1++;
      else if (event.risk_tier === 2) riskTierCounts.r2++;
      else if (event.risk_tier === 3) riskTierCounts.r3++;
    });

    // Generate generic recommendations based on cohort patterns
    const recommendations: string[] = [];

    if (topDomain && typeof topDomain === 'string') {
      const domainRecommendations: Record<string, string> = {
        'academic': 'Consider offering study skills workshops or time management resources for students experiencing high academic pressure.',
        'financial': 'Ensure students are aware of financial aid options, emergency funds, and budgeting support services.',
        'social': 'Promote social connection opportunities such as peer support groups, student clubs, and community events.',
        'family': 'Provide resources for students dealing with family stress, including counseling and cross-cultural support.',
        'health': 'Highlight health and wellness services including mental health support, exercise programs, and nutritional guidance.',
      };

      const domainKey = topDomain.toLowerCase();
      if (domainRecommendations[domainKey]) {
        recommendations.push(domainRecommendations[domainKey]);
      }
    }

    if (highIntensityPct > 0.3) {
      recommendations.push(
        'Over 30% of the cohort is reporting high-intensity distress. Consider campus-wide wellness initiatives or stress reduction programs.'
      );
    }

    if (riskTierCounts.r2 + riskTierCounts.r3 > 0) {
      recommendations.push(
        `${riskTierCounts.r2 + riskTierCounts.r3} students this week are eligible for enhanced support. Ensure support services are visible and accessible.`
      );
    }

    return NextResponse.json({
      cohortSize,
      topDomain,
      topDomainPct,
      avgIntensity,
      highIntensityPct,
      riskTierCounts,
      recommendations,
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      isRollingWindow: true,
    });

  } catch (error: any) {
    console.error('[COHORT_AGGREGATES] Error:', error);
    
    if (error.message?.includes('Not authorized')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch cohort aggregates' },
      { status: 500 }
    );
  }
}
