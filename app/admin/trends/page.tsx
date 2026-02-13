'use client';

/**
 * /app/admin/trends/page.tsx
 * 
 * Cohort trends dashboard.
 * 
 * Shows:
 * - Top pressure domains (bar chart concept)
 * - High-intensity trends (% of cohort)
 * - Strategic insights + recommendations
 * - Week-over-week patterns
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import AdminNav from '@/components/AdminNav';

interface MetricsResponse {
  high_intensity: {
    suppressed: boolean;
    message?: string;
    value_pct?: number;
    flagged_users?: number;
    distinct_users?: number;
  };
  week_over_week: {
    suppressed: boolean;
    message?: string;
    change_pct?: number | null;
    current_avg?: number;
    previous_avg?: number;
  };
  top_domain: {
    suppressed: boolean;
    message?: string;
    domain?: string | null;
    distinct_users?: number;
    avg_intensity?: number;
  };
  domain_distribution: {
    suppressed: boolean;
    message?: string;
    domains?: Array<{
      domain: string;
      avgIntensity: number;
      distinctUsers: number;
      highIntensityPct: number;
    }>;
  };
  sustained_pressure: {
    suppressed: boolean;
    message?: string;
    domains?: string[];
  };
  risk_tier_distribution: {
    suppressed: boolean;
    message?: string;
    counts?: { r0: number; r1: number; r2: number; r3: number };
    distinct_users?: number;
  };
}

interface TrendsResponse {
  window: {
    current_start: string;
    current_end: string;
    previous_start: string;
    previous_end: string;
    k_threshold: number;
  };
  metrics: MetricsResponse;
  recommendations: {
    suppressed: boolean;
    text?: string;
    message?: string;
  };
}

export default function TrendsPage() {
  const [trendsData, setTrendsData] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    async function loadTrends() {
      try {
        const { data: { session: sbSession } } = await supabase.auth.getSession();
        if (!sbSession) {
          throw new Error('Not authenticated');
        }
        const sessionData = {
          user: sbSession.user,
          access_token: sbSession.access_token,
          expires_in: sbSession.expires_in,
        };
        setSession(sessionData);

        const response = await fetch('/api/admin/trends', {
          headers: {
            Authorization: `Bearer ${sessionData.access_token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error('Not authorized to view trends');
          }
          throw new Error('Failed to fetch trends');
        }

        const data = await response.json();
        setTrendsData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    loadTrends();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav current="insights" />
        <div className="p-8">Loading trends...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav current="insights" />
        <div className="p-8 text-red-600">Error: {error}</div>
      </div>
    );
  }

  const metrics = trendsData?.metrics;
  const highIntensity = metrics?.high_intensity;
  const weekOverWeek = metrics?.week_over_week;
  const topDomain = metrics?.top_domain;
  const domainDistribution = metrics?.domain_distribution;
  const sustainedPressure = metrics?.sustained_pressure;
  const weekOverWeekColor = weekOverWeek?.suppressed
    ? 'text-slate-600'
    : (weekOverWeek?.change_pct || 0) > 0
      ? 'text-red-600'
      : 'text-green-600';

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav current="insights" />
      <div className="p-8">
        <div className="mb-6">
          <Link href="/admin" className="text-blue-600 hover:underline mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold">Cohort Trends</h1>
          <p className="text-gray-600 mt-2">Last 7 days of load distribution</p>
        </div>

        {/* Key Metrics */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-sm text-gray-600 uppercase">High Intensity Reports</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">
                {highIntensity?.suppressed
                  ? 'Insufficient data'
                  : `${Math.round(highIntensity?.value_pct || 0)}%`}
              </p>
              <p className="text-xs text-gray-600 mt-2">
                {highIntensity?.suppressed
                  ? highIntensity?.message
                  : `${highIntensity?.flagged_users || 0} high-intensity user${(highIntensity?.flagged_users || 0) !== 1 ? 's' : ''}`}
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-sm text-gray-600 uppercase">Week-over-Week Change</p>
              <p className={`text-3xl font-bold mt-2 ${weekOverWeekColor}`}>
                {weekOverWeek?.suppressed
                  ? 'Not enough data'
                  : `${(weekOverWeek?.change_pct || 0) > 0 ? '+' : ''}${Math.round(weekOverWeek?.change_pct || 0)}%`}
              </p>
              <p className="text-xs text-gray-600 mt-2">
                {weekOverWeek?.suppressed
                  ? weekOverWeek?.message
                  : (weekOverWeek?.change_pct || 0) === 0
                    ? 'Stable'
                    : 'Change detected'}
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-sm text-gray-600 uppercase">Top Pressure Domain</p>
              <p className="text-2xl font-bold mt-2">
                {topDomain?.suppressed ? 'Insufficient data' : (topDomain?.domain || 'N/A')}
              </p>
              <p className="text-xs text-gray-600 mt-2">
                {topDomain?.suppressed
                  ? topDomain?.message
                  : `${topDomain?.distinct_users || 0} student${(topDomain?.distinct_users || 0) !== 1 ? 's' : ''} reporting`}
              </p>
            </div>
          </div>
        )}

        {/* Strategic Insights */}
        {trendsData && (
          <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg mb-8">
            <h2 className="text-lg font-semibold text-blue-900 mb-3">Strategic Recommendations</h2>
            <p className="text-blue-800 text-sm">
              {trendsData.recommendations.suppressed
                ? trendsData.recommendations.message
                : trendsData.recommendations.text}
            </p>
          </div>
        )}

        {/* Domain Breakdown */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold mb-6">Domain Load Distribution</h2>
          <div className="space-y-4">
            {domainDistribution?.suppressed ? (
              <p className="text-sm text-gray-600">{domainDistribution.message}</p>
            ) : (
              domainDistribution?.domains?.map((summary) => (
                <div key={summary.domain} className="border-b pb-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-semibold">{summary.domain}</p>
                    <span className="text-sm text-gray-600">
                      Avg intensity: {summary.avgIntensity.toFixed(1)}/5
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-orange-500 h-2 rounded-full"
                      style={{ width: `${(summary.avgIntensity / 5) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    {summary.distinctUsers} student{summary.distinctUsers !== 1 ? 's' : ''} |{' '}
                    {Math.round(summary.highIntensityPct)}% high-intensity users
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Repeated Spike Domains */}
        {sustainedPressure && (
          <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
            <h2 className="text-lg font-semibold text-yellow-900 mb-3">Sustained Pressure Areas</h2>
            {sustainedPressure.suppressed ? (
              <p className="text-yellow-800 text-sm">{sustainedPressure.message}</p>
            ) : sustainedPressure.domains && sustainedPressure.domains.length > 0 ? (
              <>
                <p className="text-yellow-800 text-sm mb-4">
                  These domains show consistently high load across recent weeks:
                </p>
                <div className="flex flex-wrap gap-2">
                  {sustainedPressure.domains.map((domain) => (
                    <span key={domain} className="bg-yellow-200 text-yellow-900 px-3 py-1 rounded text-sm">
                      {domain}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-yellow-800 text-sm">No sustained pressure domains detected.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
