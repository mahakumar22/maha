"use client";

import { useEffect, useState } from "react";

import { AddHabitForm } from "@/components/AddHabitForm";
import { HabitCard } from "@/components/HabitCard";
import { ReminderPanel } from "@/components/ReminderPanel";
import { StatsPanel } from "@/components/StatsPanel";
import { formatLongDate, toISODate } from "@/lib/dates";
import type { HabitWithHistory } from "@/lib/habits";
import type { Reminder } from "@/lib/reminders";

type Panel = "stats" | "reminder" | null;

/**
 * `serverToday` is the server's UTC date, used for the first paint so that
 * server and client markup agree. The real local date is picked up straight
 * after hydration — for most users the two are the same anyway.
 */
export function HabitBoard({
  habits,
  serverToday,
  reminder,
  accountEmail,
  emailConfigured,
}: {
  habits: HabitWithHistory[];
  serverToday: string;
  reminder: Reminder | null;
  accountEmail: string;
  emailConfigured: boolean;
}) {
  const [today, setToday] = useState(serverToday);
  const [openPanel, setOpenPanel] = useState<Panel>(null);

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

      <div className="flex flex-wrap gap-2">
        <PanelButton
          active={openPanel === "stats"}
          onClick={() => setOpenPanel(openPanel === "stats" ? null : "stats")}
        >
          enna kizhicha
        </PanelButton>
        <PanelButton
          active={openPanel === "reminder"}
          onClick={() => setOpenPanel(openPanel === "reminder" ? null : "reminder")}
        >
          remind pannu
        </PanelButton>
      </div>

      {openPanel === "stats" ? <StatsPanel habits={habits} today={today} /> : null}
      {openPanel === "reminder" ? (
        <ReminderPanel
          reminder={reminder}
          accountEmail={accountEmail}
          emailConfigured={emailConfigured}
        />
      ) : null}

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

function PanelButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-accent bg-accent text-white"
          : "border-border hover:border-accent"
      }`}
    >
      {children}
    </button>
  );
}
