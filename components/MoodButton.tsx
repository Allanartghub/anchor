'use client';

import type { Mood } from '@/lib/types';

interface MoodButtonProps {
  mood: Mood;
  isSelected: boolean;
  onClick: () => void;
}

export default function MoodButton({ mood, isSelected, onClick }: MoodButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 ${
        isSelected
          ? 'bg-calm-blue border-2 border-calm-text ring-2 ring-calm-blue ring-offset-2'
          : 'bg-gray-100 border-2 border-transparent hover:bg-gray-200'
      }`}
    >
      <span className="text-3xl mb-1">{mood.emoji}</span>
      <span className="text-xs font-medium text-calm-text">{mood.label}</span>
    </button>
  );
}
