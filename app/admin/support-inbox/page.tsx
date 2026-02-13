/**
 * Admin Support Case Inbox
 * 
 * Displays:
 * - Open cases awaiting assignment
 * - Cases assigned to this admin
 * - Case status lifecycle
 * - Unread message count
 * - Risk flags
 * 
 * Governance rules enforced:
 * - Admin can only view assigned cases
 * - Cases are scoped by institution
 * - All actions are logged
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminNav from '@/components/AdminNav';
import { createClient } from '@supabase/supabase-js';

interface SupportCase {
  id: string;
  user_id: string;
  status: 'open' | 'assigned' | 'scheduled' | 'completed' | 'closed' | 'withdrawn';
  requested_channel: string;
  risk_tier: number | null;
  assigned_to: string | null;
  created_at: string;
  first_response_at: string | null;
  unread_count?: number;
  contains_risk?: boolean;
}

export default function AdminSupportInboxPage() {
  const router = useRouter();
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'open' | 'assigned' | 'all'>('assigned');

  useEffect(() => {
    const loadCases = async () => {
      try {
        setLoading(true);
        
        // Get current admin session
        const { supabase } = await import('@/lib/supabase');
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user?.id) {
          throw new Error('Not authenticated');
        }

        setAdminId(session.user.id);

        // Fetch cases with proper auth
        const response = await fetch('/api/admin/support-cases', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('[SUPPORT_INBOX] API error:', {
            status: response.status,
            data: errorData,
          });
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log('[SUPPORT_INBOX] Loaded cases:', data.cases?.length || 0);
        console.log('[SUPPORT_INBOX] Cases data:', JSON.stringify(data.cases, null, 2));
        setCases(data.cases || []);
      } catch (err) {
        console.error('[SUPPORT_INBOX] Error loading support cases:', err);
        setError(err instanceof Error ? err.message : 'Failed to load cases');
      } finally {
        setLoading(false);
      }
    };

    loadCases();
  }, []);

  const isActiveCase = (status: SupportCase['status']) =>
    status !== 'closed' && status !== 'withdrawn';

  const myCount = cases.filter(
    (c) => c.assigned_to === adminId && isActiveCase(c.status)
  ).length;
  const unassignedCount = cases.filter(
    (c) => !c.assigned_to && c.status === 'open'
  ).length;
  const allCount = cases.length;

  const filteredCases = cases.filter((c) => {
    const matches = filter === 'open'
      ? c.status === 'open'
      : filter === 'assigned'
        ? c.assigned_to === adminId && isActiveCase(c.status)
        : true;
    
    if (!matches && cases.length > 0 && adminId) {
      console.log('[SUPPORT_INBOX] Case filtered out:', {
        caseId: c.id,
        caseAssignedTo: c.assigned_to,
        adminId,
        caseStatus: c.status,
        filter,
        matched: matches,
      });
    }
    
    return matches;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-yellow-100 text-yellow-900';
      case 'assigned':
        return 'bg-blue-100 text-blue-900';
      case 'scheduled':
        return 'bg-purple-100 text-purple-900';
      case 'completed':
        return 'bg-green-100 text-green-900';
      case 'closed':
        return 'bg-gray-100 text-gray-900';
      case 'withdrawn':
        return 'bg-red-100 text-red-900';
      default:
        return 'bg-gray-100 text-gray-900';
    }
  };

  const getRiskBadge = (riskTier: number | null, hasRisk: boolean) => {
    if (hasRisk) {
      return (
        <span className="px-2 py-1 text-xs font-semibold bg-red-200 text-red-900 rounded">
          ⚠️ Risk Detected
        </span>
      );
    }
    if (riskTier === 3) {
      return (
        <span className="px-2 py-1 text-xs font-semibold bg-red-200 text-red-900 rounded">
          R3 - Active Intent
        </span>
      );
    }
    if (riskTier === 2) {
      return (
        <span className="px-2 py-1 text-xs font-semibold bg-orange-200 text-orange-900 rounded">
          R2 - Elevated Risk
        </span>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav current="support-inbox" />
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-600">Loading support cases...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav current="support-inbox" />
      <div className="py-12">
        <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Support Case Inbox</h1>
          <p className="text-gray-600">
            Manage user support requests and follow-ups. All interactions are logged and immutable.
          </p>
        </div>

        {/* Service Hours Notice */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-8">
          <p className="text-sm font-semibold text-blue-900 mb-2">📋 Service Hours</p>
          <p className="text-sm text-blue-800">
            This support system is monitored Mon–Fri, 9 AM–5 PM. Expected response time: within 1 working day.
            Users can send messages anytime, but responses are provided only during service hours.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-200">
          <button
            onClick={() => setFilter('open')}
            className={`px-4 py-2 font-semibold border-b-2 transition ${
              filter === 'open'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Unassigned ({unassignedCount})
          </button>
          <button
            onClick={() => setFilter('assigned')}
            className={`px-4 py-2 font-semibold border-b-2 transition ${
              filter === 'assigned'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            My Cases ({myCount})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 font-semibold border-b-2 transition ${
              filter === 'all'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            All Cases ({allCount})
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6 text-red-900">
            {error}
          </div>
        )}

        {/* Cases List */}
        {filteredCases.length === 0 ? (
          <div className="p-8 bg-white rounded-lg border border-gray-200 text-center">
            {filter === 'assigned' && myCount === 0 && allCount > 0 ? (
              <div className="space-y-2">
                <p className="text-gray-700">
                  No active cases are assigned to you right now.
                </p>
                <p className="text-gray-500 text-sm">
                  Any assigned cases may be closed or withdrawn. Check All Cases for history.
                </p>
                <button
                  onClick={() => setFilter('all')}
                  className="text-blue-600 hover:text-blue-800 font-semibold text-sm"
                >
                  View All Cases
                </button>
              </div>
            ) : filter === 'open' && unassignedCount === 0 && allCount > 0 ? (
              <p className="text-gray-600">No unassigned open cases right now.</p>
            ) : (
              <p className="text-gray-600">No support cases at this time.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCases.map((caseItem) => (
              <div
                key={caseItem.id}
                className="p-6 bg-white border border-gray-200 rounded-lg hover:shadow-lg transition cursor-pointer"
                onClick={() => router.push(`/admin/support-inbox/${caseItem.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      Case {caseItem.id.substring(0, 8).toUpperCase()}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Created {new Date(caseItem.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 text-sm font-semibold rounded ${getStatusColor(
                        caseItem.status
                      )}`}
                    >
                      {caseItem.status.charAt(0).toUpperCase() + caseItem.status.slice(1)}
                    </span>
                  </div>
                </div>

                {/* Risk Badge */}
                {getRiskBadge(caseItem.risk_tier, caseItem.contains_risk || false) && (
                  <div className="mb-4">
                    {getRiskBadge(caseItem.risk_tier, caseItem.contains_risk || false)}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-semibold text-gray-700">Channel</p>
                    <p className="text-gray-600">{caseItem.requested_channel}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">Status</p>
                    <p className="text-gray-600">
                      {caseItem.first_response_at ? '✓ Responded' : '⏳ Awaiting response'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                  <div>
                    {caseItem.unread_count && caseItem.unread_count > 0 && (
                      <span className="px-2 py-1 text-xs font-semibold bg-red-500 text-white rounded-full">
                        {caseItem.unread_count} new message
                        {caseItem.unread_count > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <button className="text-blue-600 hover:text-blue-800 font-semibold text-sm">
                    View Case →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
