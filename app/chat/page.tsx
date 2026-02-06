'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkConsents } from '@/lib/consent';
import ChatInterface from '@/components/ChatInterface';
import Navigation from '@/components/Navigation';

export default function ChatPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [moodContext, setMoodContext] = useState<string | undefined>();
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

      // Fetch user's most recent mood to provide context
      const { data: recentMood } = await supabase
        .from('mood_entries')
        .select('mood_id')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (recentMood) {
        setMoodContext(recentMood.mood_id);
      }

      setIsLoading(false);
      setUserId(session.user.id);
    };

    checkAuth();
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-calm-cream">
        <p className="text-calm-text">Loading...</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col h-dvh bg-calm-cream pb-[env(safe-area-inset-bottom)]">
      <ChatInterface moodContext={moodContext} userId={userId} />
      <Navigation currentPage="chat" />
    </div>
  );
}
