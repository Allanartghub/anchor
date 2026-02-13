/**
 * GET /api/auth/callback
 * 
 * Supabase magic link callback handler.
 * 
 * 1. Exchange code for session
 * 2. Check if user is pending admin → create admin_users record
 * 3. Check if user is admin
 * 4. Redirect to /admin or /dashboard
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Magic link callback is no longer supported. Redirect to login.
  return NextResponse.redirect(new URL('/login', request.url));
}
