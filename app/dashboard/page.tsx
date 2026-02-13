'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkConsents } from '@/lib/consent';
import { MENTAL_LOAD_DOMAINS, type LoadEntry, type WeeklyCheckinResponse } from '@/lib/types';
import Navigation from '@/components/Navigation';

/**
 * Dashboard (Load-Focused)
 * 
 * Primary interface for Anchor MVP.
 * Emphasizes:
 * - Weekly check-in as default entry point
 * - Ad-hoc load tracking
 * - Domain-level mental load overview
 * - Recent activity
 */

export default function DashboardPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadEntries, setLoadEntries] = useState<LoadEntry[]>([]);
  const [weeklyCheckins, setWeeklyCheckins] = useState<WeeklyCheckinResponse[]>([]);
  const [activeSupportCases, setActiveSupportCases] = useState(0);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const hasConsented = await checkConsents(session.user.id);
      if (!hasConsented) {
        router.push('/consent');
        return;
      }

      await fetchUserData(session.user.id, session.access_token);
      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

  const fetchUserData = async (userId: string, sessionToken: string) => {
    try {
      const { data: entries, error: entriesError } = await supabase
        .from('load_entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (entriesError) throw entriesError;
      setLoadEntries(entries || []);

      const { data: checkins, error: checkinsError } = await supabase
        .from('weekly_checkin_responses')
        .select('*')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })
        .limit(5);

      if (checkinsError) throw checkinsError;
      setWeeklyCheckins(checkins || []);

      // Fetch active support cases via API
      const response = await fetch('/api/student/support-cases', {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.ok) {
        const { cases } = await response.json();
        setActiveSupportCases(cases?.length || 0);
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError('Failed to load your data');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation currentPage="dashboard" />

      <div className="flex-1 px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Stay Steady</h1>
            <p className="text-gray-600 text-lg">
              Anchor tracks your mental load across 7 key areas to spot patterns and support you early.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-12">
            <p className="text-sm text-blue-900">
              <strong>For international postgraduate students in their first 12 months in Ireland.</strong>
            </p>
          </div>

          {activeSupportCases > 0 && (
            <div className="bg-green-50 border border-green-300 rounded-lg p-4 mb-12 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-green-900">
                  💬 You have {activeSupportCases} active support conversation{activeSupportCases === 1 ? '' : 's'}
                </p>
                <p className="text-xs text-green-800 mt-1">
                  The wellbeing team is here to help. Check your messages for updates.
                </p>
              </div>
              <button
                onClick={() => router.push('/support-messages')}
                className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition whitespace-nowrap ml-4"
              >
                View Messages →
              </button>
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200 p-8 mb-12 shadow-sm hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Weekly Check-In</h2>
                <p className="text-gray-600 mb-6">
                  Take 3–5 minutes to reflect on what felt heavier than expected this week.
                </p>
                <button
                  onClick={() => router.push('/checkin')}
                  className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
                >
                  Start Check-In →
                </button>
              </div>
              <div className="text-6xl">📅</div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-8 mb-12 shadow-sm hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Log Current Pressure</h2>
                <p className="text-gray-600 mb-6">
                  Something putting pressure on you today? Log it anytime.
                </p>
                <button
                  onClick={() => router.push('/load')}
                  className="px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition"
                >
                  Log Load Entry
                </button>
              </div>
              <div className="text-6xl">📊</div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-8 mb-12 shadow-sm hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Quick Mood Snapshot</h2>
                <p className="text-gray-600 mb-6">
                  Capture how you're feeling right now—daily or weekly.
                </p>
                <button
                  onClick={() => router.push('/mood')}
                  className="px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition"
                >
                  Log Mood
                </button>
              </div>
              <div className="text-6xl">😌</div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-8 mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Load Domains</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {MENTAL_LOAD_DOMAINS.map((domain) => (
                <div
                  key={domain.id}
                  className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-center"
                >
                  <div className="text-3xl mb-2">{domain.emoji}</div>
                  <div className="text-sm font-semibold text-gray-900">{domain.label}</div>
                </div>
              ))}
            </div>
          </div>

          {(loadEntries.length > 0 || weeklyCheckins.length > 0) && (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-600 mb-4">You have {loadEntries.length + weeklyCheckins.length} entries recorded.</p>
              <button
                onClick={() => router.push('/history')}
                className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
              >
                View Your Load History →
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-start px-4 py-3 mb-4 rounded-lg bg-red-50 border border-red-200">
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
