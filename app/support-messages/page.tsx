'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Navigation from '@/components/Navigation';

export const dynamic = 'force-dynamic';

interface SupportCase {
  id: string;
  status: string;
  created_at: string;
  first_response_at: string | null;
}

export default function SupportMessagesPage() {
  const router = useRouter();
  const [activeCases, setActiveCases] = useState<SupportCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Memoize supabase client to prevent re-renders
  const supabase = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return null;
    }

    return createClient(supabaseUrl, supabaseKey);
  }, []);

  useEffect(() => {
    const loadActiveCases = async () => {
      if (!supabase) {
        setError('Missing Supabase configuration');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          router.push('/login');
          return;
        }

        // Fetch from API endpoint
        const response = await fetch('/api/student/support-cases', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load cases');
        }

        const { cases } = await response.json();
        setActiveCases(cases || []);
      } catch (err) {
        console.error('Error loading active cases:', err);
        setError(err instanceof Error ? err.message : 'Failed to load cases');
      } finally {
        setLoading(false);
      }
    };

    loadActiveCases();
  }, [supabase, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-600">Loading your messages...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-40">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">💬 Messages</h1>
          <p className="text-sm text-gray-600 mt-1">
            {activeCases.length === 0
              ? 'No active support conversations'
              : `${activeCases.length} active conversation${activeCases.length === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">Error: {error}</p>
          </div>
        )}

        {activeCases.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-600 mb-4">
              You don't have any active support conversations yet.
            </p>
            <p className="text-sm text-gray-500">
              If you need support, let us know by completing a check-in.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeCases.map((caseItem) => (
              <button
                key={caseItem.id}
                onClick={() => router.push(`/support-inbox/${caseItem.id}`)}
                className="w-full text-left bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:bg-blue-50 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 mb-1">
                      Support Conversation
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-600">
                      <span>
                        📅 {new Date(caseItem.created_at).toLocaleDateString()}
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full ${
                          caseItem.status === 'open'
                            ? 'bg-yellow-100 text-yellow-800'
                            : caseItem.status === 'assigned'
                            ? 'bg-blue-100 text-blue-800'
                            : caseItem.status === 'scheduled'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {caseItem.status.charAt(0).toUpperCase() +
                          caseItem.status.slice(1)}
                      </span>
                    </div>
                    {caseItem.first_response_at && (
                      <p className="text-xs text-green-600 mt-2">
                        ✓ Team responded{' '}
                        {new Date(
                          caseItem.first_response_at
                        ).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="text-2xl">→</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Navigation currentPage="messages" />
    </div>
  );
}
