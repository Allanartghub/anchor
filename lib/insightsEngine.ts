/**
 * ANCHOR INSTITUTIONAL BACKEND - INSIGHTS ENGINE
 * 
 * Generates structured, strategic insights for institutional dashboards.
 * 
 * Output is **NOT** AI prose—just structured JSON with actionable recommendations.
 * Insights surface:
 * - Top pressure domain this month
 * - Largest week-over-week change
 * - Repeated domain spikes
 * - Exam-season patterns (reserved for future refinement)
 */

import { MentalLoadDomainId } from './types';

export interface InsightGeneratorInput {
  institution_id: string;
  week_number: number;
  semester_year: number;
  
  // Aggregated data for the week
  check_in_count: number;
  high_risk_count: number;
  
  // Domain-level stats
  domain_stats: DomainStat[];
  
  // Historical WoW
  previous_week_domain_stats?: DomainStat[];
}

export interface DomainStat {
  domain_id: MentalLoadDomainId;
  count: number;
  avg_intensity: number;
  high_intensity_count: number; // How many ≥4
}

export interface StrategicInsightOutput {
  week_number: number;
  semester_year: number;
  
  // Top pressure domain
  top_domain: MentalLoadDomainId | null;
  top_domain_count: number;
  
  // Spike detection
  weekly_spike_percent: number; // % increase in "heavy" responses
  spike_description: string; // E.g., "32% more heavy reports than last week"
  
  // Repeated patterns
  repeated_spike_domains: MentalLoadDomainId[];
  
  // Risk summary
  risk_event_count: number;
  high_intensity_pct: number;
  
  // Recommendation for strategy (not clinical)
  recommendation_hint: string;
}

/**
 * Generate structured insights from aggregated cohort data.
 * 
 * MVP focuses on domain trends and intensity spikes.
 * Does NOT surface PII or raw student data.
 * 
 * @param input Aggregated cohort stats for this week
 * @returns Structured insight object for admin dashboard
 */
export function generateInsights(input: InsightGeneratorInput): StrategicInsightOutput {
  const { week_number, semester_year, domain_stats, previous_week_domain_stats, high_risk_count, check_in_count } = input;

  // 1. Find top domain by count
  const topDomain = domain_stats.length > 0
    ? domain_stats.reduce((max, ds) => ds.count > max.count ? ds : max)
    : null;

  // 2. Calculate WoW spike
  let weekly_spike_percent = 0;
  let spike_description = '';
  if (previous_week_domain_stats && previous_week_domain_stats.length > 0) {
    const current_heavy_count = domain_stats.reduce((sum, ds) => sum + ds.high_intensity_count, 0);
    const previous_heavy_count = previous_week_domain_stats.reduce((sum, ds) => sum + ds.high_intensity_count, 0);
    
    if (previous_heavy_count > 0) {
      weekly_spike_percent = ((current_heavy_count - previous_heavy_count) / previous_heavy_count) * 100;
    } else if (current_heavy_count > 0) {
      weekly_spike_percent = 100; // Went from 0 to some heavy
    }
    
    if (weekly_spike_percent !== 0) {
      spike_description = `${Math.round(weekly_spike_percent)}% ${weekly_spike_percent > 0 ? 'increase' : 'decrease'} in high-intensity reports`;
    }
  }

  // 3. Identify repeated spikes (domains appearing heavy multiple weeks)
  // MVP: If a domain is top 3 consistently, flag it
  const repeated_spike_domains = domain_stats
    .filter((ds) => ds.high_intensity_count > (check_in_count * 0.3)) // 30%+ are heavy
    .slice(0, 3)
    .map((ds) => ds.domain_id);

  // 4. Calculate high-intensity %
  const high_intensity_pct = check_in_count > 0
    ? (high_risk_count / check_in_count) * 100
    : 0;

  // 5. Generate recommendation hint (strategic, not clinical)
  const recommendation_hint = generateRecommendation(
    topDomain?.domain_id || null,
    weekly_spike_percent,
    high_intensity_pct,
    repeated_spike_domains
  );

  return {
    week_number,
    semester_year,
    top_domain: topDomain?.domain_id || null,
    top_domain_count: topDomain?.count || 0,
    weekly_spike_percent,
    spike_description,
    repeated_spike_domains,
    risk_event_count: high_risk_count,
    high_intensity_pct,
    recommendation_hint,
  };
}

/**
 * Generate strategic recommendation based on patterns.
 * 
 * Input: domain patterns, spike severity, risk level.
 * Output: action hint for counselling office (not clinical advice).
 * 
 * Examples:
 * - "Consider financial guidance workshop for first-year MSc students"
 * - "High administrative load reported; check visa/visa-extension deadlines"
 * - "Academic pressure sustained; consider peer study group promotion"
 */
export function generateRecommendation(
  top_domain: MentalLoadDomainId | null,
  weekly_spike_percent: number,
  high_intensity_pct: number,
  repeated_domains: MentalLoadDomainId[]
): string {
  const hints: string[] = [];

  // High spike severity
  if (weekly_spike_percent > 50) {
    hints.push('⚠️ Significant spike in load this week');
  }

  // High-risk cohort proportion
  if (high_intensity_pct > 40) {
    hints.push(`🚨 ${Math.round(high_intensity_pct)}% of cohort reporting high intensity`);
  }

  // Domain-specific recommendations
  if (top_domain) {
    switch (top_domain) {
      case 'financial':
        hints.push(
          'Consider offering financial guidance session (scholarships, part-time work balance, cost-of-living support)'
        );
        break;
      case 'academic':
        hints.push(
          'High academic pressure. Promote peer study groups, library workshops, assignment breakdown support.'
        );
        break;
      case 'administrative':
        hints.push(
          'Administrative/immigration load high. Verify visa deadlines, stamp conditions timing. Offer office hours.'
        );
        break;
      case 'belonging':
        hints.push(
          'Social integration stress. Consider structured social events, peer mentoring program, community-building activities.'
        );
        break;
      case 'health':
        hints.push(
          'Health and energy concerns reported. Promote gym, sleep hygiene, nutrition resources, climate adjustment support.'
        );
        break;
      case 'worklife':
        hints.push(
          'Work-life balance strain. Discuss part-time work policies, time management, study-work boundaries.'
        );
        break;
      case 'future':
        hints.push(
          'Post-graduation and career uncertainty. Host career development workshop, industry networking session, alumni panel.'
        );
        break;
    }
  }

  // Repeated spikes = sustained pressure (not just one-week blip)
  if (repeated_domains.length > 1) {
    hints.push(
      `${repeated_domains.length} domains showing sustained high pressure – consider holistic support approach`
    );
  }

  return hints.length > 0 ? hints.join(' | ') : 'Cohort stable; continue monitoring.';
}

/**
 * Helper: Calculate intensity spike percentage.
 * 
 * Simple metric: % of check-ins with intensity ≥4 (Heavy).
 */
export function calculateIntensitySpikePercent(
  current_count: number,
  total_count: number
): number {
  return total_count > 0 ? (current_count / total_count) * 100 : 0;
}

/**
 * Helper: Identify sustained pressure (same domain, multiple weeks).
 * 
 * @param domain_history Array of domain_id for last N weeks, in order
 * @param weeks_to_check How many recent weeks to analyze (default 3)
 * @returns true if same domain appears consistently
 */
export function isSustainedPressure(
  domain_history: MentalLoadDomainId[],
  weeks_to_check: number = 3
): boolean {
  if (domain_history.length < weeks_to_check) return false;
  
  const recent = domain_history.slice(-weeks_to_check);
  const first = recent[0];
  
  return recent.every((d) => d === first);
}
