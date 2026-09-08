import { addDays, daysBetween } from "./dates";

export type Streaks = {
  /** Days completed in an unbroken run up to today. */
  current: number;
  /** The longest unbroken run ever recorded. */
  longest: number;
  /** Total days the habit has been completed. */
  total: number;
};

/**
 * A streak survives an unfinished today: it only breaks once a *whole* day has
 * gone by without a completion. So on Wednesday morning, a habit last done on
 * Tuesday still shows its streak, and it is only lost when Thursday arrives.
 */
export function computeStreaks(completedDates: Iterable<string>, today: string): Streaks {
  const done = new Set(completedDates);
  if (done.size === 0) return { current: 0, longest: 0, total: 0 };

  let cursor: string | null = null;
  if (done.has(today)) cursor = today;
  else if (done.has(addDays(today, -1))) cursor = addDays(today, -1);

  let current = 0;
  while (cursor && done.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  // Longest run, found by walking the sorted dates and watching for gaps.
  const sorted = [...done].sort();
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of sorted) {
    run = previous !== null && daysBetween(previous, day) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
    previous = day;
  }

  return { current, longest, total: done.size };
}
