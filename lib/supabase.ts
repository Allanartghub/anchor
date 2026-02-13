import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY.\n' +
    'Set these in your environment (Vercel dashboard for production).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Browser-only helper to get session
export async function getSession() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

// Helper to get current user
export async function getCurrentUser() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Utility to fetch with authentication
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const session = await getSession();
  if (!session?.access_token) {
    return { error: 'User not authenticated' };
  }
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${session.access_token}`,
  };
  return fetch(url, { ...options, headers });
}
