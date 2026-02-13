/**
 * ANCHOR INSTITUTIONAL BACKEND - RISK ENGINE
 * 
 * Deterministic, explainable risk scoring for high-risk identification.
 * Runs server-side only, before persisting check-ins.
 * 
 * MVP Rules (explainable weights):
 * - Self-harm indicator (sometimes) → +5
 * - Self-harm indicator (often) → +8
 * - Intensity ≥4 → +2
 * - Same domain high intensity 3 consecutive weeks → +3
 * - Sudden spike (intensity increase of 2+ from last week) → +2
 * 
 * Threshold: risk_score ≥7 → high_risk = true
 */

import { LoadIntensityNumeric} from './types';

export type SelfHarmIndicator = 'none' | 'sometimes' | 'often';

export interface RiskScoreResult {
  risk_score: number;
  high_risk: boolean;
  trigger_reasons: string[];
  explanation: string;
}

export interface RiskCheckInContext {
  intensity_numeric: LoadIntensityNumeric;
  self_harm_indicator: SelfHarmIndicator;
  primary_domain_id: string | null;
  // Historical context
  last_check_in_intensity?: LoadIntensityNumeric;
  last_two_check_ins_same_domain?: boolean;
  last_three_weeks_same_domain_intensity?: boolean;
}

/**
 * Calculate risk score deterministically.
 * 
 * All triggers are explainable and logged in trigger_reasons.
 * @param context Check-in context with self-harm and intensity data
 * @returns Risk score, high_risk boolean, and trigger reasons
 */
export function calculateRiskScore(context: RiskCheckInContext): RiskScoreResult {
  let risk_score = 0;
  const trigger_reasons: string[] = [];
  const explanation_parts: string[] = [];

  // Rule 1: Self-harm indicator
  if (context.self_harm_indicator === 'sometimes') {
    risk_score += 5;
    trigger_reasons.push('self_harm_sometimes');
    explanation_parts.push('Self-harm sometimes reported (+5)');
  } else if (context.self_harm_indicator === 'often') {
    risk_score += 8;
    trigger_reasons.push('self_harm_often');
    explanation_parts.push('Self-harm often reported (+8)');
  }

  // Rule 2: High intensity
  if (context.intensity_numeric >= 4) {
    risk_score += 2;
    trigger_reasons.push('high_intensity');
    explanation_parts.push(`High intensity (${context.intensity_numeric}/5) (+2)`);
  }

  // Rule 3: Sudden spike (2+ increase from last week)
  if (
    context.last_check_in_intensity !== undefined &&
    context.intensity_numeric - context.last_check_in_intensity >= 2
  ) {
    risk_score += 2;
    trigger_reasons.push('intensity_spike');
    explanation_parts.push(
      `Intensity spike: ${context.last_check_in_intensity} → ${context.intensity_numeric} (+2)`
    );
  }

  // Rule 4: Same domain high intensity 3 consecutive weeks
  if (context.last_three_weeks_same_domain_intensity === true) {
    risk_score += 3;
    trigger_reasons.push('repeated_domain_spike');
    explanation_parts.push(
      `Same domain ${context.primary_domain_id} high intensity 3 weeks (+3)`
    );
  }

  // Threshold: ≥7 = high_risk
  const high_risk = risk_score >= 7;
  const explanation = explanation_parts.length > 0
    ? explanation_parts.join('; ')
    : 'No risk factors detected.';

  return {
    risk_score,
    high_risk,
    trigger_reasons,
    explanation,
  };
}

/**
 * Helper: Build risk context from recent check-ins and current data.
 * 
 * This simulates what would typically be queried from the database.
 * In the API route, you'd pass actual check-in history.
 * 
 * @param current Current check-in intensity, domain, self-harm
 * @param lastCheckinIntensity Previous week's intensity
 * @param samedomainLast2Weeks Whether same domain appeared last 2 weeks
 * @param samedomainLast3WeeksHighIntensity Whether same domain high intensity 3 weeks
 * @param selfHarmIndicator Self-harm metric
 * @returns Risk context ready for calculateRiskScore
 */
export function buildRiskContext(
  current: {
    intensity_numeric: LoadIntensityNumeric;
    primary_domain_id: string | null;
  },
  lastCheckinIntensity: LoadIntensityNumeric | undefined,
  samedomainLast2Weeks: boolean,
  samedomainLast3WeeksHighIntensity: boolean,
  selfHarmIndicator: SelfHarmIndicator
): RiskCheckInContext {
  return {
    intensity_numeric: current.intensity_numeric,
    self_harm_indicator: selfHarmIndicator,
    primary_domain_id: current.primary_domain_id,
    last_check_in_intensity: lastCheckinIntensity,
    last_two_check_ins_same_domain: samedomainLast2Weeks,
    last_three_weeks_same_domain_intensity: samedomainLast3WeeksHighIntensity,
  };
}

/**
 * Log risk event result (for debugging + audit).
 * In production, this could send to logging service.
 */
export function logRiskEvent(
  user_id: string,
  result: RiskScoreResult,
  timestamp: string = new Date().toISOString()
): void {
  if (result.high_risk) {
    console.warn(
      `[RISK_HIGH] User ${user_id} at ${timestamp}:`,
      `Score: ${result.risk_score}, Reasons: ${result.trigger_reasons.join(', ')}`
    );
  } else if (result.risk_score > 0) {
    console.info(
      `[RISK_MODERATE] User ${user_id} at ${timestamp}:`,
      `Score: ${result.risk_score}, Triggers: ${result.trigger_reasons.join(', ')}`
    );
  }
}
