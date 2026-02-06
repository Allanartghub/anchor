// Mood-mapped micro-suggestions for when Serene (AI) is unavailable
// Non-AI, prewritten fallback suggestions that are calm and supportive

export interface MicroSuggestion {
  text: string;
  isOffline: boolean;
}

const SUGGESTIONS_BY_MOOD: Record<string, string[]> = {
  calm: [
    'You\'re in a calm space right now. Consider pausing here to notice what\'s working for you.',
    'This calm moment is valuable. You might journal what led to feeling this way.',
  ],
  okay: [
    'You\'re doing okay. Small things can help: a short walk, a cup of tea, or just taking a breath.',
    'Feeling okay is a good baseline. Notice one thing you\'re grateful for right now.',
  ],
  stressed: [
    'When stressed, try the 5-4-3-2-1 grounding: notice 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste.',
    'Stress often needs release. Consider deep breathing, a walk, or movement that feels good.',
  ],
  low: [
    'When feeling low, small actions help: step outside for a moment, reach out to someone you trust, or do something you usually enjoy.',
    'You\'ve felt better before and you will again. Right now, be gentle with yourself.',
  ],
  angry: [
    'Anger is valid. It might help to express it safely: write it out, move your body, or take time alone.',
    'When angry, pause if you can. Your anger is information—it\'s worth listening to what it\'s telling you.',
  ],
  overwhelmed: [
    'When overwhelmed, break things into one small step. What\'s one thing you could do in the next 5 minutes?',
    'Overwhelm often means too much at once. Try focusing on just one thing, or stepping away for a moment.',
  ],
};

export function getMicroSuggestion(moodId: string | null): MicroSuggestion {
  // If no mood context, use a neutral suggestion
  if (!moodId || !SUGGESTIONS_BY_MOOD[moodId]) {
    return {
      text: 'Thank you for checking in. Your check-in is saved and valued.',
      isOffline: true,
    };
  }

  const suggestions = SUGGESTIONS_BY_MOOD[moodId];
  const randomIndex = Math.floor(Math.random() * suggestions.length);

  return {
    text: suggestions[randomIndex],
    isOffline: true,
  };
}

export function getOfflineMessage(): string {
  return 'Serene is taking a break right now. Your check-in is saved. Try again in a bit.';
}
