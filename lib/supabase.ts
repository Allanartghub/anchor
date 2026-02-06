import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mzkimovoyrpektffgsvz.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16a2ltb3ZveXJwZWt0ZmZnc3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMjU4NzQsImV4cCI6MjA4NTcwMTg3NH0.fIDwkcG2EBLPZb7fQa19txKu2QqzdPmLroEzg1R5u2E';

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
