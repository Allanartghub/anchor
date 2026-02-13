'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

interface NavigationProps {
  currentPage: 'dashboard' | 'timeline' | 'settings' | 'history' | 'messages';
}

export default function Navigation({ currentPage }: NavigationProps) {
  const [hasActiveCases, setHasActiveCases] = useState(false);
  const [loading, setLoading] = useState(true);

  // Memoize supabase client
  const supabase = useMemo(
    () =>
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  useEffect(() => {
    const checkActiveCases = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          setLoading(false);
          return;
        }

        // Fetch from API endpoint
        const response = await fetch('/api/student/support-cases', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const { cases } = await response.json();
          if (cases && cases.length > 0) {
            setHasActiveCases(true);
          }
        }
      } catch (err) {
        console.error('Error checking active cases:', err);
      } finally {
        setLoading(false);
      }
    };

    checkActiveCases();
  }, [supabase]);

  const isActive = (page: string) => currentPage === page ? 'text-calm-teal' : 'text-gray-400';

  return (
    <>
      {/* Navigation bar - fixed above footer */}
      <nav className="fixed bottom-[56px] left-0 right-0 bg-white border-t border-calm-border z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex justify-around items-center">
        <Link
          href="/dashboard"
          className={`flex flex-col items-center gap-1 transition-colors ${isActive('dashboard')}`}
        >
          <span className="text-xl">🧭</span>
          <span className="text-xs font-medium">Home</span>
        </Link>

        {hasActiveCases && (
          <Link
            href="/support-messages"
            className={`flex flex-col items-center gap-1 transition-colors ${isActive('messages')}`}
          >
            <span className="text-xl">💬</span>
            <span className="text-xs font-medium">Messages</span>
          </Link>
        )}

        <Link
          href="/history"
          className={`flex flex-col items-center gap-1 transition-colors ${isActive('history')}`}
        >
          <span className="text-xl">📊</span>
          <span className="text-xs font-medium">History</span>
        </Link>

        <Link
          href="/timeline"
          className={`flex flex-col items-center gap-1 transition-colors ${isActive('timeline')}`}
        >
          <span className="text-xl">😌</span>
          <span className="text-xs font-medium">Mood</span>
        </Link>

        <Link
          href="/settings"
          className={`flex flex-col items-center gap-1 transition-colors ${isActive('settings')}`}
        >
          <span className="text-xl">⚙️</span>
          <span className="text-xs font-medium">Settings</span>
        </Link>
      </div>
      </nav>

      {/* Footer - fixed at very bottom with safe-area padding */}
      <footer className="fixed bottom-0 left-0 right-0 text-xs text-slate-500 bg-slate-50 border-t border-calm-border px-4 py-3 text-center z-20 h-14 flex items-center justify-center pb-[env(safe-area-inset-bottom)]">
        <p className="max-w-2xl mx-auto">
          Anchor is not therapy or medical care. If you feel unsafe, seek professional support.<br/>
          Ireland crisis resources: Samaritans 116 123 | Pieta House 1800 247 247 | Aware 1800 80 48 48
        </p>
      </footer>
    </>
  );
}
