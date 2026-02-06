'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage, MENTAL_LOAD_DOMAINS, type MentalLoadDomainId } from '@/lib/types';
import ChatSummaries from '@/components/ChatSummaries';
import { supabase } from '@/lib/supabase';
import { sendChatMessage } from '@/lib/chatClient';

interface ChatInterfaceProps {
  domainContext?: MentalLoadDomainId | 'general';
  entryPoint?: 'checkin' | 'load' | 'spike';
  userId?: string;
}

export default function ChatInterface({ domainContext, entryPoint, userId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content:
        "Hi, I'm Anchor. This is a structured follow-up to help you lighten your mental load.",
      created_at: new Date().toISOString(),
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Clear session on page load to ensure fresh session on reload
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('chat_session_id');
      console.log('[ChatInterface] Session cleared on page load');
    }
  }, []); // Empty deps = runs once on mount

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session?.access_token);
    };
    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session?.access_token);
      
      // Clear session on sign in/out
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('chat_session_id');
          console.log('[ChatInterface] Session cleared on auth change:', event);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || !isAuthenticated || !selectedPrompt) return;

    const composedMessage = `${selectedPrompt}\n${input}`;

    // Add user message to UI immediately
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: composedMessage,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError(null);
    setIsLoading(true);

    try {
      // Get current session_id from sessionStorage
      const currentSessionId = typeof window !== 'undefined' 
        ? sessionStorage.getItem('chat_session_id') 
        : null;

      // Use centralized chat client for all API calls
      const data = await sendChatMessage({
        message: composedMessage,
        domainContext: domainContext && domainContext !== 'general' ? domainContext : null,
        session_id: currentSessionId,
      });

      // Store the session_id returned by the API
      if (data.sessionId && typeof window !== 'undefined') {
        sessionStorage.setItem('chat_session_id', data.sessionId);
      }

      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: data.response,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Risk flag handling: Crisis resources are now appended to the main message (unified approach)
      // No additional message needed - everything is in the assistantMessage
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      // Add error message to chat
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: `I encountered an issue: ${errorMessage}. Please try again in a moment.`,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const domain = MENTAL_LOAD_DOMAINS.find((d) => d.id === domainContext);
  const domainLabel = domain?.label || 'General Load';
  const domainEmoji = domain?.emoji || '🧭';

  const promptOptions = [
    `What felt heavier than expected about ${domainLabel.toLowerCase()} this week?`,
    `What is one thing you could do to reduce ${domainLabel.toLowerCase()} this week?`,
    `What kind of support would help with ${domainLabel.toLowerCase()} right now?`,
  ];

  return (
    <div className="h-dvh flex flex-col bg-calm-cream">
      {/* Header */}
      <header className="border-b border-calm-border bg-white p-4 flex-shrink-0">
        <div className="max-w-xl mx-auto flex items-start gap-3 justify-between">
          <div>
            <h1 className="text-2xl font-light text-calm-text">Anchor Follow-Up</h1>
            <p className="text-sm text-gray-600 mt-1">
              Focus: {domainEmoji} {domainLabel}
            </p>
            {entryPoint && (
              <p className="text-xs text-gray-500 mt-1">
                Entry point: {entryPoint === 'checkin' ? 'Weekly check-in' : entryPoint === 'load' ? 'Load entry' : 'Domain spike'}
              </p>
            )}
          </div>
          <div className="flex-shrink-0">
            {userId && <ChatSummaries userId={userId} />}
          </div>
        </div>
      </header>

      {/* Main chat history - scrollable */}
      <main className="flex-1 overflow-y-auto px-4 pt-6 pb-[220px]" role="main">
        <div className="max-w-xl mx-auto">
          {!selectedPrompt && (
            <div className="calm-card mb-6">
              <h2 className="text-sm font-semibold text-calm-text mb-3">Choose a prompt to begin</h2>
              <div className="space-y-2">
                {promptOptions.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setSelectedPrompt(prompt)}
                    className="w-full text-left px-4 py-3 rounded-lg border border-calm-border bg-white hover:bg-calm-cream transition text-sm text-calm-text"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className={`${messages.length === 1 ? 'min-h-[40vh] flex items-center' : ''} space-y-4`}>
            {messages.length === 0 && (
              <div className="calm-card text-center py-12">
                <p className="text-gray-500 mb-2">No messages yet</p>
                <p className="text-xs text-gray-400">Start the conversation when you're ready.</p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-prose px-4 py-3 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-calm-blue text-calm-text'
                      : 'bg-white border border-calm-border text-calm-text'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-xs text-gray-400 mt-1 text-right">
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-calm-border text-calm-text px-4 py-3 rounded-lg">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-calm-blue rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-calm-blue rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-calm-blue rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </main>
      {/* Input - fixed above nav and footer */}
      <section className="fixed left-0 right-0 bottom-[112px] z-30">
        <div className="max-w-xl mx-auto px-4">
          <form onSubmit={handleSendMessage} className="bg-white border-t border-calm-border rounded-t-lg p-4">
            <div className="flex gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e as unknown as React.FormEvent);
                  }
                }}
                disabled={isLoading || !isAuthenticated || !selectedPrompt}
                placeholder={selectedPrompt ? 'Type your thoughts...' : 'Select a prompt to begin'}
                className="flex-1 p-3 border border-calm-border rounded-lg text-calm-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-calm-blue resize-none disabled:bg-gray-100"
                rows={2}
                maxLength={500}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim() || !isAuthenticated || !selectedPrompt}
                className="px-6 py-3 bg-calm-blue text-calm-text rounded-lg hover:bg-calm-border disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex-shrink-0"
              >
                {isLoading ? 'Sending...' : 'Send'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">{input.length}/500 characters</p>
            {!isAuthenticated && (
              <p className="text-xs text-orange-600 mt-2 font-medium">Please sign in to chat with Serene.</p>
            )}
          </form>
        </div>
      </section>
    </div>
  );
}
