import { supabase } from '@/lib/supabase';
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface AdminNavProps {
  current: 'dashboard' | 'support-inbox' | 'insights' | 'reports' | 'governance';
}

export default function AdminNav({ current }: AdminNavProps) {
  const router = useRouter();

  const isActive = (page: AdminNavProps['current']) =>
    current === page ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900';

  return (
    <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/admin" className="text-sm font-semibold text-slate-600 hover:text-slate-900 uppercase tracking-wide">
            Administration
          </Link>
          <nav className="flex items-center gap-8 text-sm font-medium border-l border-slate-200 pl-8">
            <Link href="/admin" className={isActive('dashboard')}>
              Dashboard
            </Link>
            <Link href="/admin/support-inbox" className={isActive('support-inbox')}>
              Support Inbox
            </Link>
            <Link href="/admin/trends" className={isActive('insights')}>
              Cohort Insights
            </Link>
            <Link href="/admin/reports" className={isActive('reports')}>
              Reports & Exports
            </Link>
            <Link href="/admin/governance" className={isActive('governance')}>
              Governance & Audit
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {current !== 'dashboard' && (
            <Link
              href="/admin"
              className="text-sm text-slate-500 hover:text-slate-900 flex items-center gap-1"
            >
              ← Back to Dashboard
            </Link>
          )}
          <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push('/login');
          }}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          Logout
        </button>
        </div>
      </div>
    </div>
  );
}
