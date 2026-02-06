'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { MOODS, type ChatSession } from '@/lib/types';

interface ChatSummariesProps {
  userId: string;
}

export default function ChatSummaries({ userId }: ChatSummariesProps) {
  const [summaries, setSummaries] = useState<ChatSession[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);

  useEffect(() => {
    if (isOpen && summaries.length === 0) {
      loadSummaries();
    }
  }, [isOpen]);

  const loadSummaries = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('[ChatSummaries] Loading summaries for user:', userId);
      const { data, error: queryError } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false });

      if (queryError) {
        setError('Failed to load chat history');
        console.error('[ChatSummaries] Query error:', queryError);
      } else {
        console.log('[ChatSummaries] Loaded', data?.length || 0, 'summaries');
        setSummaries(data || []);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      console.error('[ChatSummaries] Load summaries error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getMoodEmoji = (moodId: string) => {
    return MOODS.find(m => m.id === moodId)?.emoji || '?';
  };

  const getMoodLabel = (moodId: string) => {
    return MOODS.find(m => m.id === moodId)?.label || moodId;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (isYesterday) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const isSessionActive = (session: ChatSession) => {
    // Active if: no ended_at AND last_message_at within 5 minutes
    if (session.ended_at) return false;
    const SESSION_TIMEOUT_MS = 5 * 60 * 1000;
    const lastMessageTime = new Date(session.last_message_at).getTime();
    const now = Date.now();
    return (now - lastMessageTime) < SESSION_TIMEOUT_MS;
  };

  return (
    <div className="relative">
      {/* Dropdown Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-calm-blue hover:bg-calm-border text-calm-text transition-colors border border-calm-border"
        title="View past chat summaries"
      >
        <span>📋 History</span>
        <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 max-h-96 bg-white rounded-lg shadow-lg border border-calm-border overflow-hidden z-50 flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-calm-border bg-calm-teal">
            <h3 className="font-medium text-calm-text">Chat History</h3>
            <p className="text-xs text-gray-500 mt-1">Your recent chat sessions</p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-gray-500">Loading history...</p>
              </div>
            ) : error ? (
              <div className="p-4 text-sm text-red-600 bg-red-50">
                {error}
              </div>
            ) : summaries.length === 0 ? (
              <div className="flex items-center justify-center py-8 px-4">
                <p className="text-sm text-gray-500 text-center">
                  No chat history yet. Start a conversation to see summaries here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-calm-border">
                {summaries.map((summary) => (
                  <div
                    key={summary.id}
                    className="p-4 hover:bg-calm-cream transition-colors cursor-pointer group"
                    onClick={() => setSelectedSession(summary)}
                  >
                    {/* Session Title */}
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-calm-text text-sm">
                        {summary.session_title}
                      </h4>
                      <span className="text-lg">
                        {getMoodEmoji(summary.mood_at_start || 'unknown')}
                      </span>
                    </div>

                    {/* Summary Text */}
                    <p className="text-sm text-gray-700 line-clamp-2 group-hover:text-gray-900 mb-2">
                      {summary.summary_text || 'Session in progress...'}
                    </p>

                    {/* Message Count */}
                    <div className="flex items-center justify-between pt-2 border-t border-calm-border">
                      <span className="text-xs text-gray-400">
                        {summary.message_count} message{summary.message_count !== 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-calm-blue group-hover:underline">
                        View details →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {summaries.length > 0 && (
            <div className="px-4 py-2 border-t border-calm-border bg-calm-cream text-right">
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs text-calm-text hover:underline"
              >
                Close
              </button>
            </div>
          )}
        </div>
      )}

      {/* Close dropdown when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Session Detail Modal */}
      {selectedSession && (
        <>
          {/* Modal Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={() => setSelectedSession(null)}
          />
          
          {/* Modal Content */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-calm-border bg-calm-teal">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {getMoodEmoji(selectedSession.mood_at_start || 'unknown')}
                    </span>
                    <h3 className="text-lg font-medium text-calm-text">
                      {selectedSession.session_title}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedSession(null)}
                    className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Session Time */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Session Time</h4>
                  <p className="text-sm text-gray-600">
                    Started: {formatDate(selectedSession.started_at)}
                  </p>
                  {selectedSession.ended_at ? (
                    <p className="text-sm text-gray-600">
                      Ended: {formatDate(selectedSession.ended_at)}
                    </p>
                  ) : isSessionActive(selectedSession) ? (
                    <p className="text-sm text-calm-teal font-medium">
                      Status: Active
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Status: Ended
                    </p>
                  )}
                </div>

                {/* Mood */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Mood at Start</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">
                      {getMoodEmoji(selectedSession.mood_at_start || 'unknown')}
                    </span>
                    <span className="text-sm text-gray-600">
                      {getMoodLabel(selectedSession.mood_at_start || 'unknown')}
                    </span>
                  </div>
                </div>

                {/* Message Count */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Activity</h4>
                  <p className="text-sm text-gray-600">
                    {selectedSession.message_count} message{selectedSession.message_count !== 1 ? 's' : ''} exchanged
                  </p>
                </div>

                {/* Full Summary */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Session Summary</h4>
                  <div className="bg-calm-cream p-4 rounded-lg border border-calm-border">
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {selectedSession.summary_text || 'Session summary will be generated after the first few messages.'}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Note: For your privacy, individual messages are not stored or shown here.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-calm-border bg-calm-cream">
                <button
                  onClick={() => setSelectedSession(null)}
                  className="w-full px-4 py-2 bg-calm-teal text-calm-text rounded-lg hover:bg-calm-sage transition-colors font-medium text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
