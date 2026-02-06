'use client';

interface MoodCardProps {
  emoji: string;
  moodLabel: string;
  timestamp: Date;
  text: string | null;
}

export default function MoodCard({ emoji, moodLabel, timestamp, text }: MoodCardProps) {
  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    let dateStr = '';
    if (dateOnly.getTime() === todayOnly.getTime()) {
      dateStr = 'Today';
    } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
      dateStr = 'Yesterday';
    } else {
      dateStr = date.toLocaleDateString('en-IE', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }

    const timeStr = date.toLocaleTimeString('en-IE', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return `${dateStr} at ${timeStr}`;
  };

  return (
    <div className="calm-card">
      <div className="flex items-start gap-4">
        <div className="text-4xl">{emoji}</div>
        <div className="flex-1">
          <p className="font-medium text-calm-text">{moodLabel}</p>
          <p className="text-xs text-gray-500 mb-3">{formatDate(timestamp)}</p>
          {text && (
            <p className="text-sm text-gray-700 italic">"{text}"</p>
          )}
        </div>
      </div>
    </div>
  );
}
