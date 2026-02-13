/**
 * GET /api/admin/risk-queue
 * 
 * Returns flagged high-risk cases for the admin's institution.
 * 
 * Response: RiskQueueItem[] (minimal info)
 * - risk_event id, user_id, checkin_id
 * - risk_score, trigger_reasons
 * - week_number, primary_domain, intensity
 * - weeks_since_arrival (from profile)
 * - reviewed status
 * - created_at
 * 
 * NO raw reflection text by default.
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
    // 1. Verify admin
    const admin = await requireAdmin(request);
    if ('code' in admin) {
      return new Response(JSON.stringify(admin), { status: 403 });
    }

    const serviceClient = getServiceClient();

    // 2. Fetch risk events for this institution
    const { data: riskEvents, error: riskError } = await serviceClient
      .from('risk_events')
      .select(
        `
        id,
        user_id,
        checkin_id,
        risk_score,
        trigger_reasons,
        reviewed,
        created_at
      `
      )
      .eq('reviewed', false)
      .order('created_at', { ascending: false });

    if (riskError) {
      console.error('[RISK_QUEUE_ERROR]', riskError);
      return new Response(JSON.stringify({ error: 'Failed to fetch risk queue' }), {
        status: 500,
      });
    }

    if (!riskEvents || riskEvents.length === 0) {
      return new Response(JSON.stringify({ queue: [] }), { status: 200 });
    }

    // 3. Enrich with check-in data + user profile
    const enrichedQueue = await Promise.all(
      riskEvents.map(async (event) => {
        // Get check-in details
        const { data: checkin } = await serviceClient
          .from('weekly_checkin_responses')
          .select('week_number, primary_domain_id, intensity_numeric')
          .eq('id', event.checkin_id)
          .single();

        // Get user profile for weeks_since_arrival
        const { data: profile } = await serviceClient
          .from('users_extended')
          .select('semester_start, metadata')
          .eq('user_id', event.user_id)
          .single();

        // Calculate weeks_since_arrival (stub for MVP)
        let weeks_since_arrival = 0;
        if (profile?.metadata?.weeks_since_arrival) {
          weeks_since_arrival = profile.metadata.weeks_since_arrival;
        }

        return {
          id: event.id,
          user_id: event.user_id,
          checkin_id: event.checkin_id,
          risk_score: event.risk_score,
          trigger_reasons: event.trigger_reasons || [],
          week_number: checkin?.week_number,
          primary_domain: checkin?.primary_domain_id,
          intensity: checkin?.intensity_numeric,
          weeks_since_arrival,
          created_at: event.created_at,
          reviewed: event.reviewed,
        };
      })
    );

    return new Response(JSON.stringify({ queue: enrichedQueue }), { status: 200 });
  } catch (error) {
    console.error('[RISK_QUEUE_ROUTE_ERROR]', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
}
