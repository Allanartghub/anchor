import { supabase } from './supabase';
import type { Consent } from './types';

/**
 * Check if user has accepted all required consents
 */
export async function checkConsents(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('consent')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // No consent record exists yet
      return false;
    }

    if (!data) return false;

    // All three must be accepted
    return !!(
      data.privacy_accepted_at &&
      data.disclaimer_accepted_at &&
      data.crisis_disclosure_accepted_at
    );
  } catch (error) {
    console.error('Error checking consents:', error);
    return false;
  }
}

/**
 * Get existing consent record or create empty one
 */
export async function getOrCreateConsent(userId: string): Promise<Consent | null> {
  try {
    // Try to get existing
    const { data: existing, error: selectError } = await supabase
      .from('consent')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existing) return existing;

    // If no error on select, record doesn't exist. Create it.
    if (selectError && selectError.code === 'PGRST116') {
      const { data: newConsent, error: insertError } = await supabase
        .from('consent')
        .insert([
          {
            user_id: userId,
            version: 1,
          },
        ])
        .select()
        .single();

      if (insertError) {
        console.error('Error creating consent:', insertError);
        return null;
      }

      return newConsent;
    }

    return null;
  } catch (error) {
    console.error('Error in getOrCreateConsent:', error);
    return null;
  }
}

/**
 * Accept all three consent items
 */
export async function acceptAllConsents(userId: string): Promise<boolean> {
  try {
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('consent')
      .upsert(
        {
          user_id: userId,
          version: 1,
          privacy_accepted_at: now,
          disclaimer_accepted_at: now,
          crisis_disclosure_accepted_at: now,
        },
        { onConflict: 'user_id' }
      )
      .select('user_id')
      .single();

    if (error) {
      console.error('Error accepting consents:', { error, userId });
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in acceptAllConsents:', error);
    return false;
  }
}
