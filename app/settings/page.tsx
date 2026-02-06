'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkConsents } from '@/lib/consent';
import Navigation from '@/components/Navigation';

interface ConfirmDialog {
  open: boolean;
  title: string;
  message: string;
  action: 'clear-chat' | 'clear-load' | 'clear-checkins' | 'clear-mood' | null;
  isLoading: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>({
    open: false,
    title: '',
    message: '',
    action: null,
    isLoading: false,
  });
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const hasConsented = await checkConsents(session.user.id);
      if (!hasConsented) {
        router.push('/consent');
        return;
      }

      setEmail(session.user.email || '');
      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No session');
    }
    return session.access_token;
  };

  const handleClearChatHistory = () => {
    setConfirmDialog({
      open: true,
      title: 'Clear Chat History',
      message: 'Delete all support threads and summaries? This action cannot be undone.',
      action: 'clear-chat',
      isLoading: false,
    });
  };

  const handleClearLoadHistory = () => {
    setConfirmDialog({
      open: true,
      title: 'Clear Load Entries',
      message: 'Delete all load entries? This action cannot be undone.',
      action: 'clear-load',
      isLoading: false,
    });
  };

  const handleClearCheckins = () => {
    setConfirmDialog({
      open: true,
      title: 'Clear Weekly Check-Ins',
      message: 'Delete all weekly check-ins? This action cannot be undone.',
      action: 'clear-checkins',
      isLoading: false,
    });
  };

  const handleClearMoodHistory = () => {
    setConfirmDialog({
      open: true,
      title: 'Clear Mood Snapshot History',
      message: 'Delete all mood snapshot entries? This action cannot be undone.',
      action: 'clear-mood',
      isLoading: false,
    });
  };

  const confirmDelete = async () => {
    if (!confirmDialog.action) return;

    setConfirmDialog((prev) => ({ ...prev, isLoading: true }));

    try {
      const token = await getAuthToken();
      const endpoint =
        confirmDialog.action === 'clear-chat'
          ? '/api/chat/clear'
          : confirmDialog.action === 'clear-load'
          ? '/api/load/clear'
          : confirmDialog.action === 'clear-checkins'
          ? '/api/checkin/clear'
          : '/api/mood/clear';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete data');
      }

      const action =
        confirmDialog.action === 'clear-chat'
          ? 'Chat history'
          : confirmDialog.action === 'clear-load'
          ? 'Load entries'
          : confirmDialog.action === 'clear-checkins'
          ? 'Weekly check-ins'
          : 'Mood snapshots';
      setSuccessMessage(`${action} cleared`);
      setTimeout(() => setSuccessMessage(''), 3000);

      setConfirmDialog({
        open: false,
        title: '',
        message: '',
        action: null,
        isLoading: false,
      });
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete data. Please try again.');
      setConfirmDialog((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-calm-cream">
        <p className="text-calm-text">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-calm-cream flex flex-col pb-[calc(120px+env(safe-area-inset-bottom))]">
      <div className="flex-1 px-4 py-8">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-light text-calm-text mb-8">Settings</h1>

          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              {successMessage}
            </div>
          )}

          {/* Account Section */}
          <div className="calm-card mb-6">
            <h2 className="font-medium text-calm-text mb-4">Account</h2>
            <div className="mb-4">
              <label className="block text-sm text-gray-500 mb-2">Email</label>
              <p className="text-calm-text">{email}</p>
            </div>
          </div>

          {/* Your Data Section */}
          <div className="calm-card mb-6">
            <h2 className="font-medium text-calm-teal mb-2">Your Data</h2>
            <p className="text-xs text-gray-500 mb-4">
              Your load entries and weekly check-ins belong to you. You can delete them at any time.
            </p>

            <div className="space-y-3">
              <button
                onClick={handleClearChatHistory}
                className="w-full px-4 py-3 text-left rounded-lg border border-calm-border hover:bg-calm-cream transition-colors text-sm text-calm-text font-medium"
              >
                Clear Support Threads
              </button>
              <button
                onClick={handleClearLoadHistory}
                className="w-full px-4 py-3 text-left rounded-lg border border-calm-border hover:bg-calm-cream transition-colors text-sm text-calm-text font-medium"
              >
                Clear Load Entries
              </button>
              <button
                onClick={handleClearCheckins}
                className="w-full px-4 py-3 text-left rounded-lg border border-calm-border hover:bg-calm-cream transition-colors text-sm text-calm-text font-medium"
              >
                Clear Weekly Check-Ins
              </button>
              <button
                onClick={handleClearMoodHistory}
                className="w-full px-4 py-3 text-left rounded-lg border border-calm-border hover:bg-calm-cream transition-colors text-sm text-calm-text font-medium"
              >
                Clear Mood Snapshot History (optional)
              </button>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="calm-button-secondary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSigningOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </div>

      <Navigation currentPage="settings" />

      {/* Confirmation Modal */}
      {confirmDialog.open && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={() => !confirmDialog.isLoading && setConfirmDialog((prev) => ({ ...prev, open: false }))}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="bg-white rounded-lg shadow-xl max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-calm-border">
                <h3 className="text-lg font-medium text-calm-text">
                  {confirmDialog.title}
                </h3>
              </div>
              <div className="px-6 py-4">
                <p className="text-sm text-gray-600">{confirmDialog.message}</p>
              </div>
              <div className="px-6 py-4 border-t border-calm-border flex gap-3">
                <button
                  onClick={() => !confirmDialog.isLoading && setConfirmDialog((prev) => ({ ...prev, open: false }))}
                  disabled={confirmDialog.isLoading}
                  className="flex-1 px-4 py-2 rounded-lg border border-calm-border text-calm-text hover:bg-calm-cream transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={confirmDialog.isLoading}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  {confirmDialog.isLoading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
