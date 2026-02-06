'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkConsents, getOrCreateConsent, acceptAllConsents } from '@/lib/consent';

export default function ConsentPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [allConsented, setAllConsented] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      setUserId(session.user.id);

      // Check if user has already accepted
      const hasConsented = await checkConsents(session.user.id);
      if (hasConsented) {
        router.push('/dashboard');
        return;
      }

      // Ensure consent record exists
      await getOrCreateConsent(session.user.id);
      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

  const handleAcceptAll = async () => {
    if (!userId) return;

    setIsAccepting(true);
    setError('');

    const success = await acceptAllConsents(userId);

    if (success) {
      router.push('/onboarding');
    } else {
      setError('Failed to save consent. Please try again.');
      setIsAccepting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-calm-cream">
        <p className="text-calm-text">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-calm-cream px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="calm-card">
          <h1 className="text-2xl font-light text-calm-text mb-8">Welcome to Anchor</h1>

          <div className="mb-6 text-sm text-gray-600">
            Anchor is built exclusively for international postgraduate students in their first 12 months in Ireland.
            It is not intended for undergraduates, domestic students, or general wellness use.
          </div>

          <div className="space-y-6 mb-8">
            {/* Privacy Acknowledgement */}
            <div className="p-4 rounded-lg bg-calm-blue border border-calm-border">
              <h2 className="font-medium text-calm-text mb-3">Privacy Acknowledgement</h2>
              <p className="text-sm text-gray-700 leading-relaxed">
                Your mental load entries, reflections, and weekly check-ins are private and stored securely. We will never share your data with third parties. You can delete your account and all your data at any time.
              </p>
            </div>

            {/* Clinical Disclaimer */}
            <div className="p-4 rounded-lg bg-calm-blue border border-calm-border">
              <h2 className="font-medium text-calm-text mb-3">Important: Not Therapy or Medical Care</h2>
              <p className="text-sm text-gray-700 leading-relaxed">
                Anchor is a preventive mental load companion for international postgraduate students in their first 12 months in Ireland. It is not therapy, counselling, or medical treatment. If you are experiencing a mental health crisis or having thoughts of self-harm, please reach out to a professional immediately.
              </p>
            </div>

            {/* Crisis Resources */}
            <div className="p-4 rounded-lg bg-calm-sage border border-calm-border">
              <h2 className="font-medium text-calm-text mb-3">In Crisis? Support is Available</h2>
              <div className="text-sm text-gray-700 space-y-2">
                <p className="font-medium">Ireland Crisis Resources:</p>
                <ul className="space-y-2 text-sm">
                  <li>
                    <strong>Samaritans:</strong>{' '}
                    <a href="tel:1800224488" className="text-blue-600 hover:underline">
                      1800 224 488
                    </a>{' '}
                    |{' '}
                    <a href="https://www.samaritans.org/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      www.samaritans.org
                    </a>
                  </li>
                  <li>
                    <strong>Pieta House:</strong>{' '}
                    <a href="tel:1800247247" className="text-blue-600 hover:underline">
                      1800 247 247
                    </a>{' '}
                    |{' '}
                    <a href="https://www.pieta.ie/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      www.pieta.ie
                    </a>
                  </li>
                  <li>
                    <strong>Aware:</strong>{' '}
                    <a href="tel:1800804848" className="text-blue-600 hover:underline">
                      1800 804 848
                    </a>{' '}
                    |{' '}
                    <a href="https://www.aware.ie/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      www.aware.ie
                    </a>
                  </li>
                  <li>
                    <strong>Emergency:</strong>{' '}
                    <a href="tel:999" className="text-blue-600 hover:underline">
                      999 or 112
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 mb-6">
              {error}
            </div>
          )}

          <button
            onClick={handleAcceptAll}
            disabled={isAccepting}
            className="calm-button-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAccepting ? 'Saving...' : 'I accept and want to continue'}
          </button>

          <p className="text-xs text-gray-500 text-center mt-6">
            You must accept all of the above to use Anchor.
          </p>
        </div>
      </div>
    </div>
  );
}
