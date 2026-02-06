'use client';

import Link from 'next/link';

interface NavigationProps {
  currentPage: 'dashboard' | 'timeline' | 'chat' | 'settings';
}

export default function Navigation({ currentPage }: NavigationProps) {
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
          <span className="text-xl">😌</span>
          <span className="text-xs font-medium">Home</span>
        </Link>

        <Link
          href="/timeline"
          className={`flex flex-col items-center gap-1 transition-colors ${isActive('timeline')}`}
        >
          <span className="text-xl">📅</span>
          <span className="text-xs font-medium">Timeline</span>
        </Link>

        <Link
          href="/chat"
          className={`flex flex-col items-center gap-1 transition-colors ${isActive('chat')}`}
        >
          <span className="text-xl">💬</span>
          <span className="text-xs font-medium">Chat</span>
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
          Serene is not a therapist or medical care. Messages are processed to provide support.<br/>
          Crisis Resources: Samaritans 116 123 | Pieta House 1800 247 247 | Aware 1800 80 48 48
        </p>
      </footer>
    </>
  );
}
