/**
 * GET /api/auth/session
 * 
 * Returns current user session + checks if user is admin.
 * 
 * Expects Authorization header: "Bearer <jwt_token>"
 * (client passes the token from Supabase session)
 */

import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/adminAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Decode JWT to get user ID (without calling Supabase)
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return new Response(
          JSON.stringify({ error: 'Invalid token' }),
          { status: 401 }
        );
      }

      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64').toString('utf-8')
      );

      const userId = payload.sub;
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Invalid token' }),
          { status: 401 }
        );
      }

      // Check if user is admin
      let isAdmin = false;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (serviceRoleKey) {
        const serviceClient = createClient(supabaseUrl, serviceRoleKey);
        const { data: adminUser } = await serviceClient
          .from('admin_users')
          .select('id, institution_id')
          .eq('auth_uid', userId)
          .eq('is_active', true)
          .maybeSingle();
        
        isAdmin = !!adminUser;
      }

      return new Response(
        JSON.stringify({
          user: { id: userId },
          access_token: token,
          isAdmin,
        }),
        { status: 200 }
      );
    } catch (tokenError) {
      console.error('[SESSION_ERROR] Token validation failed:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('[SESSION_ERROR]', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get session' }),
      { status: 500 }
    );
  }
}
