'use client';

/**
 * /app/admin/page.tsx
 * 
 * GDPR-Compliant Admin Dashboard (Trends View)
 * 
 * Shows ONLY aggregated cohort-level data:
 * - Population wellbeing signals (domain pressure trends)
 * - K-anonymized statistics (no individual cases)
 * - Generic recommendations based on cohort patterns
 * 
 * Does NOT show:
 * - Individual student data or identifiers
 * - Risk queue (moved to opt-in Support Requests)
 * - Small-n subgroups (k-threshold enforced)
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminNav from '@/components/AdminNav';

const K_THRESHOLD = 10; // Minimum cohort size for display

interface CohortStats {
  cohortSize: number;
  topDomain: string | null;
  topDomainPct: number;
  avgIntensity: number;
  highIntensityPct: number;
  riskTierCounts: {
    r0: number;
    r1: number;
    r2: number;
    r3: number;
  };
  recommendations: string[];
  weekStart: string;
  weekEnd: string;
}

interface SupportOpsSnapshot {
  openCases: number;
  awaitingResponse: number;
  scheduledToday: number;
  overdueCases: number;
  avgResponseHours: number | null;
}

interface GovernanceSnapshot {
  slaComplianceRate: number | null;
  supportRequestsThisWeek: number;
  highRiskEvents: number;
  modelVersion: string;
  retentionStatus: 'healthy' | 'attention';
  expiredCases: number;
}

interface TrendPoint {
  week_number: number;
  domain_id: string | null;
  avg_intensity: number;
  sample_size: number;
}

interface TrendSummary {
  user_count: number;
  checkin_count: number;
  window_start_week: number;
  window_end_week: number;
  window_weeks: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<CohortStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supportOps, setSupportOps] = useState<SupportOpsSnapshot | null>(null);
  const [governance, setGovernance] = useState<GovernanceSnapshot | null>(null);
  const [trendPoints, setTrendPoints] = useState<TrendPoint[]>([]);
  const [trendSummary, setTrendSummary] = useState<TrendSummary | null>(null);
  const [latestWeek, setLatestWeek] = useState<number | null>(null);

  useEffect(() => {
    async function checkAuthAndFetchStats() {
      try {
        // Get current session
        const { supabase } = await import('@/lib/supabase');
        const { data: { session: sbSession } } = await supabase.auth.getSession();
        
        if (!sbSession) {
          console.log('[ADMIN] No session found, redirecting to login');
          router.push('/login');
          return;
        }

        // Fetch ops snapshot (non-critical - continue on error)
        try {
          const opsResponse = await fetch('/api/admin/ops-snapshot', {
            headers: {
              Authorization: `Bearer ${sbSession.access_token}`,
            },
          });

          if (opsResponse.ok) {
            const opsData = await opsResponse.json();
            setSupportOps(opsData.supportOps);
            setGovernance(opsData.governance);
          } else {
            console.warn('[ADMIN] ops-snapshot returned:', opsResponse.status);
          }
        } catch (opsErr) {
          console.warn('[ADMIN] ops-snapshot fetch failed:', opsErr);
        }

        // Fetch cohort aggregates (critical)
        const trendsResponse = await fetch('/api/admin/cohort-aggregates', {
          headers: {
            Authorization: `Bearer ${sbSession.access_token}`,
          },
        });
        
        if (!trendsResponse.ok) {
          const errorData = await trendsResponse.json().catch(() => ({}));
          console.error('[ADMIN] cohort-aggregates failed:', trendsResponse.status, errorData);
          if (trendsResponse.status === 403) {
            throw new Error(`Not authorized: ${errorData.message || 'Access denied'}`);
          }
          throw new Error(`Failed to fetch cohort data (${trendsResponse.status})`);
        }
        
        const trendsData = await trendsResponse.json();
        console.log('[ADMIN] cohort-aggregates response:', trendsData);
        setStats(trendsData);

        // Fetch cohort trend data for charts (non-critical)
        try {
          const trendResponse = await fetch('/api/admin/trends?weeks=6', {
            headers: {
              Authorization: `Bearer ${sbSession.access_token}`,
            },
          });

          if (trendResponse.ok) {
            const trendData = await trendResponse.json();
            const trends = trendData.trends || [];
            console.log('[ADMIN] trends response:', { trendsCount: trends.length, summary: trendData.summary });
            setTrendPoints(trends);
            setTrendSummary(trendData.summary || null);
            if (trendData.period?.latest_week) {
              setLatestWeek(trendData.period.latest_week);
            } else if (trends.length > 0) {
              const maxWeek = Math.max(...trends.map((point: TrendPoint) => point.week_number));
              setLatestWeek(maxWeek);
            }
          } else {
            console.warn('[ADMIN] trends returned:', trendResponse.status);
          }
        } catch (trendErr) {
          console.warn('[ADMIN] trends fetch failed:', trendErr);
        }

      } catch (err) {
        console.error('[ADMIN] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    checkAuthAndFetchStats();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav current="dashboard" />
        <div className="p-8">Loading cohort data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav current="dashboard" />
        <div className="p-8">
          <div className="bg-red-50 border border-red-200 p-4 rounded mb-4">
            <p className="text-red-900 font-semibold">Error</p>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
          <button
            onClick={() => router.push('/login')}
            className="text-blue-600 hover:underline"
          >
            Return to login
          </button>
        </div>
      </div>
    );
  }

  // K-threshold check: don't display if cohort too small
  if (stats && stats.cohortSize < K_THRESHOLD) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav current="dashboard" />
        <div className="p-8">
          <div className="bg-yellow-50 border border-yellow-200 p-6 rounded">
            <h2 className="text-lg font-semibold text-yellow-900 mb-2">
              Insufficient Data for Display
            </h2>
            <p className="text-yellow-800 text-sm">
              Cohort size ({stats.cohortSize}) is below the minimum threshold ({K_THRESHOLD}) 
              required to display aggregated statistics while protecting individual privacy.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const topDomains = (() => {
    if (!latestWeek) return [];
    const latestPoints = trendPoints.filter((point) => point.week_number === latestWeek);
    // K-threshold already enforced at cohort level - show all domains
    return latestPoints
      .sort((a, b) => b.sample_size - a.sample_size)
      .slice(0, 3);
  })();

  const trendSeries = (() => {
    const weekMap: Record<number, { total: number; count: number }> = {};
    trendPoints.forEach((point) => {
      if (!weekMap[point.week_number]) {
        weekMap[point.week_number] = { total: 0, count: 0 };
      }
      weekMap[point.week_number].total += point.avg_intensity * point.sample_size;
      weekMap[point.week_number].count += point.sample_size;
    });

    return Object.entries(weekMap)
      .map(([week, data]) => ({
        week: Number(week),
        value: data.count > 0 ? data.total / data.count : 0,
        sampleSize: data.count,
      }))
      // K-threshold already enforced at cohort level - show all weeks
      .sort((a, b) => a.week - b.week)
      .slice(-6);
  })();

  const weeklyChange = trendSeries.length >= 2
    ? trendSeries[trendSeries.length - 1].value - trendSeries[trendSeries.length - 2].value
    : null;

  const engagementRate = stats && trendSummary && stats.cohortSize > 0
    ? Math.min(trendSummary.user_count / stats.cohortSize, 1)
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav current="dashboard" />
      <div className="p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Executive Snapshot
          </h1>
          <p className="text-slate-600">
            Operational focus, aggregated insight, and governance health. No individual monitoring.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          <section className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Support Operations Snapshot</h2>
                <p className="text-sm text-slate-600">What needs attention right now (aggregate only).</p>
              </div>
              <button
                onClick={() => router.push('/admin/support-inbox')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
              >
                Go to Support Inbox
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-500">Open Support Cases</p>
                <p className="text-2xl font-bold text-slate-900">{supportOps?.openCases ?? 0}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-500">Awaiting Admin Response</p>
                <p className="text-2xl font-bold text-slate-900">{supportOps?.awaitingResponse ?? 0}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-500">Scheduled Calls Today</p>
                <p className="text-2xl font-bold text-slate-900">{supportOps?.scheduledToday ?? 0}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-500">Overdue Cases (SLA)</p>
                <p className="text-2xl font-bold text-slate-900">{supportOps?.overdueCases ?? 0}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-500">Avg Response Time (7 days)</p>
                <p className="text-2xl font-bold text-slate-900">
                  {supportOps?.avgResponseHours !== null && supportOps?.avgResponseHours !== undefined
                    ? `${supportOps.avgResponseHours.toFixed(1)}h`
                    : 'N/A'}
                </p>
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-slate-900">System & Governance</h2>
            <p className="text-sm text-slate-600 mb-4">Operational health only. No individual drill-down.</p>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">SLA compliance (7 days)</span>
                <span className="font-semibold text-slate-900">
                  {governance?.slaComplianceRate !== null && governance?.slaComplianceRate !== undefined
                    ? `${Math.round(governance.slaComplianceRate * 100)}%`
                    : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Support requests this week</span>
                <span className="font-semibold text-slate-900">{governance?.supportRequestsThisWeek ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">High-risk events (aggregate)</span>
                <span className="font-semibold text-slate-900">{governance?.highRiskEvents ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Model version active</span>
                <span className="font-semibold text-slate-900">{governance?.modelVersion || '1.0'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Retention status</span>
                <span className={`font-semibold ${governance?.retentionStatus === 'attention' ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {governance?.retentionStatus === 'attention' ? `Attention (${governance.expiredCases})` : 'Healthy'}
                </span>
              </div>
            </div>
          </section>
        </div>

        <section className="bg-white border border-slate-200 rounded-lg p-6 mb-10">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Cohort Wellbeing Overview</h2>
              <p className="text-sm text-slate-600">
                Aggregated trends only. K-threshold enforced (k={K_THRESHOLD}).
              </p>
            </div>
            <div className="text-sm text-slate-500">
              {stats ? 'Last 7 days' : ''}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Top 3 Domain Pressures</h3>
              {topDomains.length === 0 ? (
                <p className="text-xs text-slate-500">Insufficient data for this week.</p>
              ) : (
                <>
                  <div className="space-y-3 mb-4">
                    {topDomains.map((domain) => (
                      <div key={`${domain.week_number}-${domain.domain_id}`}>
                        <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                          <span className="capitalize">{domain.domain_id || 'Unknown'}</span>
                          <span>{domain.sample_size} check-ins</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded">
                          <div
                            className="h-2 bg-blue-600 rounded"
                            style={{ width: `${Math.min((domain.sample_size / (topDomains[0]?.sample_size || 1)) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  {topDomains.length > 0 && (
                    <div className="pt-3 border-t border-slate-200">
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {(() => {
                          const topDomain = topDomains[0].domain_id;
                          const domainRecommendations: Record<string, string> = {
                            'academic': '📚 Consider offering study skills workshops or time management resources.',
                            'financial': '💰 Ensure students are aware of financial aid and emergency funds.',
                            'social': '🤝 Promote peer support groups and community events.',
                            'family': '👨‍👩‍👧 Provide resources for family stress and cross-cultural support.',
                            'health': '💪 Highlight mental health services and wellness programs.',
                            'belonging': '🏠 Focus on inclusion initiatives and community-building activities.',
                            'administrative': '📋 Review administrative processes and provide clear guidance resources.',
                          };
                          const domainKey = (topDomain || '').toLowerCase();
                          return domainRecommendations[domainKey] || '📊 Monitor cohort trends and ensure support services are accessible.';
                        })()}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Weekly Stress Index Change</h3>
              {trendSeries.length < 2 ? (
                <p className="text-xs text-slate-500">Not enough trend data.</p>
              ) : (
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                    <span>Latest change</span>
                    <span className={weeklyChange && weeklyChange > 0 ? 'text-amber-700 font-semibold' : 'text-emerald-700 font-semibold'}>
                      {weeklyChange !== null ? weeklyChange.toFixed(2) : 'N/A'}
                    </span>
                  </div>
                  <div className="h-20 bg-white border border-slate-200 rounded flex items-end gap-2 p-2">
                    {trendSeries.map((point) => (
                      <div key={point.week} className="flex-1 flex flex-col items-center">
                        <div
                          className="w-full bg-blue-500 rounded-t"
                          style={{ height: `${Math.min(point.value / 5, 1) * 60}px` }}
                        />
                        <span className="text-[10px] text-slate-500 mt-1">W{point.week}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Risk Tier Distribution</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">R0 (baseline)</span>
                  <span className="font-semibold text-slate-900">{stats?.riskTierCounts?.r0 ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">R1 (elevated)</span>
                  <span className="font-semibold text-slate-900">{stats?.riskTierCounts?.r1 ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">R2 (support eligible)</span>
                  <span className="font-semibold text-slate-900">{stats?.riskTierCounts?.r2 ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">R3 (priority)</span>
                  <span className="font-semibold text-slate-900">{stats?.riskTierCounts?.r3 ?? 0}</span>
                </div>
              </div>
              <div className="mt-4 text-xs text-slate-500">
                Weekly active engagement rate:{' '}
                {engagementRate !== null ? `${Math.round(engagementRate * 100)}%` : 'N/A'}
              </div>
            </div>
          </div>
        </section>

        <div className="mt-8 p-4 bg-slate-100 border border-slate-200 rounded text-xs text-slate-600">
          <p className="font-semibold mb-1">Privacy & Data Protection</p>
          <p>
            This dashboard shows aggregated, k-anonymized cohort statistics (minimum {K_THRESHOLD} students).
            Individual content is only accessible inside Support Inbox with explicit case consent.
          </p>
        </div>
      </div>
    </div>
  );
}
