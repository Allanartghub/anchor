'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkConsents } from '@/lib/consent';
import { MOODS_DEPRECATED as MOODS, type MoodEntry } from '@/lib/types';
import Navigation from '@/components/Navigation';
import MoodCard from '@/components/MoodCard';

type ViewMode = 'list' | 'calendar' | 'graph';
type TimeRange = 7 | 14 | 30 | 180;

interface GroupedMoods {
  [date: string]: MoodEntry[];
}

export default function TimelinePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [timeRange, setTimeRange] = useState<TimeRange>(30);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [displayMonth, setDisplayMonth] = useState(new Date());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const hasConsented = await checkConsents(session.user.id);
      if (!hasConsented) {
        router.push('/consent');
        return;
      }

      setUserId(session.user.id);
      await loadEntries(session.user.id);
    };

    checkAuth();
  }, [router]);

  const loadEntries = async (uid: string) => {
    try {
      const { data, error: queryError } = await supabase
        .from('mood_entries')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      if (queryError) {
        setError('Failed to load entries');
        console.error('Query error:', queryError);
      } else {
        setEntries(data || []);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const getMoodLabel = (moodId: string) => {
    return MOODS.find(m => m.id === moodId)?.label || moodId;
  };

  const getMoodEmoji = (moodId: string) => {
    return MOODS.find(m => m.id === moodId)?.emoji || '?';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const formatDateKey = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const toggleDayExpanded = (dateKey: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  };

  // Group entries by date for list view
  const groupedByDate = useMemo(() => {
    const grouped: GroupedMoods = {};
    entries.forEach((entry) => {
      const dateKey = new Date(entry.created_at).toISOString().split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(entry);
    });
    return grouped;
  }, [entries]);

  // Get entries for selected date or time range
  const filteredEntries = useMemo(() => {
    if (viewMode === 'calendar' && selectedDate) {
      // Calendar view: show entries for selected date
      return groupedByDate[selectedDate] || [];
    } else if (viewMode === 'graph') {
      // Graph view: filter by time range
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - timeRange);
      return entries.filter(entry => new Date(entry.created_at) >= cutoffDate);
    } else {
      // List view: all entries
      return entries;
    }
  }, [viewMode, selectedDate, timeRange, groupedByDate, entries]);

  // Get mood frequency for graph
  const moodFrequency = useMemo(() => {
    const frequency: { [key: string]: number } = {};
    MOODS.forEach(mood => {
      frequency[mood.id] = 0;
    });
    filteredEntries.forEach((entry) => {
      frequency[entry.mood_id] = (frequency[entry.mood_id] || 0) + 1;
    });
    return frequency;
  }, [filteredEntries]);

  // Calendar grid calculation
  const calendarDays = useMemo(() => {
    const year = displayMonth.getFullYear();
    const month = displayMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    const current = new Date(startDate);
    while (current < new Date(year, month + 1, 1) || current.getDay() !== 0) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  }, [displayMonth]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-calm-cream">
        <p className="text-calm-text">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-calm-cream flex flex-col pb-[calc(120px+env(safe-area-inset-bottom))]">
      <div className="flex-1 px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-light text-calm-text mb-2">Mood Snapshot</h1>
            <p className="text-sm text-gray-500">
              A secondary view of your mood over time. Your primary focus is mental load tracking.
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 mb-6">
              {error}
            </div>
          )}

          {/* View Mode Toggle */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            <button
              onClick={() => { setViewMode('list'); setSelectedDate(null); }}
              className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-calm-teal text-calm-text'
                  : 'border border-calm-border text-gray-600 hover:bg-calm-cream'
              }`}
            >
              List
            </button>
            <button
              onClick={() => { setViewMode('calendar'); setSelectedDate(null); }}
              className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-calm-teal text-calm-text'
                  : 'border border-calm-border text-gray-600 hover:bg-calm-cream'
              }`}
            >
              Calendar
            </button>
            <button
              onClick={() => { setViewMode('graph'); setSelectedDate(null); }}
              className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-colors ${
                viewMode === 'graph'
                  ? 'bg-calm-teal text-calm-text'
                  : 'border border-calm-border text-gray-600 hover:bg-calm-cream'
              }`}
            >
              Insights
            </button>
          </div>

          {/* List View */}
          {viewMode === 'list' && (
            <>
              {entries.length === 0 ? (
                <div className="calm-card text-center py-12">
                  <p className="text-gray-500 mb-4">No entries yet</p>
                  <p className="text-xs text-gray-400">Check in with yourself to get started.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedByDate)
                    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
                    .map(([date, dayEntries]) => {
                      const dateObj = new Date(date);
                      const today = new Date();
                      const yesterday = new Date(today);
                      yesterday.setDate(yesterday.getDate() - 1);
                      const isToday = date === formatDateKey(today);
                      const isYesterday = date === formatDateKey(yesterday);

                      let dateLabel = '';
                      if (isToday) dateLabel = 'Today';
                      else if (isYesterday) dateLabel = 'Yesterday';
                      else dateLabel = dateObj.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

                      const isExpanded = expandedDays.has(date);
                      const hasMultipleEntries = dayEntries.length > 2;
                      const visibleEntries = isExpanded || !hasMultipleEntries 
                        ? dayEntries 
                        : dayEntries.slice(0, 2);
                      const hiddenCount = dayEntries.length - 2;

                      return (
                        <div key={date}>
                          <h2 className="text-sm font-medium text-calm-text mb-3">{dateLabel}</h2>
                          <div className="space-y-3">
                            {visibleEntries.map((entry) => (
                              <MoodCard
                                key={entry.id}
                                emoji={getMoodEmoji(entry.mood_id)}
                                moodLabel={getMoodLabel(entry.mood_id)}
                                timestamp={new Date(entry.created_at)}
                                text={entry.text}
                              />
                            ))}
                          </div>
                          {hasMultipleEntries && (
                            <button
                              onClick={() => toggleDayExpanded(date)}
                              className="mt-3 text-sm text-calm-teal hover:text-calm-text transition-colors font-medium"
                            >
                              {isExpanded 
                                ? 'Show less' 
                                : `Show ${hiddenCount} more`}
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </>
          )}

          {/* Calendar View */}
          {viewMode === 'calendar' && (
            <div className="space-y-6">
              {/* Month Navigation */}
              <div className="calm-card">
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={() => {
                      const prev = new Date(displayMonth);
                      prev.setMonth(prev.getMonth() - 1);
                      setDisplayMonth(prev);
                    }}
                    className="px-3 py-1 text-sm border border-calm-border rounded-lg hover:bg-calm-cream transition-colors"
                  >
                    ← Prev
                  </button>
                  <h3 className="text-lg font-medium text-calm-text">
                    {displayMonth.toLocaleDateString([], { month: 'long', year: 'numeric' })}
                  </h3>
                  <button
                    onClick={() => {
                      const next = new Date(displayMonth);
                      next.setMonth(next.getMonth() + 1);
                      setDisplayMonth(next);
                    }}
                    className="px-3 py-1 text-sm border border-calm-border rounded-lg hover:bg-calm-cream transition-colors"
                  >
                    Next →
                  </button>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, idx) => {
                    const dateKey = formatDateKey(day);
                    const dayEntries = groupedByDate[dateKey] || [];
                    const isCurrentMonth = day.getMonth() === displayMonth.getMonth();
                    const isSelected = selectedDate === dateKey;

                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                        className={`aspect-square flex items-center justify-center text-sm rounded-lg font-medium transition-colors ${
                          !isCurrentMonth
                            ? 'text-gray-300 bg-gray-50'
                            : isSelected
                              ? 'bg-calm-teal text-calm-text border-2 border-calm-text'
                              : dayEntries.length > 0
                                ? 'bg-calm-sage text-calm-text hover:bg-calm-teal'
                                : 'border border-calm-border text-gray-600 hover:bg-calm-cream'
                        }`}
                        title={dayEntries.length > 0 ? `${dayEntries.length} mood${dayEntries.length > 1 ? 's' : ''}` : ''}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Date Entries */}
              {selectedDate && (
                <div>
                  <h3 className="text-sm font-medium text-calm-text mb-3">
                    {new Date(selectedDate).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                  </h3>
                  {filteredEntries.length === 0 ? (
                    <div className="calm-card text-center py-8">
                      <p className="text-sm text-gray-500">No entries for this date</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredEntries.map((entry) => (
                        <MoodCard
                          key={entry.id}
                          emoji={getMoodEmoji(entry.mood_id)}
                          moodLabel={getMoodLabel(entry.mood_id)}
                          timestamp={new Date(entry.created_at)}
                          text={entry.text}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Graph View */}
          {viewMode === 'graph' && (
            <div className="space-y-6">
              {/* Time Range Selector */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {([7, 14, 30, 180] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range as TimeRange)}
                    className={`px-3 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-colors ${
                      timeRange === range
                        ? 'bg-calm-teal text-calm-text'
                        : 'border border-calm-border text-gray-600 hover:bg-calm-cream'
                    }`}
                  >
                    {range === 180 ? '6m' : `${range}d`}
                  </button>
                ))}
              </div>

              {/* Mood Frequency Graph */}
              <div className="calm-card">
                <h3 className="font-medium text-calm-text mb-4">Most Frequent Moods</h3>
                <div className="space-y-4">
                  {MOODS.map((mood) => {
                    const count = moodFrequency[mood.id] || 0;
                    const maxCount = Math.max(...Object.values(moodFrequency), 1);
                    const percentage = (count / maxCount) * 100;

                    return (
                      <div key={mood.id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-700">
                            <span className="mr-2">{mood.emoji}</span>
                            {mood.label}
                          </span>
                          <span className="text-xs text-gray-500">{count}</span>
                        </div>
                        <div className="w-full bg-calm-border rounded-full h-2">
                          <div
                            className="bg-calm-teal rounded-full h-2 transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  Based on {filteredEntries.length} mood check-in{filteredEntries.length !== 1 ? 's' : ''} in the last {timeRange} days
                </p>
              </div>

              {/* Recent Entries Mini View */}
              {filteredEntries.length > 0 && (
                <div className="calm-card">
                  <h3 className="font-medium text-calm-text mb-4">Recent Entries</h3>
                  <div className="space-y-2">
                    {filteredEntries.slice(0, 5).map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-2 bg-calm-cream rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getMoodEmoji(entry.mood_id)}</span>
                          <div>
                            <p className="text-xs font-medium text-calm-text">
                              {getMoodLabel(entry.mood_id)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        {entry.text && (
                          <p className="text-xs text-gray-600 max-w-xs line-clamp-1">{entry.text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Navigation currentPage="timeline" />
    </div>
  );
}
