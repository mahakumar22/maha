"use client";

import { useActionState, useState, useTransition } from "react";

import {
  deleteReminder,
  saveReminder,
  setReminderEnabled,
  type ReminderResult,
} from "@/app/reminders/actions";
import type { Reminder } from "@/lib/reminders";

export function ReminderPanel({
  reminder,
  accountEmail,
  emailConfigured,
}: {
  reminder: Reminder | null;
  accountEmail: string;
  emailConfigured: boolean;
}) {
  const [state, formAction, saving] = useActionState<ReminderResult, FormData>(saveReminder, {});
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(enabled: boolean) {
    startTransition(async () => {
      const result = await setReminderEnabled(enabled);
      setToggleError(result.error ?? null);
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h3 className="text-sm font-medium">Daily email reminder</h3>
        <p className="mt-0.5 text-xs text-muted">
          One email a day listing whatever you have not ticked off yet. Nothing is sent on a
          day you finish everything.
        </p>
      </div>

      {!emailConfigured ? (
        <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted">
          Sending is not switched on for this deployment yet, so reminders you save here will
          not go out. The README covers the one key that turns it on.
        </p>
      ) : null}

      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs text-muted">Send to</span>
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            defaultValue={reminder?.email ?? accountEmail}
            placeholder="you@example.com"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted/60"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Saving…" : reminder ? "Update" : "Turn on"}
        </button>
      </form>

      {state.error ? (
        <p role="alert" className="text-sm text-red-500">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="text-sm text-emerald-500">
          {state.message}
        </p>
      ) : null}

      {reminder ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <p className="text-xs text-muted">
            {reminder.enabled ? "Reminders are on" : "Reminders are paused"}
            {reminder.last_sent_on ? ` · last sent ${reminder.last_sent_on}` : " · none sent yet"}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggle(!reminder.enabled)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:border-accent"
            >
              {reminder.enabled ? "Pause" : "Resume"}
            </button>

            <form
              action={deleteReminder}
              onSubmit={(event) => {
                if (!window.confirm("Delete this reminder?")) event.preventDefault();
              }}
            >
              <button
                type="submit"
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-red-500 hover:text-red-500"
              >
                Delete
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {toggleError ? (
        <p role="alert" className="text-sm text-red-500">
          {toggleError}
        </p>
      ) : null}
    </section>
  );
}
