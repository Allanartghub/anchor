'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getCurrentUser } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { InstitutionalAggregate, MENTAL_LOAD_DOMAINS } from '@/lib/types';

/**
 * Institutional View (Admin Only)
 * 
 * Displays anonymised cohort-level analytics:
 * - Domain-level average load intensity by week
 * - Trend deltas (week-over-week changes)
 * - Sample sizes (anonymised)
 * 
 * No PII. Access controlled at app level (admin-only check).
 * 
 * TODO (Phase 2):
 * - Polished dashboard with charts
 * - Time-series visualization
 * - Cohort comparison
 */

export default function InstitutionalViewPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [aggregates, setAggregates] = useState<InstitutionalAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push('/login');
        return;
      }

      // TODO: Add proper admin role check here
      // For now, just check that user exists
      setUser(currentUser);

      // Fetch institutional aggregates
      const { data, error: fetchError } = await supabase
        .from('institutional_aggregates')
        .select('*')
        .order('week_number', { ascending: false })
        .limit(50);

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setAggregates(data || []);
      }

      setLoading(false);
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
            <h2 className="font-bold mb-2">Error loading data</h2>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const domainMap = Object.fromEntries(
    MENTAL_LOAD_DOMAINS.map((d) => [d.id, d])
  );

  // Group by week and cohort
  const groupedData = aggregates.reduce(
    (acc, agg) => {
      const key = `${agg.cohort_code}-W${agg.week_number}`;
      if (!acc[key]) {
        acc[key] = {
          cohort: agg.cohort_code,
          week: agg.week_number,
          semester_year: agg.semester_year,
          domains: {} as Record<string, InstitutionalAggregate>,
        };
      }
      acc[key].domains[agg.domain_id] = agg;
      return acc;
    },
    {} as Record<
      string,
      {
        cohort: string;
        week: number;
        semester_year: number;
        domains: Record<string, InstitutionalAggregate>;
      }
    >
  );

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Institutional View
          </h1>
          <p className="text-gray-600 text-lg">
            Anonymised cohort mental load analytics
          </p>
        </div>

        {/* Warning Banner */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
          <p className="text-yellow-800 font-semibold">
            ⚠️ Admin-only view — No personally identifiable information
          </p>
          <p className="text-yellow-700 text-sm mt-2">
            All data is aggregated at domain and week level. Individual user data
            is never shown.
          </p>
        </div>

        {/* Data Summary */}
        {aggregates.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-600">
              No aggregated data available yet. Check back once international postgraduates start
              submitting load entries!
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-8 gap-4 p-6 bg-gray-50 border-b border-gray-200 font-semibold text-sm">
              <div>Cohort</div>
              <div>Week</div>
              <div>Domain</div>
              <div>Avg Load</div>
              <div>Median</div>
              <div>Sample Size</div>
              <div>Δ (Trend)</div>
              <div>Year</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-gray-200">
              {aggregates.slice(0, 100).map((agg, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-8 gap-4 p-6 text-sm hover:bg-gray-50"
                >
                  <div className="font-semibold">{agg.cohort_code}</div>
                  <div>W{agg.week_number}</div>
                  <div>
                    {domainMap[agg.domain_id]?.emoji}{' '}
                    {domainMap[agg.domain_id]?.label}
                  </div>
                  <div className="font-mono">
                    {agg.avg_intensity_numeric.toFixed(1)}
                  </div>
                  <div className="font-mono">
                    {agg.median_intensity_numeric.toFixed(1)}
                  </div>
                  <div className="text-gray-600">{agg.sample_size}</div>
                  <div
                    className={`font-semibold ${
                      agg.intensity_delta && agg.intensity_delta > 0
                        ? 'text-red-600'
                        : agg.intensity_delta && agg.intensity_delta < 0
                        ? 'text-green-600'
                        : 'text-gray-600'
                    }`}
                  >
                    {agg.intensity_delta ? (
                      <>
                        {agg.intensity_delta > 0 ? '↑' : '↓'}{' '}
                        {Math.abs(agg.intensity_delta).toFixed(1)}
                      </>
                    ) : (
                      '–'
                    )}
                  </div>
                  <div className="text-gray-600">{agg.semester_year}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Note */}
        <div className="mt-12 text-center text-gray-600 text-sm">
          <p>
            This view is in MVP phase. Future iterations will include charts,
            trend analysis, and more sophisticated aggregation.
          </p>
        </div>
      </div>
    </div>
  );
}
