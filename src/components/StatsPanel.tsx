"use client";

import { computeStreaks } from "@/lib/streak";
import type { HabitWithHistory } from "@/lib/habits";

/**
 * How often each habit has actually been done. One measure across one set of
 * categories, so it is a plain bar chart in a single hue -- length carries the
 * magnitude and the label carries the identity, which leaves nothing riding on
 * colour alone. Bars are sorted longest first so the ranking is the shape.
 */
export function StatsPanel({ habits, today }: { habits: HabitWithHistory[]; today: string }) {
  const rows = habits
    .map((habit) => ({
      id: habit.id,
      name: habit.name,
      days: habit.completedDates.length,
      streaks: computeStreaks(habit.completedDates, today),
    }))
    .sort((a, b) => b.days - a.days || a.name.localeCompare(b.name));

  const totalDays = rows.reduce((sum, row) => sum + row.days, 0);
  const busiest = Math.max(1, ...rows.map((row) => row.days));
  const bestStreak = Math.max(0, ...rows.map((row) => row.streaks.longest));
  const liveStreaks = rows.filter((row) => row.streaks.current > 0).length;

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
        Add a habit first — there is nothing to count yet.
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-6 rounded-xl border border-border bg-card p-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Days ticked off" value={totalDays} />
        <Stat label="Habits tracked" value={rows.length} />
        <Stat label="Streaks running" value={liveStreaks} />
        <Stat label="Best streak ever" value={bestStreak} />
      </div>

      <div>
        <h3 className="text-sm font-medium">Days completed, per habit</h3>
        <p className="mt-0.5 text-xs text-muted">All time, most-done first.</p>

        {totalDays === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Nothing ticked off yet. Mark a habit done and it will show up here.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="grid grid-cols-[minmax(5rem,8rem)_1fr_2.5rem] items-center gap-3"
                title={`${row.name}: ${row.days} day${row.days === 1 ? "" : "s"}`}
              >
                <span className="truncate text-sm text-muted">{row.name}</span>

                <span className="flex h-5 items-center border-l border-chart-axis pl-px">
                  <span
                    className="h-full rounded-r-[4px] bg-chart-bar"
                    style={{ width: `${(row.days / busiest) * 100}%` }}
                  />
                </span>

                <span className="text-right text-sm tabular-nums">{row.days}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
