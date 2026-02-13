'use client';

/**
 * /app/admin/support-requests/page.tsx
 * 
 * Support Requests Queue (opt-in only)
 * 
 * Shows ONLY cases where students explicitly requested contact:
 * - "Contact me"
 * - "Refer to support services"  
 * - "Email resources"
 * - "Request a call"
 * 
 * GDPR-compliant: consent-gated, audit-logged, purpose-limited
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminNav from '@/components/AdminNav';

interface SupportRequest {
  id: string;
  case_token: string;
  request_type: 'contact_me' | 'refer_to_support' | 'email_resources' | 'request_call';
  context_excerpt: string | null;
  risk_tier: number | null;
  status: 'pending' | 'in_progress' | 'completed' | 'withdrawn';
  created_at: string;
  reviewed_at: string | null;
  assigned_to: string | null;
}

interface SupportCase {
  id: string;
  user_id: string;
  status: 'open' | 'assigned' | 'scheduled' | 'completed' | 'closed' | 'withdrawn';
  requested_channel: string;
  risk_tier: number | null;
  created_at: string;
  first_response_at: string | null;
}

export default function SupportRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [activeCases, setActiveCases] = useState<SupportCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'requests' | 'cases'>('requests');
  const [filter, setFilter] = useState<'pending' | 'in_progress' | 'completed' | 'all'>('pending');
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [updating, setUpdating] = useState<string | null>(null);
  const pendingCount = requests.filter((request) => request.status === 'pending').length;

  useEffect(() => {
    if (view === 'requests') {
      fetchRequests();
    } else {
      fetchActiveCases();
    }
  }, [filter, view]);

  async function fetchActiveCases() {
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch(`/api/admin/support-cases?status=open,assigned,scheduled`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch active cases');
      }

      const data = await response.json();
      setActiveCases(data.cases || []);
    } catch (err) {
      console.error('[ACTIVE_CASES] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchRequests() {
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch(`/api/admin/support-requests?status=${filter}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch support requests');
      }

      const data = await response.json();
      setRequests(data.requests || []);
    } catch (err) {
      console.error('[SUPPORT_REQUESTS] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function updateRequest(caseToken: string, newStatus: string) {
    try {
      setUpdating(caseToken);
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/admin/support-requests', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          case_token: caseToken,
          status: newStatus,
          resolution_notes: resolutionNotes[caseToken] || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update request');
      }

      // Refresh list
      await fetchRequests();
      
      // Clear notes
      setResolutionNotes(prev => {
        const updated = { ...prev };
        delete updated[caseToken];
        return updated;
      });
    } catch (err) {
      console.error('[SUPPORT_REQUESTS] Update error:', err);
      alert(err instanceof Error ? err.message : 'Failed to update request');
    } finally {
      setUpdating(null);
    }
  }

  async function createAndOpenCase(request: SupportRequest) {
    try {
      setUpdating(request.case_token);
      console.log('[SUPPORT_REQUESTS] Creating case for request:', request);
      
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      console.log('[SUPPORT_REQUESTS] Session valid, calling create-case API', {
        request_id: request.id,
        case_token: request.case_token,
        risk_tier: request.risk_tier,
      });

      // Create support case from request
      const response = await fetch('/api/admin/support-requests/create-case', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          request_id: request.id,
          case_token: request.case_token,
          context: request.context_excerpt,
          risk_tier: request.risk_tier,
        }),
      });

      console.log('[SUPPORT_REQUESTS] API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[SUPPORT_REQUESTS] API error:', errorData);
        throw new Error(errorData.error || 'Failed to create case');
      }

      const data = await response.json();
      console.log('[SUPPORT_REQUESTS] Case created successfully:', data);
      
      // Mark request as in_progress (don't wait - just fire it)
      updateRequest(request.case_token, 'in_progress').catch(err => {
        console.warn('[SUPPORT_REQUESTS] Warning updating request status:', err);
        // Continue anyway - case was created
      });
      
      // Small delay to ensure database is ready
      console.log('[SUPPORT_REQUESTS] Redirecting to case:', data.case_id);
      await new Promise(resolve => setTimeout(resolve, 500));
      router.push(`/admin/support-inbox/${data.case_id}`);
    } catch (err) {
      console.error('[SUPPORT_REQUESTS] Case creation error:', err);
      alert('Error: ' + (err instanceof Error ? err.message : 'Failed to create case'));
    } finally {
      setUpdating(null);
    }
  }

  const requestTypeLabels: Record<string, string> = {
    contact_me: 'Contact Me',
    refer_to_support: 'Refer to Support',
    email_resources: 'Email Resources',
    request_call: 'Request Call',
  };

  const riskTierLabels: Record<number, { label: string; color: string }> = {
    0: { label: 'R0: Normal', color: 'text-slate-600 bg-slate-100' },
    1: { label: 'R1: Elevated', color: 'text-yellow-700 bg-yellow-100' },
    2: { label: 'R2: Support-eligible', color: 'text-orange-700 bg-orange-100' },
    3: { label: 'R3: Priority', color: 'text-red-700 bg-red-100' },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav current="support-inbox" />
        <div className="p-8">Loading support requests...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav current="support-inbox" />
        <div className="p-8">
          <div className="bg-red-50 border border-red-200 p-4 rounded mb-4">
            <p className="text-red-900 font-semibold">Error</p>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav current="support-inbox" />
      <div className="p-8 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Support Requests & Cases
          </h1>
          <p className="text-slate-600">
            Manage support requests and active cases.
          </p>
        </div>

        {pendingCount > 0 && view === 'requests' && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {pendingCount} opted-in request{pendingCount === 1 ? '' : 's'} awaiting admin response.
              </span>
              <button
                onClick={() => router.push('/admin/support-inbox')}
                className="text-amber-900 font-semibold hover:underline"
              >
                Go to Support Inbox
              </button>
            </div>
          </div>
        )}

        {/* View Toggle (Requests vs Active Cases) */}
        <div className="mb-8 flex gap-2 border-b border-slate-300">
          <button
            onClick={() => { setView('requests'); setFilter('pending'); }}
            className={`px-4 py-3 border-b-2 font-medium text-sm transition ${
              view === 'requests'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            📋 Pending Requests ({requests.length})
          </button>
          <button
            onClick={() => { setView('cases'); }}
            className={`px-4 py-3 border-b-2 font-medium text-sm transition ${
              view === 'cases'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            💬 Active Cases ({activeCases.length})
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex gap-2 border-b border-slate-200">
          {['pending', 'in_progress', 'completed', 'all'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status as any)}
              className={`px-4 py-2 border-b-2 font-medium text-sm transition ${
                filter === status
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              {status === 'pending' && requests.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                  {requests.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Requests List */}
        {view === 'requests' && (
          <>
            {requests.length === 0 ? (
              <div className="bg-white p-8 rounded-lg shadow text-center">
                <p className="text-slate-600">
                  No {filter !== 'all' ? filter.replace('_', ' ') : ''} support requests.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-white p-6 rounded-lg shadow hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-sm text-slate-600">
                            {request.case_token}
                          </span>
                          {request.risk_tier !== null && (
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              riskTierLabels[request.risk_tier]?.color || 'text-slate-600 bg-slate-100'
                            }`}>
                              {riskTierLabels[request.risk_tier]?.label || 'Unknown'}
                            </span>
                          )}
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            request.status === 'pending' ? 'text-blue-700 bg-blue-100' :
                            request.status === 'in_progress' ? 'text-yellow-700 bg-yellow-100' :
                            request.status === 'completed' ? 'text-green-700 bg-green-100' :
                            'text-slate-700 bg-slate-100'
                          }`}>
                            {request.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          {requestTypeLabels[request.request_type] || request.request_type}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Requested {new Date(request.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Context Excerpt (redacted) */}
                    {request.context_excerpt && (
                      <div className="mb-4 p-3 bg-slate-50 rounded text-sm text-slate-700">
                        <p className="font-semibold text-xs text-slate-600 mb-1">Context (Redacted):</p>
                        <p>{request.context_excerpt}</p>
                      </div>
                    )}

                    {/* Resolution Notes */}
                    {request.status === 'pending' || request.status === 'in_progress' ? (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Resolution Notes:
                        </label>
                        <textarea
                          value={resolutionNotes[request.case_token] || ''}
                          onChange={(e) => setResolutionNotes(prev => ({
                            ...prev,
                            [request.case_token]: e.target.value,
                          }))}
                          placeholder="Add notes about how this request was handled..."
                          className="w-full p-3 border border-slate-300 rounded text-sm resize-none"
                          rows={3}
                        />
                      </div>
                    ) : null}

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {request.status === 'pending' && (
                        <>
                          <button
                            onClick={() => createAndOpenCase(request)}
                            disabled={updating === request.case_token}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                          >
                            {updating === request.case_token ? 'Creating...' : '📧 Contact Student'}
                          </button>
                          <button
                            onClick={() => updateRequest(request.case_token, 'in_progress')}
                            disabled={updating === request.case_token}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                          >
                            Mark In Progress
                          </button>
                        </>
                      )}
                      {request.status === 'in_progress' && (
                        <>
                          <button
                            onClick={() => router.push('/admin/support-inbox')}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                          >
                            📨 View Messages
                          </button>
                          <button
                            onClick={() => updateRequest(request.case_token, 'completed')}
                            disabled={updating === request.case_token}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
                          >
                            {updating === request.case_token ? 'Updating...' : 'Mark Completed'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Active Cases List */}
        {view === 'cases' && (
          <>
            {activeCases.length === 0 ? (
              <div className="bg-white p-8 rounded-lg shadow text-center">
                <p className="text-slate-600">No active support cases.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeCases.map((caseItem) => (
                  <div
                    key={caseItem.id}
                    className="bg-white p-6 rounded-lg shadow hover:shadow-md transition cursor-pointer hover:bg-slate-50"
                    onClick={() => router.push(`/admin/support-inbox/${caseItem.id}`)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-sm text-slate-600">
                            {caseItem.id.slice(0, 8)}...
                          </span>
                          {caseItem.risk_tier !== null && (
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              riskTierLabels[caseItem.risk_tier]?.color || 'text-slate-600 bg-slate-100'
                            }`}>
                              {riskTierLabels[caseItem.risk_tier]?.label || 'Unknown'}
                            </span>
                          )}
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            caseItem.status === 'open' ? 'text-blue-700 bg-blue-100' :
                            caseItem.status === 'assigned' ? 'text-purple-700 bg-purple-100' :
                            caseItem.status === 'scheduled' ? 'text-yellow-700 bg-yellow-100' :
                            caseItem.status === 'completed' ? 'text-green-700 bg-green-100' :
                            'text-slate-700 bg-slate-100'
                          }`}>
                            {caseItem.status}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          Requested channel: {caseItem.requested_channel || 'Not specified'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Created {new Date(caseItem.created_at).toLocaleString()}
                        </p>
                        {caseItem.first_response_at && (
                          <p className="text-xs text-slate-500">
                            First response {new Date(caseItem.first_response_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/admin/support-inbox/${caseItem.id}`);
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                        >
                          📨 View & Message
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Privacy Notice */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
          <p className="font-semibold mb-1">Consent & Privacy</p>
          <p>
            All requests in this queue have explicit user consent for support contact. 
            All view and update actions are logged for audit purposes. 
            Context excerpts are automatically redacted and case tokens are pseudonymised.
          </p>
        </div>
      </div>
    </div>
  );
}
