"use client";

import { useOptimistic, useState, useTransition } from "react";

import { deleteHabit, toggleCompletion } from "@/app/actions";
import { VISIBLE_DAYS } from "@/lib/constants";
import { formatDayOfMonth, formatWeekday, recentDays } from "@/lib/dates";
import { computeStreaks } from "@/lib/streak";
import type { HabitWithHistory } from "@/lib/habits";

type Change = { date: string; done: boolean };

export function HabitCard({ habit, today }: { habit: HabitWithHistory; today: string }) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // The checkbox flips immediately; the server action catches up behind it.
  const [completedDates, applyChange] = useOptimistic(
    habit.completedDates,
    (dates: string[], change: Change) => {
      const next = new Set(dates);
      if (change.done) next.add(change.date);
      else next.delete(change.date);
      return [...next].sort();
    },
  );

  const done = new Set(completedDates);
  const streaks = computeStreaks(completedDates, today);
  const doneToday = done.has(today);

  function toggle(date: string, next: boolean) {
    startTransition(async () => {
      applyChange({ date, done: next });
      const result = await toggleCompletion(habit.id, date, next);
      setError(result.error ?? null);
    });
  }

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <button
          type="button"
          onClick={() => toggle(today, !doneToday)}
          aria-pressed={doneToday}
          aria-label={`Mark "${habit.name}" as done today`}
          className={`grid size-9 shrink-0 place-items-center rounded-full border-2 transition-colors ${
            doneToday
              ? "border-accent bg-accent text-white"
              : "border-border text-transparent hover:border-accent"
          }`}
        >
          <CheckIcon />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{habit.name}</p>
          <p className="text-sm text-muted">
            {streaks.current > 0 ? (
              <span className="text-accent">
                🔥 {streaks.current} day{streaks.current === 1 ? "" : "s"} in a row
              </span>
            ) : (
              <span>No streak yet — today is a good day to start.</span>
            )}
            {streaks.longest > 0 ? <> · best {streaks.longest} · {streaks.total} total</> : null}
          </p>
        </div>

        <div className="flex items-end gap-1.5">
          {recentDays(today, VISIBLE_DAYS).map((date) => {
            const isToday = date === today;
            const isDone = done.has(date);
            return (
              <button
                key={date}
                type="button"
                onClick={() => toggle(date, !isDone)}
                aria-pressed={isDone}
                aria-label={`${formatWeekday(date)} ${formatDayOfMonth(date)}${
                  isDone ? ", done" : ", not done"
                }`}
                className="group flex w-8 flex-col items-center gap-1"
              >
                <span className="text-[10px] uppercase tracking-wide text-muted">
                  {formatWeekday(date).slice(0, 2)}
                </span>
                <span
                  className={`grid size-8 place-items-center rounded-lg border text-xs transition-colors ${
                    isDone
                      ? "border-accent bg-accent text-white"
                      : "border-border bg-background text-muted group-hover:border-accent"
                  } ${isToday ? "ring-2 ring-accent/40" : ""}`}
                >
                  {formatDayOfMonth(date)}
                </span>
              </button>
            );
          })}
        </div>

        <form
          action={deleteHabit}
          onSubmit={(event) => {
            if (!window.confirm(`Delete "${habit.name}" and its history?`)) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="habitId" value={habit.id} />
          <button
            type="submit"
            aria-label={`Delete "${habit.name}"`}
            className="rounded-lg px-2 py-1 text-sm text-muted transition-colors hover:text-red-500"
          >
            ✕
          </button>
        </form>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-500">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-5" aria-hidden="true">
      <path
        d="M5 10.5l3.5 3.5L15 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
