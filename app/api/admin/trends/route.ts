/**
 * GET /api/admin/trends
 * 
 * Returns cohort trend data for the admin's institution.
 * 
 * Query params:
 * - ?weeks=12 (default) - Number of weeks to include in trend
 * - ?week=5 (optional) - Specific week to analyze
 * 
 * Response:
 * - trends: CohortTrendSnapshot[] (domain-level stats by week)
 * - insights: StrategicInsight (top domains, spikes, recommendations)
 */

import { requireAdmin } from '@/lib/adminAuth';
import { createClient } from '@supabase/supabase-js';

const K_THRESHOLD = 10;

type CheckinRow = {
  user_id: string;
  primary_domain_id: string | null;
  intensity_numeric: number;
  created_at: string;
};

type RiskEventRow = {
  user_id: string;
  risk_tier: number;
  created_at: string;
};

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase credentials');
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function GET(request: Request) {
  try {
    // 1. Verify admin
    const admin = await requireAdmin(request);
    if ('code' in admin) {
      return new Response(JSON.stringify(admin), { status: 403 });
    }

    const serviceClient = getServiceClient();

    const url = new URL(request.url);
    const weeksParam = Number(url.searchParams.get('weeks') || '0');

    if (Number.isFinite(weeksParam) && weeksParam > 0) {
      const { data: latestCheckin, error: latestError } = await serviceClient
        .from('weekly_checkin_responses')
        .select('week_number, semester_year')
        .order('week_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestError) {
        console.error('[TRENDS_ERROR] Latest week lookup failed:', latestError);
        return new Response(JSON.stringify({ error: 'Failed to fetch trends' }), {
          status: 500,
        });
      }

      if (!latestCheckin?.week_number) {
        return new Response(
          JSON.stringify({
            trends: [],
            summary: {
              user_count: 0,
              checkin_count: 0,
              window_start_week: 0,
              window_end_week: 0,
              window_weeks: weeksParam,
            },
            period: {
              latest_week: null,
            },
          }),
          { status: 200 }
        );
      }

      const latestWeek = Number(latestCheckin.week_number);
      const windowWeeks = Math.max(1, Math.floor(weeksParam));
      const windowStartWeek = Math.max(1, latestWeek - windowWeeks + 1);

      let query = serviceClient
        .from('weekly_checkin_responses')
        .select('week_number, primary_domain_id, intensity_numeric, user_id')
        .gte('week_number', windowStartWeek)
        .lte('week_number', latestWeek);

      if (latestCheckin.semester_year) {
        query = query.eq('semester_year', latestCheckin.semester_year);
      }

      const { data: trendCheckins, error: trendError } = await query;

      if (trendError) {
        console.error('[TRENDS_ERROR] Trend checkin fetch failed:', trendError);
        return new Response(JSON.stringify({ error: 'Failed to fetch trends' }), {
          status: 500,
        });
      }

      const trendMap = new Map<string, { totalIntensity: number; count: number }>();
      const distinctUsers = new Set<string>();

      (trendCheckins || []).forEach((row: any) => {
        if (row.user_id) {
          distinctUsers.add(String(row.user_id));
        }
        if (typeof row.intensity_numeric !== 'number') return;
        if (!row.week_number) return;

        const domain = row.primary_domain_id || 'unknown';
        const key = `${row.week_number}::${domain}`;
        const entry = trendMap.get(key) || { totalIntensity: 0, count: 0 };
        entry.totalIntensity += row.intensity_numeric;
        entry.count += 1;
        trendMap.set(key, entry);
      });

      const trends = Array.from(trendMap.entries()).map(([key, entry]) => {
        const [weekStr, domain] = key.split('::');
        return {
          week_number: Number(weekStr),
          domain_id: domain,
          avg_intensity: entry.count > 0 ? entry.totalIntensity / entry.count : 0,
          sample_size: entry.count,
        };
      });

      return new Response(
        JSON.stringify({
          trends,
          summary: {
            user_count: distinctUsers.size,
            checkin_count: (trendCheckins || []).length,
            window_start_week: windowStartWeek,
            window_end_week: latestWeek,
            window_weeks: windowWeeks,
          },
          period: {
            latest_week: latestWeek,
          },
        }),
        { status: 200 }
      );
    }

    // 2. Rolling 7-day windows
    const now = new Date();
    const currentPeriodEnd = new Date(now);
    const currentPeriodStart = new Date(now);
    currentPeriodStart.setDate(now.getDate() - 7);

    const previousPeriodEnd = new Date(currentPeriodStart);
    const previousPeriodStart = new Date(currentPeriodStart);
    previousPeriodStart.setDate(currentPeriodStart.getDate() - 7);

    // 3. Fetch check-ins for last 14 days (current + previous)
    const { data: checkins, error: checkinError } = await serviceClient
      .from('weekly_checkin_responses')
      .select(
        `
        user_id,
        primary_domain_id,
        intensity_numeric,
        created_at
      `
      )
      .gte('created_at', previousPeriodStart.toISOString())
      .lt('created_at', currentPeriodEnd.toISOString())
      .order('created_at', { ascending: false });

    if (checkinError) {
      console.error('[TRENDS_ERROR]', checkinError);
      return new Response(JSON.stringify({ error: 'Failed to fetch trends' }), {
        status: 500,
      });
    }

    if (!checkins || checkins.length === 0) {
      return new Response(
        JSON.stringify({
          window: {
            current_start: currentPeriodStart.toISOString(),
            current_end: currentPeriodEnd.toISOString(),
            previous_start: previousPeriodStart.toISOString(),
            previous_end: previousPeriodEnd.toISOString(),
            k_threshold: K_THRESHOLD,
          },
          metrics: {
            high_intensity: {
              suppressed: true,
              message: 'Insufficient data (minimum 10 distinct users required)',
            },
            week_over_week: {
              suppressed: true,
              message: 'Not enough data for comparison',
            },
            top_domain: {
              suppressed: true,
              message: 'Insufficient data for domain ranking.',
            },
            domain_distribution: {
              suppressed: true,
              message: 'Insufficient data (minimum 10 distinct users required)',
            },
            sustained_pressure: {
              suppressed: true,
              message: 'Insufficient trend data.',
            },
            risk_tier_distribution: {
              suppressed: true,
              message: 'Insufficient data (minimum 10 distinct users required)',
            },
          },
          recommendations: {
            suppressed: true,
            message: 'Insufficient data for recommendations.',
          },
        }),
        { status: 200 }
      );
    }
    const typedCheckins = checkins as CheckinRow[];
    const currentCheckins = typedCheckins.filter(
      (c) => new Date(c.created_at) >= currentPeriodStart && new Date(c.created_at) < currentPeriodEnd
    );
    const previousCheckins = typedCheckins.filter(
      (c) => new Date(c.created_at) >= previousPeriodStart && new Date(c.created_at) < previousPeriodEnd
    );

    const currentStats = buildPeriodStats(currentCheckins);
    const previousStats = buildPeriodStats(previousCheckins);

    const currentUsers = currentStats.distinctUsers;
    const previousUsers = previousStats.distinctUsers;

    const highIntensitySuppressed = currentUsers < K_THRESHOLD;
    const highIntensityPct = currentUsers === 0
      ? 0
      : (currentStats.highIntensityUsers / currentUsers) * 100;

    const weekOverWeekSuppressed =
      currentUsers < K_THRESHOLD ||
      previousUsers < K_THRESHOLD ||
      previousStats.avgIntensity <= 0;

    const weekOverWeekPct = weekOverWeekSuppressed
      ? null
      : ((currentStats.avgIntensity - previousStats.avgIntensity) / previousStats.avgIntensity) * 100;

    const domainDistribution = currentStats.domainStats.map((domain) => ({
      domain: domain.domain,
      avgIntensity: domain.avgIntensity,
      distinctUsers: domain.distinctUsers,
      highIntensityPct: domain.distinctUsers === 0
        ? 0
        : (domain.highIntensityUsers / domain.distinctUsers) * 100,
    }));

    const domainDistributionSuppressed =
      currentUsers < K_THRESHOLD || domainDistribution.length === 0;

    const topDomain = domainDistribution
      .slice()
      .sort((a, b) => b.avgIntensity - a.avgIntensity)[0] || null;

    const topDomainSuppressed = domainDistributionSuppressed || !topDomain;

    const sustainedSuppressed = previousUsers < K_THRESHOLD;
    const sustainedDomains = sustainedSuppressed
      ? []
      : currentStats.domainStats
          .filter((domain) => domain.avgIntensity >= 4 && domain.distinctUsers >= K_THRESHOLD)
          .filter((domain) => {
            const prev = previousStats.domainStats.find((d) => d.domain === domain.domain);
            return prev && prev.avgIntensity >= 4 && prev.distinctUsers >= K_THRESHOLD;
          })
          .map((domain) => domain.domain);

    if (sustainedSuppressed) {
      console.warn('[TRENDS] Sustained pressure suppressed due to prior period k-threshold');
    }

    // Risk tier distribution (distinct users per max risk tier)
    const { data: riskEvents, error: riskError } = await serviceClient
      .from('risk_events')
      .select('user_id, risk_tier, created_at')
      .gte('created_at', currentPeriodStart.toISOString())
      .lt('created_at', currentPeriodEnd.toISOString());

    if (riskError) {
      console.error('[TRENDS] Risk events fetch error:', riskError);
    }

    const riskUserTier = new Map<string, number>();
    (riskEvents as RiskEventRow[] | null || []).forEach((event) => {
      const current = riskUserTier.get(event.user_id);
      const tier = typeof event.risk_tier === 'number' ? event.risk_tier : 0;
      if (current === undefined || tier > current) {
        riskUserTier.set(event.user_id, tier);
      }
    });

    const riskTierCounts = { r0: 0, r1: 0, r2: 0, r3: 0 };
    riskUserTier.forEach((tier) => {
      if (tier === 0) riskTierCounts.r0++;
      else if (tier === 1) riskTierCounts.r1++;
      else if (tier === 2) riskTierCounts.r2++;
      else if (tier === 3) riskTierCounts.r3++;
    });

    const riskDistinctUsers = riskUserTier.size;
    const riskSuppressed = riskDistinctUsers < K_THRESHOLD;

    if (!riskSuppressed && currentUsers !== riskDistinctUsers) {
      console.warn('[TRENDS] Risk tier mismatch:', {
        currentUsers,
        riskDistinctUsers,
      });
    }

    const recommendationText = topDomain
      ? getDomainRecommendation(topDomain.domain)
      : null;

    return new Response(
      JSON.stringify({
        window: {
          current_start: currentPeriodStart.toISOString(),
          current_end: currentPeriodEnd.toISOString(),
          previous_start: previousPeriodStart.toISOString(),
          previous_end: previousPeriodEnd.toISOString(),
          k_threshold: K_THRESHOLD,
        },
        metrics: {
          high_intensity: highIntensitySuppressed
            ? {
                suppressed: true,
                message: 'Insufficient data (minimum 10 distinct users required)',
              }
            : {
                suppressed: false,
                value_pct: highIntensityPct,
                flagged_users: currentStats.highIntensityUsers,
                distinct_users: currentUsers,
              },
          week_over_week: weekOverWeekSuppressed
            ? {
                suppressed: true,
                message: 'Not enough data for comparison',
              }
            : {
                suppressed: false,
                change_pct: weekOverWeekPct,
                current_avg: currentStats.avgIntensity,
                previous_avg: previousStats.avgIntensity,
              },
          top_domain: topDomainSuppressed
            ? {
                suppressed: true,
                message: 'Insufficient data for domain ranking.',
              }
            : {
                suppressed: false,
                domain: topDomain.domain,
                distinct_users: topDomain.distinctUsers,
                avg_intensity: topDomain.avgIntensity,
              },
          domain_distribution: domainDistributionSuppressed
            ? {
                suppressed: true,
                message: 'Insufficient data (minimum 10 distinct users required)',
              }
            : {
                suppressed: false,
                domains: domainDistribution,
              },
          sustained_pressure: sustainedSuppressed
            ? {
                suppressed: true,
                message: 'Insufficient trend data.',
              }
            : {
                suppressed: false,
                domains: sustainedDomains,
              },
          risk_tier_distribution: riskSuppressed
            ? {
                suppressed: true,
                message: 'Insufficient data (minimum 10 distinct users required)',
              }
            : {
                suppressed: false,
                counts: riskTierCounts,
                distinct_users: riskDistinctUsers,
              },
        },
        recommendations: recommendationText
          ? {
              suppressed: false,
              text: recommendationText,
            }
          : {
              suppressed: true,
              message: 'Insufficient data for recommendations.',
            },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('[TRENDS_ROUTE_ERROR]', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
}

/**
 * Aggregate domain stats from check-in list.
 * 
 * Returns: { domain_id, count, avg_intensity, high_intensity_count }[]
 */
function buildPeriodStats(checkins: CheckinRow[]) {
  const userIntensities = new Map<string, number[]>();
  const userDomainIntensities = new Map<string, Map<string, number[]>>();

  checkins.forEach((c) => {
    if (typeof c.intensity_numeric !== 'number') return;
    const domain = c.primary_domain_id || 'unknown';

    if (!userIntensities.has(c.user_id)) {
      userIntensities.set(c.user_id, []);
    }
    userIntensities.get(c.user_id)!.push(c.intensity_numeric);

    if (!userDomainIntensities.has(c.user_id)) {
      userDomainIntensities.set(c.user_id, new Map());
    }
    const domainMap = userDomainIntensities.get(c.user_id)!;
    if (!domainMap.has(domain)) {
      domainMap.set(domain, []);
    }
    domainMap.get(domain)!.push(c.intensity_numeric);
  });

  const userAverages = new Map<string, number>();
  userIntensities.forEach((values, userId) => {
    const total = values.reduce((sum, v) => sum + v, 0);
    userAverages.set(userId, values.length > 0 ? total / values.length : 0);
  });

  const distinctUsers = userAverages.size;
  const totalAvgIntensity = Array.from(userAverages.values()).reduce((sum, v) => sum + v, 0);
  const avgIntensity = distinctUsers > 0 ? totalAvgIntensity / distinctUsers : 0;
  const highIntensityUsers = Array.from(userAverages.values()).filter((v) => v >= 4).length;

  const domainAggregate = new Map<string, { totalAvg: number; userCount: number; highUsers: number }>();
  userDomainIntensities.forEach((domainMap) => {
    domainMap.forEach((values, domain) => {
      const total = values.reduce((sum, v) => sum + v, 0);
      const avg = values.length > 0 ? total / values.length : 0;
      const entry = domainAggregate.get(domain) || { totalAvg: 0, userCount: 0, highUsers: 0 };
      entry.totalAvg += avg;
      entry.userCount += 1;
      if (avg >= 4) {
        entry.highUsers += 1;
      }
      domainAggregate.set(domain, entry);
    });
  });

  const domainStats = Array.from(domainAggregate.entries()).map(([domain, entry]) => ({
    domain,
    avgIntensity: entry.userCount > 0 ? entry.totalAvg / entry.userCount : 0,
    distinctUsers: entry.userCount,
    highIntensityUsers: entry.highUsers,
  }));

  return {
    distinctUsers,
    avgIntensity,
    highIntensityUsers,
    domainStats,
  };
}

function getDomainRecommendation(domain: string) {
  const key = domain.toLowerCase();
  const recommendations: Record<string, string> = {
    academic: 'Academic load is elevated. Consider study skills sessions and workload planning support.',
    financial: 'Financial pressure is rising. Ensure emergency funds and financial aid resources are visible.',
    social: 'Social strain is present. Promote peer groups and community events to strengthen connections.',
    family: 'Family-related stress is high. Provide counseling and cross-cultural support options.',
    health: 'Health concerns are elevated. Highlight wellbeing services and preventative care programs.',
    belonging: 'Belonging stress is elevated. Focus on inclusion initiatives and community-building activities.',
    administrative: 'Administrative pressure is rising. Review processes and improve guidance and clarity.',
    worklife: 'Work-life balance is strained. Promote time management support and flexible scheduling guidance.',
  };
  return recommendations[key] || 'Monitor cohort trends and ensure support services are accessible.';
}
