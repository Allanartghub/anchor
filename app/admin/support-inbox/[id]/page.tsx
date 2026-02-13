/**
 * Admin Support Case Detail Page
 * 
 * Allows admin to:
 * - View case details and conversation history
 * - Send messages to user
 * - Update case status (assign, schedule, close)
 * - View audit trail
 * - See risk flags
 */

'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase, getSession } from '../../../lib/supabase';

interface SupportCase {
  id: string;
  user_id: string;
  status: string;
  requested_channel: string;
  risk_tier: number | null;
  assigned_to: string | null;
  created_at: string;
  first_response_at: string | null;
}

interface Message {
  id: string;
  sender_type: 'user' | 'admin' | 'system';
  sender_id: string | null;
  body: string;
  created_at: string;
  contains_high_risk: boolean;
}

export default function AdminCaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const caseId = params?.id as string;
  const subscriptionRef = useRef<any>(null);

  const [supportCase, setSupportCase] = useState<SupportCase | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminId, setAdminId] = useState<string | null>(null);

  // Memoize supabase client to prevent unnecessary re-creates
  // Use shared supabase client from lib

  useEffect(() => {
    if (!caseId) return;

    const loadCaseAndMessages = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
          setError('Not authenticated');
          setLoading(false);
          return;
        }

        setAdminId(session.user.id);

        // Create abort controller with 30-second timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
          const response = await fetch(`/api/admin/support-cases/${caseId}`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            setError(errorData.error || 'Failed to load case');
            setLoading(false);
            return;
          }

          const data = await response.json();
          setSupportCase(data.case);
          setMessages(data.messages || []);
          setLoading(false);
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          
          // Silently handle AbortError
          if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
            setError('Request timeout. Please refresh the page.');
            setLoading(false);
            return;
          }
          
          throw fetchErr;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load case';
        setError(message);
        setLoading(false);
      }
    };

    loadCaseAndMessages();

    // Clean up old subscription if it exists
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    // Subscribe to new messages in real-time
    const subscription = supabase
      .channel(`case:${caseId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `case_id=eq.${caseId}`,
        },
        (payload) => {
          setMessages((prev) => {
            // Prevent duplicate messages
            if (prev.some(msg => msg.id === payload.new.id)) {
              return prev;
            }
            return [...prev, payload.new as Message];
          });
        }
      )
      .subscribe();

    subscriptionRef.current = subscription;

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [caseId, supabase]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || !adminId) return;

    try {
      setSending(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`/api/admin/support-cases/${caseId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          body: newMessage,
        }),
      });

      if (!response.ok) {
        let errorData: { error?: string } = {};
        try {
          errorData = await response.json();
        } catch (parseErr) {
          // Response is not JSON, get status text
          errorData = { error: response.statusText || `HTTP ${response.status}` };
        }
        
        const errorMsg = errorData.error || `Server error (${response.status})`;
        console.error('[SEND_MESSAGE] Error response:', { 
          status: response.status,
          data: errorData,
          message: errorMsg 
        });
        throw new Error(errorMsg);
      }

      const result = await response.json();
      
      // Add message to local state immediately (optimistic update)
      if (result.message) {
        setMessages((prev) => [...prev, result.message]);
      }
      
      setNewMessage('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send message';
      console.error('[SEND_MESSAGE] Error:', message, err);
      setError(message);
    } finally {
      setSending(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`/api/admin/support-cases/${caseId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      });

      if (!response.ok) {
        let errorData: { error?: string } = {};
        try {
          errorData = await response.json();
        } catch (parseErr) {
          // Response is not JSON, get status text
          errorData = { error: response.statusText || `HTTP ${response.status}` };
        }
        
        const errorMsg = errorData.error || `Server error (${response.status})`;
        console.error('[UPDATE_STATUS] Error response:', { 
          status: response.status,
          data: errorData,
          message: errorMsg 
        });
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setSupportCase(data.case);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update case';
      console.error('[UPDATE_STATUS] Error:', message, err);
      setError(message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading case...</p>
      </div>
    );
  }

  if (!supportCase) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Case not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Case {supportCase.id.substring(0, 8).toUpperCase()}
              </h1>
              <p className="text-sm text-gray-600">
                User: {supportCase.user_id.substring(0, 8)}... | Channel:{' '}
                {supportCase.requested_channel}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/admin')}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-medium transition"
              >
                ← Home
              </button>
              <span
                className={`px-3 py-1 text-sm font-semibold rounded ${
                  supportCase.status === 'open'
                    ? 'bg-yellow-100 text-yellow-900'
                    : supportCase.status === 'assigned'
                    ? 'bg-blue-100 text-blue-900'
                    : supportCase.status === 'closed'
                    ? 'bg-gray-100 text-gray-900'
                    : 'bg-green-100 text-green-900'
                }`}
              >
                {supportCase.status.charAt(0).toUpperCase() +
                  supportCase.status.slice(1)}
              </span>
            </div>
          </div>

          {/* Risk Badge */}
          {supportCase.risk_tier === 3 && (
            <div className="p-3 bg-red-100 border border-red-300 rounded text-sm text-red-900">
              ⚠️ <strong>R3 - Active Intent:</strong> This user flagged high-risk language.
              Prioritize response. Refer to emergency protocol if needed.
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6 text-red-900">
            {error}
          </div>
        )}

        {/* Messages Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Conversation</h2>
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="p-6 bg-white rounded-lg border border-gray-200 text-center">
                <p className="text-gray-600">
                  No messages yet. System acknowledgement has been sent to user.
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-4 rounded-lg border ${
                    msg.sender_type === 'user'
                      ? 'bg-blue-50 border-blue-200'
                      : msg.sender_type === 'admin'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-gray-100 border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-700">
                      {msg.sender_type === 'user'
                        ? '👤 User'
                        : msg.sender_type === 'admin'
                        ? '👨‍💼 You'
                        : '🤖 System'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(msg.created_at).toLocaleString()}
                    </span>
                  </div>

                  {msg.contains_high_risk && msg.sender_type === 'user' && (
                    <div className="p-2 mb-2 bg-red-200 border-l-4 border-red-500 rounded text-xs text-red-900">
                      🚨 <strong>Risk Detected:</strong> User message contains high-risk language
                    </div>
                  )}

                  <p className="text-gray-800 whitespace-pre-wrap">
                    {msg.body.replace(/\\n/g, '\n')}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Response Form */}
        {supportCase.status !== 'closed' && (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Send Response</h3>

            <form onSubmit={handleSendMessage}>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your response..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              />

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {sending ? 'Sending...' : 'Send Message'}
                </button>

                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleUpdateStatus(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Update Status</option>
                  <option value="scheduled">Mark as Scheduled</option>
                  <option value="completed">Mark as Completed</option>
                  <option value="closed">Close Case</option>
                </select>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
