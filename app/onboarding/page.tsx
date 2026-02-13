'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { UsersExtended } from '@/lib/types';

/**
 * Onboarding Page
 * 
 * Captures:
 * 1. Semester start timing (for time-in-journey context)
 * 2. Current semester position (for personalized prompts)
 * 
 * Target: International postgraduate students in their first 12 months in Ireland
 */

export default function OnboardingPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [semesterStart, setSemesterStart] = useState<string>('');
  const [semesterPosition, setSemesterPosition] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      setUserId(session.user.id);

      // Check if user already has onboarded
      const { data: existing } = await supabase
        .from('users_extended')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (existing) {
        // Already onboarded, skip to dashboard
        router.push('/dashboard');
        return;
      }

      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId || !semesterStart || !semesterPosition) {
      setError('Please complete all fields');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const nciInstitutionId = '550e8400-e29b-41d4-a716-446655440000';
      const payload: Partial<UsersExtended> = {
        user_id: userId,
        semester_start: semesterStart as any,
        semester_position: semesterPosition as any,
        institution_id: nciInstitutionId,
      };

      const { error: insertError } = await supabase
        .from('users_extended')
        .insert([payload]);

      if (insertError) {
        throw insertError;
      }

      // Move to dashboard
      router.push('/dashboard');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save onboarding info'
      );
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Anchor</h1>
            <p className="text-gray-600 text-lg">
              A mental load companion for international postgraduate students in their first 12
              months in Ireland.
            </p>
            <p className="text-gray-500 text-sm mt-2">
              <strong>Tagline:</strong> Stay Steady
            </p>
          </div>

          {/* ICP Statement */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h2 className="font-bold text-blue-900 mb-2">About Anchor</h2>
            <p className="text-sm text-blue-800 leading-relaxed">
              Anchor is built specifically for international postgraduate students studying in Ireland
              who are in their first 12 months post-arrival. We focus on understanding and reducing
              the mental load from predictable stressors: academic pressure, financial constraints,
              belonging, immigration administration, work–life balance, health adjustment, and
              future stability.
            </p>
            <p className="text-sm text-blue-800 leading-relaxed mt-3">
              <strong>Not for undergraduates. Not for domestic students. Not for general wellness.</strong>
            </p>
          </div>

          {/* Onboarding Form */}
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Semester Start */}
            <div>
              <label className="block text-lg font-semibold text-gray-900 mb-4">
                When did your current semester start?
              </label>
              <div className="space-y-3">
                {[
                  'Early January',
                  'Late January',
                  'Early September',
                  'Late September',
                  'Other / Not sure',
                ].map((option) => (
                  <label
                    key={option}
                    className="flex items-center p-4 border-2 rounded-lg cursor-pointer transition"
                    style={{
                      borderColor:
                        semesterStart === option ? '#2563eb' : '#e5e7eb',
                      backgroundColor:
                        semesterStart === option ? '#eff6ff' : '#ffffff',
                    }}
                  >
                    <input
                      type="radio"
                      value={option}
                      checked={semesterStart === option}
                      onChange={(e) => setSemesterStart(e.target.value)}
                      className="mr-4"
                    />
                    <span className="font-medium text-gray-900">{option}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Semester Position */}
            <div>
              <label className="block text-lg font-semibold text-gray-900 mb-4">
                Where are you in the semester right now?
              </label>
              <div className="space-y-3">
                {['Start', 'Middle', 'End'].map((option) => (
                  <label
                    key={option}
                    className="flex items-center p-4 border-2 rounded-lg cursor-pointer transition"
                    style={{
                      borderColor:
                        semesterPosition === option
                          ? '#2563eb'
                          : '#e5e7eb',
                      backgroundColor:
                        semesterPosition === option
                          ? '#eff6ff'
                          : '#ffffff',
                    }}
                  >
                    <input
                      type="radio"
                      value={option}
                      checked={semesterPosition === option}
                      onChange={(e) => setSemesterPosition(e.target.value)}
                      className="mr-4"
                    />
                    <span className="font-medium text-gray-900">{option}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSaving}
              className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Setting up...' : 'Get Started'}
            </button>
          </form>

          {/* Footer Note */}
          <p className="text-center text-gray-500 text-sm mt-8">
            This helps us personalize your experience and understand predictable pressure points
            in your semester.
          </p>
        </div>
      </div>
    </div>
  );
}
