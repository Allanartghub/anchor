export type SemesterStartOption =
  | 'Early January'
  | 'Late January'
  | 'Early September'
  | 'Late September'
  | 'Other / Not sure';

// Approximate start dates for semester start options
const SEMESTER_START_DATES: Record<SemesterStartOption, { month: number; day: number }> = {
  'Early January': { month: 0, day: 5 },
  'Late January': { month: 0, day: 25 },
  'Early September': { month: 8, day: 5 },
  'Late September': { month: 8, day: 25 },
  'Other / Not sure': { month: 0, day: 5 },
};

export function calculateWeeksSinceSemesterStart(
  semesterStart: SemesterStartOption,
  today: Date = new Date()
): { weekNumber: number; semesterYear: number } {
  const start = SEMESTER_START_DATES[semesterStart] || SEMESTER_START_DATES['Other / Not sure'];

  // Assume current year for January starts, and current/previous year for September depending on month
  let year = today.getFullYear();
  if (start.month === 8 && today.getMonth() < 8) {
    year = year - 1;
  }

  const startDate = new Date(year, start.month, start.day);
  const diffMs = today.getTime() - startDate.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const weekNumber = Math.max(1, Math.floor(diffDays / 7) + 1);

  return { weekNumber, semesterYear: startDate.getFullYear() };
}

export function getWeekBucket(weekNumber: number): string {
  if (weekNumber <= 4) return 'Weeks 1-4';
  if (weekNumber <= 8) return 'Weeks 5-8';
  if (weekNumber <= 12) return 'Weeks 9-12';
  if (weekNumber <= 16) return 'Weeks 13-16';
  return 'Weeks 17+';
}
