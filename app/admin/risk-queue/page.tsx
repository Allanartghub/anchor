'use client';

/**
 * /app/admin/risk-queue/page.tsx
 * 
 * Risk queue dashboard.
 * 
 * Lists flagged high-risk cases with:
 * - Risk score
 * - Trigger reasons
 * - Week number + domain
 * - Intensity level
 * - Time in journey
 * - Mark as reviewed button
 * 
 * NO raw reflection text shown by default.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import AdminNav from '@/components/AdminNav';

interface RiskQueueItem {
  id: string;
  user_id: string;
  checkin_id: string;
  risk_score: number;
  trigger_reasons: string[];
  week_number: number;
  primary_domain: string | null;
  intensity: number;
  weeks_since_arrival: number;
  created_at: string;
  reviewed: boolean;
}

export default function RiskQueuePage() {
  const router = useRouter();
  const [queue, setQueue] = useState<RiskQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadQueue() {
      try {
        // Get session from Supabase client
        const { data: { session: sbSession } } = await supabase.auth.getSession();
        if (!sbSession) {
          router.push('/login');
          return;
        }

        const sessionData = {
          user: sbSession.user,
          access_token: sbSession.access_token,
          expires_in: sbSession.expires_in,
        };
        setSession(sessionData);

        // Fetch risk queue
        const response = await fetch('/api/admin/risk-queue', {
          headers: {
            Authorization: `Bearer ${sessionData.access_token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error('Not authorized to view risk queue');
          }
          throw new Error('Failed to fetch risk queue');
        }

        const data = await response.json();
        setQueue(data.queue || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    loadQueue();
  }, [router]);

  const handleMarkReviewed = async (risk_event_id: string, review_notes?: string) => {
    if (!session) return;

    try {
      const response = await fetch('/api/admin/mark-reviewed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          risk_event_id,
          review_notes,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark as reviewed');
      }

      // Remove from queue
      setQueue((prev) => prev.filter((item) => item.id !== risk_event_id));
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav current="insights" />
        <div className="p-8">Loading risk queue...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav current="insights" />
        <div className="p-8">
          <div className="text-red-600 mb-4">Error: {error}</div>
          <Link href="/admin" className="text-blue-600 hover:underline">
            Return to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav current="insights" />
      <div className="p-8">
        <div className="mb-6">
          <Link href="/admin" className="text-blue-600 hover:underline mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold">Risk Queue</h1>
          <p className="text-gray-600 mt-2">
            {queue.length} flagged case{queue.length !== 1 ? 's' : ''} pending review
          </p>
        </div>

        {queue.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow text-center">
            <p className="text-gray-600">All cases reviewed. Great work!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {queue.map((item) => (
              <div key={item.id} className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg">
                      User {item.user_id.slice(0, 8)}...
                    </h3>
                    <p className="text-sm text-gray-600">
                      Week {item.week_number} | {item.weeks_since_arrival} weeks in journey
                    </p>
                  </div>
                  <div className="bg-red-100 px-3 py-1 rounded text-red-900 font-bold">
                    Risk: {item.risk_score}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-600 uppercase">Domain</p>
                    <p className="font-semibold">{item.primary_domain || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 uppercase">Intensity</p>
                    <p className="font-semibold">{item.intensity}/5</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 uppercase">Flagged</p>
                    <p className="font-semibold">
                      {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 uppercase">Status</p>
                    <p className={`font-semibold ${item.reviewed ? 'text-green-600' : 'text-red-600'}`}>
                      {item.reviewed ? 'Reviewed' : 'Pending'}
                    </p>
                  </div>
                </div>

                {item.trigger_reasons.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-600 uppercase mb-2">Trigger Reasons</p>
                    <div className="flex flex-wrap gap-2">
                      {item.trigger_reasons.map((reason, idx) => (
                        <span key={idx} className="bg-gray-100 px-2 py-1 rounded text-sm">
                          {reason}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Review notes (optional)
                  </label>
                  <textarea
                    value={reviewNotes[item.id] || ''}
                    onChange={(event) =>
                      setReviewNotes((prev) => ({
                        ...prev,
                        [item.id]: event.target.value,
                      }))
                    }
                    rows={3}
                    placeholder="Add notes for this review..."
                    className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
                  />
                  <button
                    onClick={() => handleMarkReviewed(item.id, reviewNotes[item.id])}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                  >
                    Mark Reviewed
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
