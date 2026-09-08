"use client";

import { useEffect, useState } from "react";

import { AddHabitForm } from "@/components/AddHabitForm";
import { HabitCard } from "@/components/HabitCard";
import { formatLongDate, toISODate } from "@/lib/dates";
import type { HabitWithHistory } from "@/lib/habits";

/**
 * `serverToday` is the server's UTC date, used for the first paint so that
 * server and client markup agree. The real local date is picked up straight
 * after hydration — for most users the two are the same anyway.
 */
export function HabitBoard({
  habits,
  serverToday,
}: {
  habits: HabitWithHistory[];
  serverToday: string;
}) {
  const [today, setToday] = useState(serverToday);

  useEffect(() => {
    setToday(toISODate());

    // Roll the board over if the app is left open across midnight.
    const timer = setInterval(() => setToday(toISODate()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const doneToday = habits.filter((habit) => habit.completedDates.includes(today)).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{formatLongDate(today)}</h1>
        <p className="text-sm text-muted">
          {habits.length === 0
            ? "Add your first habit below."
            : doneToday === habits.length
              ? `All ${habits.length} done today. Nice.`
              : `${doneToday} of ${habits.length} done today.`}
        </p>
      </div>

      <AddHabitForm />

      {habits.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
          Nothing tracked yet. Start with one small thing you can do every day.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {habits.map((habit) => (
            <HabitCard key={habit.id} habit={habit} today={today} />
          ))}
        </ul>
      )}
    </div>
  );
}
