/**
 * POST /api/admin/mark-reviewed
 * 
 * Admin marks a risk event as reviewed.
 * 
 * Request body:
 * {
 *   risk_event_id: string;
 *   review_notes?: string;
 * }
 * 
 * Response:
 * {
 *   success: true;
 *   risk_event: {...}
 * }
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

export async function POST(request: Request) {
  try {
    // 1. Verify admin
    const admin = await requireAdmin(request);
    if ('code' in admin) {
      return new Response(JSON.stringify(admin), { status: 403 });
    }

    const { auth_uid } = admin;
    const serviceClient = getServiceClient();

    // 2. Parse request body
    const body = await request.json();
    const { risk_event_id, review_notes } = body;

    if (!risk_event_id) {
      return new Response(
        JSON.stringify({ error: 'Missing risk_event_id' }),
        { status: 400 }
      );
    }

    // 3. Verify risk_event belongs to admin's institution
    const { data: riskEvent, error: fetchError } = await serviceClient
      .from('risk_events')
      .select('id, institution_id')
      .eq('id', risk_event_id)
      .single();

    if (fetchError || !riskEvent) {
      return new Response(
        JSON.stringify({ error: 'Risk event not found' }),
        { status: 404 }
      );
    }

    // 4. Update risk_event
    const { data: updated, error: updateError } = await serviceClient
      .from('risk_events')
      .update({
        reviewed: true,
        reviewed_by_user_id: auth_uid,
        reviewed_at: new Date().toISOString(),
        review_notes,
      })
      .eq('id', risk_event_id)
      .select()
      .single();

    if (updateError) {
      console.error('[MARK_REVIEWED_ERROR]', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update risk event' }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        risk_event: updated,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('[MARK_REVIEWED_ROUTE_ERROR]', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
}
