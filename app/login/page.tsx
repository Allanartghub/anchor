'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [authMode, setAuthMode] = useState<'magic' | 'password'>('magic');
  const [passwordMode, setPasswordMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);

  // Check if already logged in
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/dashboard');
      }
      setCheckingSession(false);
    };

    checkAuth();
  }, [router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      if (authMode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/api/auth/callback`,
          },
        });

        if (error) {
          setError(error.message);
        } else {
          setMessage('Check your email for a login link!');
          setEmail('');
        }
      } else {
        // Password authentication
        if (passwordMode === 'signup') {
          // Sign up
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/api/auth/callback`,
            },
          });

          if (error) {
            setError(error.message);
          } else if (data.user) {
            setMessage('Account created! You can now sign in.');
            setPasswordMode('signin');
            setPassword('');
          }
        } else {
          // Sign in
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            setError(error.message);
          } else if (data.session) {
            // Check if admin or regular user
            const response = await fetch('/api/auth/session');
            const sessionData = await response.json();
            
            if (sessionData.isAdmin) {
              router.push('/admin');
            } else {
              router.push('/dashboard');
            }
            return;
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-calm-cream">
        <p className="text-calm-text">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-calm-cream px-4">
      <div className="w-full max-w-md">
        <div className="calm-card">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-light text-calm-text mb-2">Anchor</h1>
            <p className="text-sm text-gray-500 mb-4">Stay Steady</p>
            <p className="text-xs text-gray-600 max-w-xs mx-auto">
              For international postgraduate students in their first 12 months in Ireland
            </p>
          </div>

          {/* Auth Mode Toggle */}
          <div className="flex gap-2 mb-4">
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
          </div>

          {authMode === 'password' && (
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setPasswordMode('signin')}
                className={`flex-1 px-3 py-2 text-xs font-medium rounded transition ${
                  passwordMode === 'signin'
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setPasswordMode('signup')}
                className={`flex-1 px-3 py-2 text-xs font-medium rounded transition ${
                  passwordMode === 'signup'
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-calm-text mb-2">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="calm-input"
                disabled={isLoading}
              />
            </div>

            {authMode === 'password' && (
              <div>
                <label className="block text-sm font-medium text-calm-text mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                  className="calm-input"
                  disabled={isLoading}
                />
              </div>
            )}

            {message && (
              <div className="rounded-lg bg-calm-sage p-4 text-sm text-green-800">
                {message}
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="calm-button-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading 
                ? 'Loading...' 
                : authMode === 'magic' 
                  ? 'Send magic link' 
                  : passwordMode === 'signup'
                    ? 'Create Account'
                    : 'Sign in'
              }
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center mb-3">
              Are you an admin setting up access?
            </p>
            <button
              onClick={() => router.push('/admin/setup')}
              className="w-full px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition"
            >
              Create Admin Account
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center mt-6">
            {authMode === 'magic' 
              ? "We'll send you a secure login link. No password needed."
              : passwordMode === 'signup'
                ? 'Create an account to get started with Anchor.'
                : 'Sign in to access your account.'
            }
          </p>
        </div>
      </div>
    </div>
  );
}
