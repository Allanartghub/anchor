import { LoadEntry, WeeklyCheckinResponse, MENTAL_LOAD_DOMAINS } from './types';

export interface WeeklySummary {
  weekNumber: number;
  semesterYear: number;
  checkIn: WeeklyCheckinResponse | null;
  adHocEntries: LoadEntry[];
  dominantDomains: string[];
  overallIntensity: 'Light' | 'Moderate' | 'Heavy';
  isHeavy: boolean;
  requiresAttention: boolean;
  reflection: string;
  optionalPrompt: string | null;
}

/**
 * Determine overall intensity from check-in and supporting entries
 */
function determineOverallIntensity(
  checkIn: WeeklyCheckinResponse | null,
  adHocEntries: LoadEntry[]
): 'Light' | 'Moderate' | 'Heavy' {
  if (!checkIn && adHocEntries.length === 0) return 'Light';

  const intensities: ('Light' | 'Moderate' | 'Heavy')[] = [];

  if (checkIn) intensities.push(checkIn.intensity_label);
  adHocEntries.forEach((entry) => {
    intensities.push(entry.intensity_label);
  });

  // If any Heavy, overall is Heavy
  if (intensities.includes('Heavy')) return 'Heavy';
  // If multiple Moderate or any combination with Moderate, overall is Moderate
  if (intensities.includes('Moderate')) return 'Moderate';
  return 'Light';
}

/**
 * Extract dominant domains from check-in and ad-hoc entries
 */
function extractDominantDomains(
  checkIn: WeeklyCheckinResponse | null,
  adHocEntries: LoadEntry[]
): string[] {
  const domainMap: Record<string, number> = {};

  // Weight check-in domains heavily
  if (checkIn) {
    if (checkIn.primary_domain_id) {
      domainMap[checkIn.primary_domain_id] = (domainMap[checkIn.primary_domain_id] || 0) + 3;
    }
    if (checkIn.secondary_domain_id) {
      domainMap[checkIn.secondary_domain_id] = (domainMap[checkIn.secondary_domain_id] || 0) + 2;
    }
  }

  // Add ad-hoc entries
  adHocEntries.forEach((entry) => {
    // For now, assume domains are stored as a single primary domain
    // In full implementation, this would join with load_domain_selections
    domainMap[entry.id] = (domainMap[entry.id] || 0) + 1;
  });

  // Sort by frequency and return top 2
  return Object.entries(domainMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([domain]) => domain);
}

/**
 * Get domain label by ID
 */
function getDomainLabel(domainId: string): string {
  const domain = MENTAL_LOAD_DOMAINS.find((d) => d.id === domainId);
  return domain?.label || domainId;
}

/**
 * Get domain emoji by ID
 */
function getDomainEmoji(domainId: string): string {
  const domain = MENTAL_LOAD_DOMAINS.find((d) => d.id === domainId);
  return domain?.emoji || '📌';
}

/**
 * Generate AI reflection for the week (template-based for now)
 * In production, call LLM endpoint
 */
function generateWeeklyReflection(summary: Partial<WeeklySummary>): string {
  const { checkIn, adHocEntries, dominantDomains, overallIntensity } = summary;

  if (!checkIn && adHocEntries?.length === 0) {
    return "No entries this week. You're doing better—enjoy the steady pace.";
  }

  const domainNames = dominantDomains
    ?.map((d) => getDomainLabel(d).toLowerCase())
    .join(' and ') || 'multiple areas';

  const entryContext =
    adHocEntries && adHocEntries.length > 1
      ? `With ${adHocEntries.length} separate entries logged`
      : '';

  if (overallIntensity === 'Heavy') {
    if (dominantDomains?.includes('financial') || dominantDomains?.includes('administrative')) {
      return `${domainNames} put real pressure on you this week. ${entryContext} This is serious and worth addressing.`;
    } else if (dominantDomains?.includes('future')) {
      return `Uncertainty about ${domainNames} weighed on you this week. That kind of load is real, even when it's not urgent.`;
    }
    return `${domainNames} felt heavier than usual. ${entryContext} Your load matters—what would help most?`;
  }

  if (overallIntensity === 'Moderate') {
    return `${domainNames} required attention this week. You tracked it clearly—that's the first step toward steadiness.`;
  }

  return `A lighter week overall, but you were present to what mattered. That steady attention is exactly what helps.`;
}

/**
 * Generate optional forward motion prompt for Heavy weeks
 */
function generateOptionalPrompt(summary: Partial<WeeklySummary>): string | null {
  if (summary.overallIntensity !== 'Heavy') return null;

  const prompts = [
    'Want to unpack what made this week so heavy?',
    'Would it help to talk through what happened?',
    'Do you want to explore what might help next week?',
  ];

  // Deterministic selection based on week number for consistency
  const index = (summary.weekNumber || 0) % prompts.length;
  return prompts[index];
}

/**
 * Group load entries and check-ins by week, generate summaries
 */
export function generateWeeklySummaries(
  checkIns: WeeklyCheckinResponse[],
  loadEntries: LoadEntry[]
): WeeklySummary[] {
  // Group by week/year
  const weekMap: Record<string, WeeklySummary> = {};

  // Process check-ins
  checkIns.forEach((checkIn) => {
    const key = `${checkIn.semester_year}-W${checkIn.week_number}`;
    weekMap[key] = {
      weekNumber: checkIn.week_number,
      semesterYear: checkIn.semester_year,
      checkIn,
      adHocEntries: [],
      dominantDomains: [],
      overallIntensity: 'Light',
      isHeavy: false,
      requiresAttention: false,
      reflection: '',
      optionalPrompt: null,
    };
  });

  // Process ad-hoc entries
  loadEntries.forEach((entry) => {
    const key = `${entry.semester_year}-W${entry.week_number}`;
    if (!weekMap[key]) {
      weekMap[key] = {
        weekNumber: entry.week_number,
        semesterYear: entry.semester_year,
        checkIn: null,
        adHocEntries: [],
        dominantDomains: [],
        overallIntensity: 'Light',
        isHeavy: false,
        requiresAttention: false,
        reflection: '',
        optionalPrompt: null,
      };
    }
    weekMap[key].adHocEntries.push(entry);
  });

  // Calculate summaries
  const summaries = Object.values(weekMap).map((summary) => {
    summary.overallIntensity = determineOverallIntensity(summary.checkIn, summary.adHocEntries);
    summary.dominantDomains = extractDominantDomains(summary.checkIn, summary.adHocEntries);
    summary.isHeavy = summary.overallIntensity === 'Heavy';
    summary.requiresAttention = summary.isHeavy || summary.adHocEntries.length > 2;
    summary.reflection = generateWeeklyReflection(summary);
    summary.optionalPrompt = generateOptionalPrompt(summary);
    return summary;
  });

  // Sort by week descending (most recent first)
  return summaries.sort((a, b) => {
    const aTime = a.semesterYear * 53 + a.weekNumber;
    const bTime = b.semesterYear * 53 + b.weekNumber;
    return bTime - aTime;
  });
}
