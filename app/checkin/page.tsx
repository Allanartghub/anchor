'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase';
import WeeklyCheckinFlow from '@/components/WeeklyCheckinFlow';
import { User } from '@supabase/supabase-js';

export default function WeeklyCheckinPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push('/login');
        return;
      }
      setUser(currentUser);
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        {/* Page header */}
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Weekly Check-In</h1>
          <p className="text-gray-600">
            Anchor is built for international postgraduate students in their first 12 months in Ireland.
          </p>
          <p className="text-sm text-gray-500 mt-3">
            Stay Steady—we're here to help you manage what's putting pressure on you.
          </p>
        </div>

        {/* Check-in flow component */}
        <WeeklyCheckinFlow
          userId={user.id}
          onComplete={() => {
            router.push('/dashboard');
          }}
          onSkip={() => {
            router.push('/dashboard');
          }}
        />
      </div>
    </div>
  );
}
