'use client';

/**
 * /app/admin/setup/page.tsx
 * 
 * Admin setup form (MVP).
 * 
 * Standalone form for admin to:
 * 1. Enter email + full name + secret key
 * 2. Submit to get registered
 * 3. Then sign in via magic link
 * 4. Auth callback detects admin → redirects to /admin
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminSetupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [step, setStep] = useState<'form' | 'signin'>('form');
  const [authMode, setAuthMode] = useState<'magic' | 'password'>('password'); // Default to password for admin

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      // Validate inputs
      if (!email || !fullName || !secretKey || !password) {
        setMessage({
          type: 'error',
          text: 'Please fill in all fields',
        });
        setSubmitting(false);
        return;
      }

      // PASSWORD MODE: signup first, get auth_uid, then create admin record
      if (authMode === 'password') {
        console.log('[ADMIN_SETUP] Password mode - creating account via Supabase...');
        
        const { supabase } = await import('@/lib/supabase');
        const { data: { user: newUser }, error: signUpError } = await supabase.auth.signUp({
          email: email.toLowerCase(),
          password,
        });

        if (signUpError) {
          console.error('[ADMIN_SETUP] SignUp error:', signUpError);
          setMessage({
            type: 'error',
            text: signUpError.message || 'Failed to create account',
          });
          setSubmitting(false);
          return;
        }

        if (!newUser?.id) {
          console.error('[ADMIN_SETUP] No user ID returned from signup');
          setMessage({
            type: 'error',
            text: 'Failed to create account',
          });
          setSubmitting(false);
          return;
        }

        // Now create the admin record on the server with auth_uid
        console.log('[ADMIN_SETUP] Account created, creating admin record with auth_uid:', newUser.id);
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

        let data;
        try {
          data = await response.json();
        } catch (e) {
          console.error('[ADMIN_SETUP] Failed to parse admin response:', response.status);
          setMessage({
            type: 'error',
            text: `Server error: ${response.status}`,
          });
          setSubmitting(false);
          return;
        }

        if (!response.ok) {
          const errorMsg = data?.error || 'Failed to create admin record';
          console.error('[ADMIN_SETUP] Admin creation failed:', { status: response.status, errorMsg });
          setMessage({
            type: 'error',
            text: String(errorMsg),
          });
          setSubmitting(false);
          return;
        }

        // Account created successfully - redirect to login
        console.log('[ADMIN_SETUP] Admin account created successfully');
        setMessage({
          type: 'success',
          text: 'Admin account created! Redirecting to sign in...',
        });
        setTimeout(() => router.push('/login'), 1500);
      } else {
        // MAGIC LINK MODE: send OTP via API
        console.log('[ADMIN_SETUP] Magic link mode - sending OTP...');
        const response = await fetch('/api/admin/create-pending', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.toLowerCase(),
            full_name: fullName,
            admin_secret_key: secretKey,
            auth_mode: 'magic',
          }),
        });

        let data;
        try {
          data = await response.json();
        } catch (e) {
          console.error('[ADMIN_SETUP_ERROR] Could not parse response as JSON:', response.status, response.statusText);
          setMessage({
            type: 'error',
            text: `Server error: ${response.status} ${response.statusText}`,
          });
          setSubmitting(false);
          return;
        }

        if (!response.ok) {
          const errorMsg = data?.error || data?.message || 'Failed to register admin account';
          console.error('[ADMIN_SETUP_ERROR]', { status: response.status, errorMsg, fullData: data });
          setMessage({
            type: 'error',
            text: String(errorMsg),
          });
          setSubmitting(false);
          return;
        }

        // Magic link sent successfully
        setMessage({
          type: 'success',
          text: "Check your email for a sign-in link. You'll have admin access after signing in.",
        });
        setStep('signin');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error('[ADMIN_SETUP_EXCEPTION]', error);
      setMessage({
        type: 'error',
        text: errorMsg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white p-8 rounded-lg shadow max-w-md w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Create Admin Account</h1>
          <p className="text-sm text-gray-600 mt-2">
            Set up your institutional admin access
          </p>
        </div>

        {step === 'form' ? (
          <>
            {/* Auth Mode Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setAuthMode('password')}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition ${
                  authMode === 'password'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('magic')}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition ${
                  authMode === 'magic'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Magic Link
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@institution.ie"
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
                placeholder="Your name"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={submitting}
              />
            </div>

            {authMode === 'password' && (
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
                  At least 8 characters with uppercase, lowercase, numbers, and special characters (e.g., P@ssw0rd!)
                </p>
              </div>
            )}

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
              <p className="text-xs text-gray-500 mt-1">
                Ask your institution for this key
              </p>
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
          </>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">✓ Admin account registered!</p>
              <p className="text-xs text-green-700 mt-2">
                Check your email for a magic link to sign in.
              </p>
            </div>
            <p className="text-sm text-gray-600">
              After you sign in, you'll be redirected to your admin dashboard.
            </p>
            <Link
              href="/login"
              className="block w-full text-center bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
            >
              Back to Login
            </Link>
          </div>
        )}

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
