// app/admin/notifications/page.tsx
'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminNotificationsPage() {
  const [email, setEmail] = useState('');
  const [type, setType] = useState<'WEEKLY_REMINDER_1' | 'WEEKLY_REMINDER_2' | 'SUPPORT_REPLY'>('WEEKLY_REMINDER_1');
  const [caseId, setCaseId] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus('');
    // Find user by email
    const { data: user, error } = await supabase
      .from('auth.users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (error || !user?.id) {
      setStatus('User not found');
      setLoading(false);
      return;
    }
    // Call API route to trigger notification
    const res = await fetch('/api/admin/notifications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, type, case_id: caseId }),
    });
    if (res.ok) setStatus('Notification sent!');
    else setStatus('Failed to send notification');
    setLoading(false);
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Send Notification Email</h1>
      <form onSubmit={handleSend} className="space-y-4">
        <div>
          <label>Email address</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            required
          />
        </div>
        <div>
          <label>Notification type</label>
          <select
            value={type}
            onChange={e => setType(e.target.value as any)}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="WEEKLY_REMINDER_1">Weekly Reminder 1</option>
            <option value="WEEKLY_REMINDER_2">Weekly Reminder 2</option>
            <option value="SUPPORT_REPLY">Support Reply</option>
          </select>
        </div>
        {type === 'SUPPORT_REPLY' && (
          <div>
            <label>Case ID</label>
            <input
              type="text"
              value={caseId}
              onChange={e => setCaseId(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              required
            />
          </div>
        )}
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Sending...' : 'Send Notification'}
        </button>
        {status && <div className="mt-2 text-sm">{status}</div>}
      </form>
    </div>
  );
}
