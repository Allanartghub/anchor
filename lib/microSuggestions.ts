// Load-domain micro-suggestions for when Anchor AI is unavailable
// Non-AI, prewritten fallback suggestions that are calm and supportive

export interface MicroSuggestion {
  text: string;
  isOffline: boolean;
}

const SUGGESTIONS_BY_DOMAIN: Record<string, string[]> = {
  academic: [
    'Pick one academic task and define a 20-minute start. Small starts reduce load fastest.',
    'If deadlines feel heavy, write the next concrete step and ignore the rest for now.',
  ],
  financial: [
    'List one expense you can pause this week, even if it\'s small. Relief comes from clarity.',
    'If money feels tight, consider one practical action today: check a budget, ask about bursaries, or review hours.',
  ],
  belonging: [
    'Social load drops when you start small. One short message to someone safe can help.',
    'Consider a low-effort connection this week: a walk with a classmate or a study buddy check-in.',
  ],
  administrative: [
    'Administrative load eases with a clear list. Write the top two tasks and ignore the rest for today.',
    'If paperwork feels heavy, set a 15-minute timer and tackle just the first step.',
  ],
  worklife: [
    'Time load drops when you protect one block. Try a 60-minute no-distraction window this week.',
    'If work-study balance is strained, pick one boundary for this week (start time, end time, or one break).',
  ],
  health: [
    'Energy load often improves with one small reset: water, food, or a short walk.',
    'If you feel drained, pick one recovery habit to repeat for three days in a row.',
  ],
  future: [
    'Future load eases with clarity. Write one question you need answered and who could help.',
    'If next steps feel unclear, list one option you could explore this week (even a small one).',
  ],
};

export function getMicroSuggestion(domainId: string | null): MicroSuggestion {
  // If no domain context, use a neutral suggestion
  if (!domainId || !SUGGESTIONS_BY_DOMAIN[domainId]) {
    return {
      text: 'Thanks for sharing. Your check-in is saved, and your load matters.',
      isOffline: true,
    };
  }

  const suggestions = SUGGESTIONS_BY_DOMAIN[domainId];
  const randomIndex = Math.floor(Math.random() * suggestions.length);

  return {
    text: suggestions[randomIndex],
    isOffline: true,
  };
}

export function getOfflineMessage(): string {
  return 'Anchor is taking a break right now. Your check-in is saved. Try again in a bit.';
}
