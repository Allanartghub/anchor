// app/settings/notifications/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    async function fetchPrefs() {
      setLoading(true);
      setError('');
      const { data, error } = await supabase
        .from('user_notification_prefs')
        .select('*')
        .maybeSingle();
      if (error) setError('Failed to load preferences');
      setPrefs(data);
      setLoading(false);
    }
    fetchPrefs();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    const { error } = await supabase
      .from('user_notification_prefs')
      .upsert({
        ...prefs,
      });
    if (error) setError('Failed to save preferences');
    else setSuccess('Preferences updated!');
    setSaving(false);
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Notification Preferences</h1>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!prefs?.weekly_checkin_emails_enabled}
              onChange={e => setPrefs((p: any) => ({ ...p, weekly_checkin_emails_enabled: e.target.checked }))}
            />
            Weekly check-in reminder emails
          </label>
        </div>
        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!prefs?.support_message_emails_enabled}
              onChange={e => setPrefs((p: any) => ({ ...p, support_message_emails_enabled: e.target.checked }))}
            />
            Support inbox reply emails
          </label>
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        {success && <div className="text-green-600 text-sm">{success}</div>}
      </form>
    </div>
  );
}
