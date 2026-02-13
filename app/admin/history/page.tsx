'use client';

/**
 * /app/admin/history/page.tsx
 *
 * Admin view of recent student check-ins for the institution.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import AdminNav from '@/components/AdminNav';

interface HistoryItem {
  id: string;
  user_id: string;
  week_number: number;
  semester_year: number;
  primary_domain_id: string | null;
  secondary_domain_id: string | null;
  intensity_numeric: number;
  risk_score: number;
  high_risk: boolean;
  trigger_reasons: any;
  response_text: string | null;
  created_at: string;
}

export default function AdminHistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        const { data: { session: sbSession } } = await supabase.auth.getSession();
        if (!sbSession) {
          setError('Not authenticated');
          return;
        }

        const response = await fetch('/api/admin/history?limit=100', {
          headers: {
            Authorization: `Bearer ${sbSession.access_token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData?.error || 'Failed to fetch history');
        }

        const data = await response.json();
        setItems(data.history || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <AdminNav current="insights" />
        <div className="p-8">Loading history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <AdminNav current="insights" />
        <div className="p-8 text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AdminNav current="insights" />
      <div className="p-8 flex-1 flex flex-col">
        <h1 className="text-3xl font-bold mb-2">Student Check-in History</h1>
        <p className="text-gray-600 mb-6">Most recent entries across your institution.</p>

        <div className="flex-1 min-h-0">
          {items.length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow text-center text-gray-600">
              No check-ins available yet.
            </div>
          ) : (
            <div className="space-y-4 h-full overflow-y-auto pr-2">
              {items.map((item) => (
                <div key={item.id} className="bg-white p-6 rounded-lg shadow">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="text-sm text-gray-600">
                      User {item.user_id.slice(0, 8)}... | Week {item.week_number} | {new Date(item.created_at).toLocaleDateString()}
                    </div>
                    <div className={`text-xs px-2 py-1 rounded ${item.high_risk ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {item.high_risk ? `High Risk (${item.risk_score})` : `Low Risk (${item.risk_score})`}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                    <div>
                      <div className="text-gray-500">Primary Domain</div>
                      <div className="font-semibold">{item.primary_domain_id || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Secondary Domain</div>
                      <div className="font-semibold">{item.secondary_domain_id || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Intensity</div>
                      <div className="font-semibold">{item.intensity_numeric}/5</div>
                    </div>
                  </div>

                  {item.response_text && (
                    <div className="bg-slate-50 border border-slate-200 rounded p-4 text-sm text-slate-700 whitespace-pre-wrap">
                      {item.response_text}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
