/**
 * POST /api/admin/create
 * 
 * Create new admin user (MVP: protected by secret key).
 * 
 * Request body:
 * {
 *   email: string;
 *   full_name: string;
 *   auth_uid: string;  (UUID from Supabase auth)
 *   admin_secret_key: string;  (must match ADMIN_SECRET_KEY env var)
 * }
 * 
 * Security: This endpoint is restricted to MVP. In production:
 * - Require existing admin to create new admin
 * - Use proper invite workflow
 * - Enforce institution hierarchy
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

export async function POST(request: Request) {
  try {
    // Check admin secret key (MVP protection)
    const adminSecretKey = process.env.ADMIN_SECRET_KEY;
    if (!adminSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Admin creation not configured' }),
        { status: 500 }
      );
    }

    const body = await request.json();
    const { email, full_name, auth_uid, admin_secret_key } = body;

    // Validate secret key
    if (admin_secret_key !== adminSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Invalid secret key' }),
        { status: 403 }
      );
    }

    // Validate inputs
    if (!email || !full_name || !auth_uid) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: email, full_name, auth_uid',
        }),
        { status: 400 }
      );
    }

    const serviceClient = getServiceClient();

    // Use default NCI institution (MVP)
    const nciInstitutionId = '550e8400-e29b-41d4-a716-446655440000';

    // Create admin user
    const { data, error } = await serviceClient
      .from('admin_users')
      .insert({
        auth_uid,
        institution_id: nciInstitutionId,
        email,
        full_name,
        role: 'counsellor', // Start as counsellor (can be promoted)
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('[CREATE_ADMIN_ERROR]', error);
      return new Response(
        JSON.stringify({
          error: error.message || 'Failed to create admin',
        }),
        { status: 400 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        admin: {
          id: data?.id,
          email: data?.email,
          full_name: data?.full_name,
          role: data?.role,
          institution_id: data?.institution_id,
        },
        message: 'Admin created. Sign in again to access /admin',
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error('[CREATE_ADMIN_ROUTE_ERROR]', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
}
