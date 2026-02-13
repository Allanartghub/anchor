'use client';

/**
 * /app/admin/setup/page.tsx
 *
 * Admin setup form (MVP).
 *
 * Standalone form for admin to:
 * 1. Enter email + full name + secret key + password
 * 2. Create Supabase auth user
 * 3. Create pending admin record via API
 * 4. Redirect to /login
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Message = { type: 'success' | 'error'; text: string };

export default function AdminSetupPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      if (!email || !fullName || !secretKey || !password) {
        setMessage({ type: 'error', text: 'Please fill in all fields' });
        return;
      }

      console.log('[ADMIN_SETUP] Creating account via Supabase...');

      const { supabase } = await import('@/lib/supabase');

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password,
      });

      if (signUpError) {
        console.error('[ADMIN_SETUP] SignUp error:', signUpError);
        setMessage({
          type: 'error',
          text: signUpError.message || 'Failed to create account',
        });
        return;
      }

      const newUser = data?.user;

      if (!newUser?.id) {
        console.error('[ADMIN_SETUP] No user ID returned from signup');
        setMessage({ type: 'error', text: 'Failed to create account' });
        return;
      }

      console.log('[ADMIN_SETUP] Account created, creating admin record:', newUser.id);

      const response = await fetch('/api/admin/create-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.toLowerCase(),
          full_name: fullName,
          admin_secret_key: secretKey,
          auth_uid: newUser.id,
          auth_mode: 'password',
        }),
      });

      let payload: any = null;
      try {
        payload = await response.json();
      } catch {
        // ignore JSON parse errors, handle below
      }

      if (!response.ok) {
        const errorMsg = payload?.error || `Failed to create admin record (HTTP ${response.status})`;
        console.error('[ADMIN_SETUP] Admin creation failed:', { status: response.status, errorMsg });
        setMessage({ type: 'error', text: String(errorMsg) });
        return;
      }

      setMessage({
        type: 'success',
        text: 'Admin account created! Redirecting to sign in...',
      });

      setTimeout(() => router.push('/login'), 1200);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error('[ADMIN_SETUP_EXCEPTION]', error);
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white p-8 rounded-lg shadow max-w-md w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Create Admin Account</h1>
          <p className="text-sm text-gray-600 mt-2">Set up your institutional admin access</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@institution.edu"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Choose a password"
              required
              minLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={submitting}
            />
            <p className="text-xs text-gray-500 mt-1">
              At least 8 characters. (Supabase may enforce stronger rules depending on your settings.)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Admin Secret Key</label>
            <input
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="Enter secret key"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={submitting}
            />
            <p className="text-xs text-gray-500 mt-1">Ask your institution for this key</p>
          </div>

          {message && (
            <div
              className={`p-4 rounded-lg text-sm ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {submitting ? 'Creating...' : 'Create Admin Account'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t">
          <p className="text-sm text-gray-600 text-center">
            Not an admin?{' '}
            <Link href="/login" className="text-blue-600 hover:underline">
              Go to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
