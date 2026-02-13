/**
 * POST /api/admin/create-pending
 * 
 * Two modes of operation:
 * 
 * PASSWORD MODE:
 * 1. Client creates auth account via signUp
 * 2. Client calls this endpoint with auth_uid
 * 3. Server creates admin_users record
 * 4. Server returns success
 * 5. Client signs in
 * 
 * MAGIC LINK MODE:
 * 1. Server creates pending_admins record
 * 2. Server sends OTP via signInWithOtp
 * 3. Client receives magic link, signs in
 * 4. Auth callback creates admin_users record
 */

import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase credentials');
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

function getBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase credentials');
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}

export async function POST(request: Request) {
  try {
    // 1. Validate secret key
    const adminSecretKey = process.env.ADMIN_SECRET_KEY;
    if (!adminSecretKey) {
      console.error('[CREATE_PENDING] ADMIN_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Admin setup not configured' }),
        { status: 500 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      console.error('[CREATE_PENDING] Failed to parse request body:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400 }
      );
    }

    const { email, full_name, admin_secret_key, password, auth_uid, auth_mode = 'password' } = body;

    console.log('[CREATE_PENDING] Received request:', { email, full_name, has_secret_key: !!admin_secret_key, auth_mode, has_auth_uid: !!auth_uid });

    if (!email || !full_name) {
      console.error('[CREATE_PENDING] Missing required fields:', { email: !!email, full_name: !!full_name });
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, full_name' }),
        { status: 400 }
      );
    }

    if (admin_secret_key !== adminSecretKey) {
      console.error('[CREATE_PENDING] Secret key mismatch');
      return new Response(
        JSON.stringify({ error: 'Invalid secret key' }),
        { status: 403 }
      );
    }

    const serviceClient = getServiceClient();

    const nciInstitutionId = '550e8400-e29b-41d4-a716-446655440000';

    // Only allow password mode: Client has already created auth account, we just create admin_users record
    if (auth_uid) {
      console.log('[CREATE_PENDING] Password mode - creating admin record for user:', auth_uid);
      
      // Check if already an admin
      const { data: existingAdmin } = await serviceClient
        .from('admin_users')
        .select('id')
        .eq('auth_uid', auth_uid)
        .maybeSingle();

      if (existingAdmin) {
        console.log('[CREATE_PENDING] Admin already exists for user:', auth_uid);
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Admin account already exists!',
            email,
            redirectTo: '/admin',
          }),
          { status: 200 }
        );
      }

      // Create admin_users record
      const { error: adminCreateError } = await serviceClient
        .from('admin_users')
        .insert({
          auth_uid,
          institution_id: nciInstitutionId,
          email: email.toLowerCase(),
          full_name,
          role: 'support_agent', // Use a valid default role
          is_active: true,
        });

      if (adminCreateError) {
        console.error('[CREATE_PENDING] Admin creation error:', adminCreateError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to create admin record', 
            details: adminCreateError.message,
            code: adminCreateError.code 
          }),
          { status: 500 }
        );
      }

      console.log('[CREATE_PENDING] Admin created successfully:', { email: email.toLowerCase(), auth_uid });
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Admin account created!',
          email,
          redirectTo: '/admin',
        }),
        { status: 200 }
      );
    }

    // Magic link mode removed. Only password mode is supported.
    return new Response(
      JSON.stringify({ error: 'Only password authentication is supported.' }),
      { status: 400 }
    );
  } catch (error) {
    console.error('[CREATE_PENDING_ROUTE_ERROR]', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500 }
    );
  }
}
