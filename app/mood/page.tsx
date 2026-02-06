'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkConsents } from '@/lib/consent';
import { MOODS_DEPRECATED as MOODS } from '@/lib/types';
import MoodButton from '@/components/MoodButton';
import Navigation from '@/components/Navigation';

export default function MoodPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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

      setUserId(session.user.id);
    };

    checkAuth();
  }, [router]);

  const handleSubmit = async () => {
    if (!userId || !selectedMood) {
      setError('Please select a mood');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const { error: insertError } = await supabase
        .from('mood_entries')
        .insert({
          user_id: userId,
          mood_id: selectedMood,
          text: note || null,
        });

      if (insertError) throw insertError;

      setSuccess(true);
      setTimeout(() => {
        router.push('/timeline');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to save mood. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-[calc(120px+env(safe-area-inset-bottom))]">
      <Navigation currentPage="dashboard" />

      <div className="flex-1 px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Quick Mood Snapshot</h1>
            <p className="text-gray-600">
              Capture how you're feeling right now. This pairs with your weekly check-in to track patterns over time.
            </p>
          </div>

          {success && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-700 mb-6">
              ✓ Mood saved! Redirecting to your timeline...
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-6">
              {error}
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200 p-8 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">How are you feeling?</h2>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {MOODS.map((mood) => (
                <MoodButton
                  key={mood.id}
                  mood={mood}
                  isSelected={selectedMood === mood.id}
                  onClick={() => setSelectedMood(mood.id)}
                />
              ))}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Add a note (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What's on your mind?"
                rows={4}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                disabled={isSubmitting}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={!selectedMood || isSubmitting}
              className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save Mood Snapshot'}
            </button>
          </div>

          <div className="text-center">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-600 hover:text-gray-900 text-sm"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
