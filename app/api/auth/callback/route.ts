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
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Exchange code for session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[AUTH_CALLBACK_ERROR]', error);
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (!data.session?.user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const user_id = data.session.user.id;
    const user_email = data.session.user.email?.toLowerCase();

    // Service client for admin operations
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      // If no service role, can't check admin status
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // 1. Check if user is a pending admin
    if (user_email) {
      const { data: pendingAdmin } = await serviceClient
        .from('pending_admins')
        .select('*')
        .eq('email', user_email)
        .single();

      if (pendingAdmin) {
        // Create admin_users record
        const { error: createError } = await serviceClient
          .from('admin_users')
          .insert({
            auth_uid: user_id,
            institution_id: pendingAdmin.institution_id,
            email: user_email,
            full_name: pendingAdmin.full_name,
            role: 'counsellor',
            is_active: true,
          });

        if (!createError) {
          // Delete pending record
          await serviceClient
            .from('pending_admins')
            .delete()
            .eq('email', user_email);

          // User is now admin — redirect to admin dashboard
          const response = NextResponse.redirect(new URL('/admin', request.url));
          return response;
        }
      }
    }

    // 2. Check if user is already an admin
    const { data: adminUser } = await serviceClient
      .from('admin_users')
      .select('id, institution_id')
      .eq('auth_uid', user_id)
      .eq('is_active', true)
      .single();

    if (adminUser) {
      // User is admin — redirect to admin dashboard
      console.log('[AUTH_CALLBACK] User is admin, redirecting to /admin');
      const response = NextResponse.redirect(new URL('/admin', request.url));
      return response;
    }

    // 3. User is student — redirect to dashboard
    console.log('[AUTH_CALLBACK] User is not admin, redirecting to /dashboard');
    const response = NextResponse.redirect(new URL('/dashboard', request.url));
    return response;
  } catch (error) {
    console.error('[CALLBACK_ROUTE_ERROR]', error);
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
