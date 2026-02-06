'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkConsents } from '@/lib/consent';
import ChatInterface from '@/components/ChatInterface';
import Navigation from '@/components/Navigation';
import { MENTAL_LOAD_DOMAINS, type MentalLoadDomainId } from '@/lib/types';

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [domainContext, setDomainContext] = useState<MentalLoadDomainId | 'general' | undefined>();
  const [entryPoint, setEntryPoint] = useState<'checkin' | 'load' | 'spike' | undefined>();
  const [userId, setUserId] = useState<string | undefined>();

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

      const source = searchParams.get('source');
      const domainParam = searchParams.get('domain');
      const isValidDomain = MENTAL_LOAD_DOMAINS.some((d) => d.id === domainParam);
      const domain = isValidDomain ? domainParam : 'general';

      if (source !== 'checkin' && source !== 'load' && source !== 'spike') {
        router.push('/dashboard');
        return;
      }

      setEntryPoint(source);
      setDomainContext(domain as MentalLoadDomainId | 'general');

      setIsLoading(false);
      setUserId(session.user.id);
    };

    checkAuth();
  }, [router, searchParams]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-calm-cream">
        <p className="text-calm-text">Loading...</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col h-dvh bg-calm-cream pb-[env(safe-area-inset-bottom)]">
      <ChatInterface domainContext={domainContext} entryPoint={entryPoint} userId={userId} />
      <Navigation currentPage="dashboard" />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={(
        <div className="flex items-center justify-center min-h-screen bg-calm-cream">
          <p className="text-calm-text">Loading...</p>
        </div>
      )}
    >
      <ChatPageContent />
    </Suspense>
  );
}
