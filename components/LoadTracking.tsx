'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  MENTAL_LOAD_DOMAINS,
  LoadIntensityLabel,
  LoadIntensityMap,
  LoadEntry,
} from '@/lib/types';
import { calculateWeeksSinceSemesterStart, type SemesterStartOption } from '@/lib/journey';

interface LoadTrackingProps {
  userId: string;
  onComplete?: (entry: LoadEntry) => void;
  onCancel?: () => void;
}

/**
 * LoadTracking
 * 
 * Secondary entry point for ad-hoc load tracking throughout the week.
 * Accessible after weekly check-in, or triggered from domain spikes.
 * 
 * Flow:
 * 1. "What's feeling heavier right now?" (domain selection, 1+ domains)
 * 2. How heavy? (Light / Moderate / Heavy)
 * 3. Brief reflection (guided prompt)
 * 4. Save entry
 */

export default function LoadTracking({
  userId,
  onComplete,
  onCancel,
}: LoadTrackingProps) {
  const router = useRouter();
  const [step, setStep] = useState<'domains' | 'intensity' | 'reflection' | 'summary'>(
    'domains'
  );

  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [intensity, setIntensity] = useState<LoadIntensityLabel | null>(null);
  const [reflection, setReflection] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const getSemesterWeekContext = async () => {
    try {
      const { data, error: profileError } = await supabase
        .from('users_extended')
        .select('semester_start')
        .eq('user_id', userId)
        .single();

      if (profileError || !data?.semester_start) {
        return { weekNumber: Math.ceil(new Date().getDate() / 7), semesterYear: new Date().getFullYear() };
      }

      return calculateWeeksSinceSemesterStart(data.semester_start as SemesterStartOption);
    } catch (err) {
      return { weekNumber: Math.ceil(new Date().getDate() / 7), semesterYear: new Date().getFullYear() };
    }
  };


  const handleDomainToggle = (domainId: string) => {
    setSelectedDomains((prev) => {
      if (prev.includes(domainId)) {
        return prev.filter((d) => d !== domainId);
      }
      return [...prev, domainId];
    });
  };

  const handleSubmit = async () => {
    if (!intensity || selectedDomains.length === 0 || !reflection.trim()) {
      setError('Please complete all fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { weekNumber, semesterYear } = await getSemesterWeekContext();

      // Insert load entry
      const { data: entryData, error: entryError } = await supabase
        .from('load_entries')
        .insert([
          {
            user_id: userId,
            intensity_label: intensity,
            intensity_numeric: LoadIntensityMap[intensity],
            reflection_text: reflection,
            week_number: weekNumber,
            semester_year: semesterYear,
            has_risk_flag: false,
          },
        ])
        .select()
        .single();

      if (entryError) {
        throw entryError;
      }

      // Insert domain selections
      const domainSelections = selectedDomains.map((domainId, idx) => ({
        load_entry_id: entryData.id,
        domain_id: domainId,
        is_primary: idx === 0,
      }));

      const { error: domainError } = await supabase
        .from('load_domain_selections')
        .insert(domainSelections);

      if (domainError) {
        throw domainError;
      }

      setStep('summary');
      if (onComplete) {
        onComplete({
          ...entryData,
          domains: selectedDomains,
        });
      }
    } catch (err) {
      console.error('Error saving load entry:', err);
      setError(err instanceof Error ? err.message : 'Failed to save entry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg border border-gray-200">
      {/* Domain Selection */}
      {step === 'domains' && (
        <div>
          <h3 className="text-xl font-bold mb-4 text-gray-900">
            What's feeling heavier right now?
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            Select the area(s) putting pressure on you:
          </p>
          <div className="grid grid-cols-2 gap-3 mb-8">
            {MENTAL_LOAD_DOMAINS.map((domain) => (
              <button
                key={domain.id}
                onClick={() => handleDomainToggle(domain.id)}
                className={`p-4 rounded-lg border-2 transition font-semibold ${
                  selectedDomains.includes(domain.id)
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-2">{domain.emoji}</div>
                <div className="text-sm">{domain.label}</div>
              </button>
            ))}
          </div>
          <div className="flex gap-4">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => setStep('intensity')}
              disabled={selectedDomains.length === 0}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Intensity Selection */}
      {step === 'intensity' && (
        <div>
          <h3 className="text-xl font-bold mb-4 text-gray-900">
            How intense is that pressure?
          </h3>
          <p className="text-sm text-gray-600 mb-8">
            Light, Moderate, or Heavy?
          </p>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {(['Light', 'Moderate', 'Heavy'] as LoadIntensityLabel[]).map(
              (label) => (
                <button
                  key={label}
                  onClick={() => setIntensity(label)}
                  className={`p-6 rounded-lg border-2 transition font-semibold text-center ${
                    intensity === label
                      ? 'border-blue-600 bg-blue-50 text-blue-900'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-2">
                    {label === 'Light' && '🌤️'}
                    {label === 'Moderate' && '⛅'}
                    {label === 'Heavy' && '⛈️'}
                  </div>
                  <div>{label}</div>
                </button>
              )
            )}
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setStep('domains')}
              className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
            >
              Back
            </button>
            <button
              onClick={() => setStep('reflection')}
              disabled={!intensity}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Reflection */}
      {step === 'reflection' && (
        <div>
          <h3 className="text-xl font-bold mb-4 text-gray-900">
            What's one thing contributing to this?
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            Brief reflection (a few sentences):
          </p>
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="What specifically triggered this? Keep it brief..."
            className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 mb-6"
            rows={4}
          />
          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
          <div className="flex gap-4">
            <button
              onClick={() => setStep('intensity')}
              className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !reflection.trim()}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        </div>
      )}

      {/* Summary */}
      {step === 'summary' && (
        <div className="text-center">
          <div className="text-5xl mb-4">✓</div>
          <h2 className="text-2xl font-bold mb-4 text-gray-900">
            Load entry saved
          </h2>
          <p className="text-gray-600 mb-8">
            We're tracking these patterns. Check in with us weekly for better
            insights.
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => {
                const domain = selectedDomains[0] || 'general';
                router.push(`/chat?source=load&domain=${domain}`);
              }}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition"
            >
              Talk it through
            </button>
            <button
              onClick={onCancel}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
