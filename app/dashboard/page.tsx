'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkConsents } from '@/lib/consent';
import { MOODS, type MoodEntry } from '@/lib/types';
import Navigation from '@/components/Navigation';
import MoodButton from '@/components/MoodButton';

export default function DashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      // Check consent
      const hasConsented = await checkConsents(session.user.id);
      if (!hasConsented) {
        router.push('/consent');
        return;
      }

      setUserId(session.user.id);
      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

  const handleSave = async () => {
    if (!userId || !selectedMood) {
      setError('Please select a mood');
      return;
    }

    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      const { error: insertError } = await supabase
        .from('mood_entries')
        .insert([
          {
            user_id: userId,
            mood_id: selectedMood,
            text: text.trim() || null,
            created_at: new Date().toISOString(),
          },
        ]);

      if (insertError) {
        setError('Failed to save. Please try again.');
        console.error('Insert error:', insertError);
      } else {
        setSuccess('Saved!');
        setSelectedMood(null);
        setText('');
        setTimeout(() => setSuccess(''), 2000);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-calm-cream">
        <p className="text-calm-text">Loading...</p>
      </div>
    );
  }

  const selectedMoodObj = MOODS.find(m => m.id === selectedMood);

  return (
    <div className="min-h-screen bg-calm-cream flex flex-col pb-[calc(120px+env(safe-area-inset-bottom))]">
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="calm-card mb-8">
            <h1 className="text-2xl font-light text-calm-text mb-2">How are you feeling?</h1>
            <p className="text-sm text-gray-500 mb-8">Take 30 seconds to check in with yourself.</p>

            {/* Mood Buttons */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {MOODS.map((mood) => (
                <MoodButton
                  key={mood.id}
                  mood={mood}
                  isSelected={selectedMood === mood.id}
                  onClick={() => setSelectedMood(mood.id)}
                />
              ))}
            </div>

            {/* Selected Mood Display */}
            {selectedMoodObj && (
              <div className="mb-8 p-4 rounded-lg bg-calm-blue border border-calm-border text-center">
                <p className="text-3xl mb-2">{selectedMoodObj.emoji}</p>
                <p className="text-sm text-calm-text font-medium">{selectedMoodObj.label}</p>
              </div>
            )}

            {/* Optional Text Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-calm-text mb-2">
                What's on your mind? (optional)
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 280))}
                placeholder="One sentence is enough..."
                maxLength={280}
                rows={3}
                className="calm-input resize-none"
                disabled={isSaving}
              />
              <p className="text-xs text-gray-400 mt-1">
                {text.length}/280
              </p>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 mb-4">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-lg bg-calm-sage p-4 text-sm text-green-800 mb-4">
                ✓ {success}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={!selectedMood || isSaving}
              className="calm-button-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <Navigation currentPage="dashboard" />
    </div>
  );
}
