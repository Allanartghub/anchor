'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkConsents } from '@/lib/consent';
import { generateWeeklySummaries, type WeeklySummary } from '@/lib/weeklySummary';
import { LoadEntry, WeeklyCheckinResponse } from '@/lib/types';
import Navigation from '@/components/Navigation';
import WeeklyHistoryCard from '@/components/WeeklyHistoryCard';

export default function HistoryPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [weeklySummaries, setWeeklySummaries] = useState<WeeklySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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

      setUserId(session.user.id);
      await loadHistory(session.user.id);
    };

    checkAuth();
  }, [router]);

  const loadHistory = async (uid: string) => {
    try {
      // Fetch all weekly check-ins
      const { data: checkIns, error: checkInsError } = await supabase
        .from('weekly_checkin_responses')
        .select('*')
        .eq('user_id', uid)
        .order('completed_at', { ascending: false });

      if (checkInsError) throw checkInsError;

      // Fetch all load entries
      const { data: loadEntries, error: loadEntriesError } = await supabase
        .from('load_entries')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      if (loadEntriesError) throw loadEntriesError;

      // Generate weekly summaries
      const summaries = generateWeeklySummaries(checkIns || [], loadEntries || []);
      setWeeklySummaries(summaries);
    } catch (err) {
      console.error('Error loading history:', err);
      setError('Failed to load your history. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-600">Loading your history...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-[calc(120px+env(safe-area-inset-bottom))]">
      <Navigation currentPage="dashboard" />

      <div className="flex-1 px-4 py-12">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Load History</h1>
            <p className="text-gray-600">
              Weekly summaries of your mental load. Expand any week to see individual entries.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-6">
              {error}
            </div>
          )}

          {/* Summaries List */}
          {weeklySummaries.length > 0 ? (
            <div>
              {weeklySummaries.map((summary) => (
                <WeeklyHistoryCard key={`${summary.semesterYear}-W${summary.weekNumber}`} summary={summary} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-600 mb-4">
                You haven't logged any mental load yet.
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => router.push('/checkin')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                  Start a Weekly Check-In
                </button>
                <button
                  onClick={() => router.push('/load')}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition"
                >
                  Log a Load Entry
                </button>
              </div>
            </div>
          )}

          {/* Guidance */}
          {weeklySummaries.length > 0 && (
            <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-2">How to read this view</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>Week label & severity:</strong> Overall load intensity (Light / Moderate / Heavy)</li>
                <li>• <strong>Reflection:</strong> System-generated acknowledgement of your load patterns</li>
                <li>• <strong>Expand:</strong> Click any week to see individual check-ins and load entries</li>
                <li>• <strong>Entry types:</strong> Weekly check-ins are marked separately from ad-hoc load entries</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
