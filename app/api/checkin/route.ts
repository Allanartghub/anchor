/**
 * POST /api/checkin
 * 
 * Student submits weekly check-in.
 * 
 * 1. Verify authenticated user
 * 2. Query check-in history for risk context
 * 3. Run risk engine
 * 4. Persist check-in with risk_score + high_risk flag
 * 5. If high_risk, create risk_event record
 * 6. Return check-in result
 */

import { createClient } from '@supabase/supabase-js';
import { buildRiskContext, calculateRiskScore } from '@/lib/riskEngine';
import { LoadIntensityNumeric, MentalLoadDomainId } from '@/lib/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

function decodeJwtPayload(token: string): any | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  try {
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

function inferSelfHarmIndicator(text: string): 'none' | 'sometimes' | 'often' {
  const value = text.toLowerCase();
  const highSignals = ['suicidal', 'suicide', 'kill myself', 'end my life', 'end it', 'self-harm'];
  const mediumSignals = ['self harm', 'hurt myself', 'harm myself'];

  console.log('[SELF_HARM_DETECTION] Checking text:', {
    text_length: text.length,
    text_preview: value.substring(0, 100),
    checking_high_signals: highSignals,
    checking_medium_signals: mediumSignals,
  });

  if (highSignals.some((term) => value.includes(term))) {
    console.log('[SELF_HARM_DETECTION] HIGH signal detected -> often');
    return 'often';
  }
  if (mediumSignals.some((term) => value.includes(term))) {
    console.log('[SELF_HARM_DETECTION] MEDIUM signal detected -> sometimes');
    return 'sometimes';
  }
  
  console.log('[SELF_HARM_DETECTION] No signals detected -> none');
  return 'none';
}

// Server-side service role client (for admin queries)
function getServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function POST(request: Request) {
  try {
    // 1. Verify user session from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = decodeJwtPayload(token);
    const user_id = payload?.sub;
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const {
      week_number,
      semester_year,
      primary_domain_id,
      secondary_domain_id,
      intensity_label,
      intensity_numeric,
      structured_prompt,
      response_text,
      self_harm_indicator,
      suggested_action,
    } = body;

    // Validate required fields
    if (
      !week_number ||
      !semester_year ||
      !intensity_label ||
      intensity_numeric === undefined ||
      !structured_prompt ||
      !response_text
    ) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          required: [
            'week_number',
            'semester_year',
            'intensity_label',
            'intensity_numeric',
            'structured_prompt',
            'response_text',
          ],
        }),
        { status: 400 }
      );
    }

    const inferredSelfHarm = self_harm_indicator
      ? (self_harm_indicator as 'none' | 'sometimes' | 'often')
      : inferSelfHarmIndicator(response_text);

    // 3. Query risk context (last check-ins for history)
    const serviceClient = getServiceClient();

    // Get previous check-in
    const { data: lastCheckin } = await serviceClient
      .from('weekly_checkin_responses')
      .select('intensity_numeric')
      .eq('user_id', user_id)
      .order('completed_at', { ascending: false })
      .limit(1);

    const lastCheckinIntensity = lastCheckin?.[0]?.intensity_numeric;

    // Get last 3 check-ins for domain continuity check
    const { data: last3Checkins } = await serviceClient
      .from('weekly_checkin_responses')
      .select('primary_domain_id, intensity_numeric')
      .eq('user_id', user_id)
      .order('completed_at', { ascending: false })
      .limit(3);

    // Check if same domain with high intensity 3 weeks
    let samedomainLast3WeeksHighIntensity = false;
    if (
      last3Checkins &&
      last3Checkins.length === 3 &&
      last3Checkins.every((c) => c.primary_domain_id === primary_domain_id)
    ) {
      const allHighIntensity = last3Checkins.every((c) => c.intensity_numeric >= 4);
      if (allHighIntensity && intensity_numeric >= 4) {
        samedomainLast3WeeksHighIntensity = true;
      }
    }

    const samedomainLast2Weeks =
      last3Checkins &&
      last3Checkins.slice(0, 2).every((c) => c.primary_domain_id === primary_domain_id);

    // 4. Run risk engine
    const riskContext = buildRiskContext(
      { intensity_numeric, primary_domain_id },
      lastCheckinIntensity,
      samedomainLast2Weeks || false,
      samedomainLast3WeeksHighIntensity,
      inferredSelfHarm
    );

    const riskResult = calculateRiskScore(riskContext);

    // Map risk_score to risk_tier (GDPR-compliant tiers)
    let risk_tier = 0;
    if (riskResult.risk_score >= 10 || inferredSelfHarm === 'often') {
      risk_tier = 3; // R3: Priority (active intent indicators)
    } else if (riskResult.risk_score >= 7 || inferredSelfHarm === 'sometimes') {
      risk_tier = 2; // R2: Support-eligible (passive ideation)
    } else if (riskResult.risk_score >= 4) {
      risk_tier = 1; // R1: Elevated (vulnerability signals)
    } else {
      risk_tier = 0; // R0: Normal distress
    }

    console.log('[CHECKIN_DEBUG] Risk Assessment:', {
      response_text_preview: response_text.substring(0, 100),
      inferredSelfHarm,
      risk_score: riskResult.risk_score,
      risk_tier,
      trigger_reasons: riskResult.trigger_reasons,
    });

    // 5. Persist check-in (no direct risk fields anymore per GDPR schema)
    const { data: checkin, error: checkinError } = await serviceClient
      .from('weekly_checkin_responses')
      .insert({
        user_id,
        week_number,
        semester_year,
        completed_at: new Date().toISOString(),
        primary_domain_id,
        secondary_domain_id,
        intensity_label,
        intensity_numeric,
        structured_prompt,
        response_text,
        suggested_action,
      })
      .select()
      .single();

    if (checkinError) {
      console.error('[CHECKIN_ERROR]', {
        error: checkinError,
        user_id,
        week_number,
        semester_year,
        primary_domain_id,
        secondary_domain_id,
        intensity_label,
        intensity_numeric,
        structured_prompt,
        response_text,
        suggested_action,
      });
      return new Response(JSON.stringify({ error: `Failed to save check-in: ${checkinError.message}`, details: checkinError }), {
        status: 500,
      });
    }

    // 6. Create risk_event for ALL tiers (R0-R3) for statistics tracking
    if (checkin) {
      // Get user's institution
      const { data: userProfile } = await serviceClient
        .from('users_extended')
        .select('institution_id')
        .eq('user_id', user_id)
        .single();

      const fallbackInstitutionId = '550e8400-e29b-41d4-a716-446655440000';
      const institutionId = userProfile?.institution_id || fallbackInstitutionId;

      // Convert trigger reasons to enumerated codes
      const reason_codes: string[] = [];
      if (inferredSelfHarm !== 'none') {
        reason_codes.push('self_harm_keywords');
      }
      if (riskContext.last_check_in_intensity && intensity_numeric - riskContext.last_check_in_intensity >= 2) {
        reason_codes.push('intensity_spike');
      }
      if (samedomainLast3WeeksHighIntensity) {
        reason_codes.push('sustained_high_intensity');
      }
      if (intensity_numeric >= 4) {
        reason_codes.push('high_intensity_current');
      }

      if (institutionId) {
        const { error: riskEventError } = await serviceClient
          .from('risk_events')
          .insert({
            user_id,
            checkin_id: checkin.id,
            institution_id: institutionId,
            risk_tier: risk_tier,
            risk_reason_codes: reason_codes,
            confidence_band: inferredSelfHarm !== 'none' ? 'high' : 'medium',
            model_version: '1.1',
          });

        if (riskEventError) {
          console.error('[RISK_EVENT_ERROR]', {
            error: riskEventError,
            user_id,
            checkin_id: checkin.id,
            institution_id: institutionId,
            risk_tier,
            reason_codes,
            confidence_band: inferredSelfHarm !== 'none' ? 'high' : 'medium',
            model_version: '1.1',
          });
          // Don't fail the check-in if risk event creation fails
        }
      }
    }

    // 7. Return result (include risk_tier for client-side support offer)
    return new Response(
      JSON.stringify({
        success: true,
        checkin: {
          id: checkin?.id,
          risk_tier: risk_tier,
          risk_score: riskResult.risk_score,
          high_risk: risk_tier >= 2, // For backward compatibility
          explanation: riskResult.explanation,
        },
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error('[CHECKIN_ROUTE_ERROR]', {
      error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }),
      { status: 500 }
    );
  }
}
