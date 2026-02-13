/**
 * GET /api/admin/history
 *
 * Returns recent check-ins for the admin's institution.
 *
 * Query params:
 * - ?limit=50 (default)
 */

import { requireAdmin } from '@/lib/adminAuth';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase credentials');
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if ('code' in admin) {
      return new Response(JSON.stringify(admin), { status: 403 });
    }

    const serviceClient = getServiceClient();
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);

    const { data: checkins, error } = await serviceClient
      .from('weekly_checkin_responses')
      .select(
        `
        id,
        user_id,
        week_number,
        semester_year,
        primary_domain_id,
        secondary_domain_id,
        intensity_numeric,
        risk_score,
        high_risk,
        trigger_reasons,
        response_text,
        created_at
      `
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[ADMIN_HISTORY_ERROR]', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch history' }), {
        status: 500,
      });
    }

    return new Response(JSON.stringify({ history: checkins || [] }), { status: 200 });
  } catch (error) {
    console.error('[ADMIN_HISTORY_ROUTE_ERROR]', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
    });
  }
}
