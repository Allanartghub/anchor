/**
 * User Support Inbox
 * 
 * Student-facing interface for:
 * - Viewing support cases they initiated
 * - Reading messages from institutional support team
 * - Sending follow-up messages
 * - Service hours & expected response times
 * - Risk banner if high-risk language detected
 * 
 * Key principles:
 * - Clear communication about service hours
 * - Transparent SLA display
 * - Emergency contacts always visible
 * - Risk flagging (not censoring)
 */

'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

interface SupportCase {
  id: string;
  status: string;
  requested_channel: string;
  created_at: string;
}

interface SupportMessage {
  id: string;
  sender_type: 'user' | 'admin' | 'system';
  body: string;
  created_at: string;
  contains_high_risk: boolean;
}

export default function UserSupportInboxPage() {
  const router = useRouter();
  const params = useParams();
  const caseId = params?.id as string;
  const subscriptionRef = useRef<any>(null);

  const [supportCase, setSupportCase] = useState<SupportCase | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slaConfig, setSlaConfig] = useState<any>(null);
  const [containsRisk, setContainsRisk] = useState(false);

  // Memoize Supabase client to prevent recreating on every render
  const supabase = useMemo(() => 
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );

  useEffect(() => {
    if (!caseId) return;

    const loadCaseAndMessages = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get session for auth header
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          router.push('/login');
          return;
        }

        // Create abort controller with 30-second timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
          // Fetch via API endpoint (includes ownership verification)
          const response = await fetch(`/api/support-cases/${caseId}`, {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            if (response.status === 404) {
              setError('Case not found or access denied');
              setLoading(false);
              return;
            }
            setError('Failed to load case');
            setLoading(false);
            return;
          }

          const { case: caseData, messages: msgData, slaConfig: slaData } = await response.json();

          setSupportCase(caseData);
          setMessages(msgData || []);
          setSlaConfig(slaData);
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

    // Subscribe to new messages (only once per caseId)
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
            return [...prev, payload.new as SupportMessage];
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
  }, [caseId, supabase, router]);

  // Risk detection
  useEffect(() => {
    const riskKeywords = [
      'suicidal',
      'suicide',
      'kill myself',
      'end my life',
      'end it',
      'self-harm',
      'self harm',
      'hurt myself',
      'harm myself',
    ];
    const hasRisk = riskKeywords.some((keyword) =>
      newMessage.toLowerCase().includes(keyword)
    );
    setContainsRisk(hasRisk);
  }, [newMessage]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim()) return;

    try {
      setSending(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('Not authenticated');

      const response = await fetch('/api/support-messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          case_id: caseId,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading support conversation...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Support Conversation</h1>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-medium transition"
            >
              ← Home
            </button>
          </div>
          <p className="text-sm text-gray-600">
            Case Created:{' '}
            {supportCase && new Date(supportCase.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Service Hours & Expectations */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-8">
          <p className="text-sm font-semibold text-blue-900 mb-2">📋 How This Works</p>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>
              ⏰ <strong>Service Hours:</strong>{' '}
              {slaConfig?.service_hours_display_text || 'Mon–Fri, 9 AM–5 PM'}
            </li>
            <li>
              ⏳ <strong>Expected Response:</strong>{' '}
              {slaConfig?.expected_response_window_display || 'within 1 working day'}
            </li>
            <li>
              📱 <strong>Not 24/7 Monitored:</strong> You can send messages anytime, we'll
              respond during service hours
            </li>
            <li>
              🆘 <strong>Emergency:</strong> If you're in immediate danger, contact emergency
              services or crisis lines
            </li>
          </ul>
        </div>

        {/* Crisis Resources */}
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-8">
          <p className="text-sm font-semibold text-red-900 mb-2">🆘 Emergency Support (24/7)</p>
          <ul className="text-sm text-red-800 space-y-1">
            <li>🇮🇪 <strong>Samaritans Ireland:</strong> 116 123</li>
            <li>🇮🇪 <strong>Pieta House (Suicidal Crisis):</strong> 1800 247 247</li>
            <li>🌍 <strong>Crisis Text Line:</strong> Text HELLO to 50808</li>
          </ul>
        </div>

        {/* Messages */}
        <div className="space-y-4 mb-8">
          <h2 className="text-lg font-semibold text-gray-900">Conversation</h2>

          {messages.length === 0 ? (
            <div className="p-6 bg-white rounded-lg border border-gray-200 text-center">
              <p className="text-gray-600">
                We've received your request. A message will appear here soon.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-4 rounded-lg border ${
                    msg.sender_type === 'user'
                      ? 'bg-blue-50 border-blue-200 ml-8'
                      : msg.sender_type === 'admin'
                      ? 'bg-white border-gray-200 mr-8'
                      : 'bg-gray-100 border-gray-200 mx-8'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-600">
                      {msg.sender_type === 'user'
                        ? 'You'
                        : msg.sender_type === 'admin'
                        ? '👨‍💼 Wellbeing Team'
                        : '🤖 System Message'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(msg.created_at).toLocaleString()}
                    </span>
                  </div>

                  {msg.contains_high_risk && msg.sender_type !== 'system' && (
                    <div className="p-2 mb-2 bg-red-100 border-l-4 border-red-500 rounded text-xs text-red-900">
                      ⚠️ <strong>Risk Detected:</strong> This message contains language
                      suggesting high distress. Are you in immediate danger? Contact emergency
                      services.
                    </div>
                  )}

                  <p className="text-gray-800 whitespace-pre-wrap">
                    {msg.body.replace(/\\n/g, '\n')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Message Form */}
        {supportCase?.status !== 'closed' && supportCase?.status !== 'withdrawn' && (
          <form onSubmit={handleSendMessage} className="bg-white p-6 rounded-lg border border-gray-200">
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Send a Message
            </label>

            {containsRisk && (
              <div className="p-3 mb-4 bg-yellow-100 border border-yellow-300 rounded text-sm text-yellow-900">
                ⚠️ <strong>We notice your message contains concerning language.</strong> If you're in immediate distress, please reach out to emergency services or one of the crisis resources above.
              </div>
            )}

            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message... (can be sent anytime, responses during service hours)"
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            />

            <button
              type="submit"
              disabled={sending || !newMessage.trim()}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        )}

        {(supportCase?.status === 'closed' || supportCase?.status === 'withdrawn') && (
          <div className="p-6 bg-gray-100 rounded-lg border border-gray-300 text-center">
            <p className="text-gray-700 font-semibold">This case is closed.</p>
            <p className="text-sm text-gray-600 mt-2">
              If you need further support, please submit a new request.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
