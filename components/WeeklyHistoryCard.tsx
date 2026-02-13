'use client';

import { useState } from 'react';
import { WeeklySummary } from '@/lib/weeklySummary';
import { MENTAL_LOAD_DOMAINS, LoadEntry, WeeklyCheckinResponse } from '@/lib/types';

interface WeeklyHistoryCardProps {
  summary: WeeklySummary;
}

function getDomainLabel(domainId: string): string {
  const domain = MENTAL_LOAD_DOMAINS.find((d) => d.id === domainId);
  return domain?.label || domainId;
}

function getDomainEmoji(domainId: string): string {
  const domain = MENTAL_LOAD_DOMAINS.find((d) => d.id === domainId);
  return domain?.emoji || '📌';
}

function getIntensityColor(intensity: 'Light' | 'Moderate' | 'Heavy'): string {
  switch (intensity) {
    case 'Light':
      return 'bg-green-50 border-green-200 text-green-700';
    case 'Moderate':
      return 'bg-amber-50 border-amber-200 text-amber-700';
    case 'Heavy':
      return 'bg-red-50 border-red-200 text-red-700';
  }
}

export default function WeeklyHistoryCard({ summary }: WeeklyHistoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const totalEntries = summary.checkIns.length + summary.adHocEntries.length;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-4 hover:shadow-md transition-shadow">
      {/* Week Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left flex items-start justify-between gap-4 group"
      >
        <div className="flex-1">
          <div className="flex items-baseline gap-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">
              Week {summary.weekNumber}
            </h3>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${getIntensityColor(summary.overallIntensity)}`}>
              {summary.overallIntensity}
            </span>
          </div>

          {/* Domains */}
          {summary.dominantDomains.length > 0 && (
            <div className="flex gap-2 mb-3">
              {summary.dominantDomains.map((domainId) => (
                <span key={domainId} className="text-sm flex items-center gap-1 text-gray-600">
                  {getDomainEmoji(domainId)}
                  {getDomainLabel(domainId)}
                </span>
              ))}
            </div>
          )}

          {/* Reflection */}
          <p className="text-sm text-gray-700 leading-relaxed mb-3">
            {summary.reflection}
          </p>

          {/* Optional Prompt */}
          {summary.optionalPrompt && (
            <p className="text-sm italic text-gray-600 mb-3">
              {summary.optionalPrompt}
            </p>
          )}

          {/* Entry Count */}
          <p className="text-xs text-gray-500">
            {totalEntries} {totalEntries === 1 ? 'entry' : 'entries'} logged
          </p>
        </div>

        {/* Expand/Collapse Icon */}
        <div className={`text-gray-400 group-hover:text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </button>

      {/* Expandable Entries List */}
      {isExpanded && (
        <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
          {/* Weekly Check-In (if exists) */}
          {summary.checkIn && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-1 rounded">
                  Weekly Check-In
                </span>
                <span className="text-xs text-blue-600">
                  {new Date(summary.checkIn.completed_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-gray-800">{summary.checkIn.response_text}</p>
            </div>
          )}

          {summary.checkIns.length > 1 && (
            <details className="bg-white border border-gray-200 rounded-lg p-4">
              <summary className="text-sm font-semibold text-gray-700 cursor-pointer">
                View all weekly check-ins ({summary.checkIns.length})
              </summary>
              <div className="mt-3 space-y-3">
                {summary.checkIns.map((checkIn) => (
                  <div key={checkIn.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-1 rounded">
                        Weekly Check-In
                      </span>
                      <span className="text-xs text-gray-600">
                        {new Date(checkIn.completed_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800">{checkIn.response_text}</p>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Ad-Hoc Load Entries */}
          {summary.adHocEntries.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-600 uppercase mb-3">
                Individual Entries ({summary.adHocEntries.length})
              </h4>
              <div className="space-y-3">
                {summary.adHocEntries.map((entry) => (
                  <div key={entry.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex gap-2">
                        <span className={`text-xs font-semibold px-2 py-1 rounded ${getIntensityColor(entry.intensity_label)}`}>
                          {entry.intensity_label}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800">{entry.reflection_text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!summary.checkIn && summary.adHocEntries.length === 0 && (
            <p className="text-sm text-gray-500 italic">No entries recorded this week.</p>
          )}
        </div>
      )}
    </div>
  );
}
