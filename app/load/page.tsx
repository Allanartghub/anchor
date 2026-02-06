'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase';
import LoadTracking from '@/components/LoadTracking';
import { User } from '@supabase/supabase-js';

export default function LoadPage() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Track Your Load</h1>
          <p className="text-gray-600">
            Notice something putting more pressure on you? Log it here.
          </p>
          <p className="text-sm text-gray-500 mt-3">
            These entries help us understand your mental load patterns.
          </p>
        </div>

        {/* Load tracking component */}
        <LoadTracking
          userId={user.id}
          onComplete={() => {
            router.push('/dashboard');
          }}
          onCancel={() => {
            router.push('/dashboard');
          }}
        />
      </div>
    </div>
  );
}
