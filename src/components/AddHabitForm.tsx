"use client";

import { useActionState, useEffect, useRef } from "react";

import { addHabit, type ActionResult } from "@/app/actions";

export function AddHabitForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(addHabit, {});

  // Clear the field once the habit lands, ready for the next one.
  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [pending, state]);

  return (
    <div>
      <form ref={formRef} action={formAction} className="flex gap-2">
        <input
          name="name"
          required
          maxLength={80}
          placeholder="Add a habit — read 20 pages, stretch, no phone in bed…"
          aria-label="Habit name"
          className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none placeholder:text-muted/60"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </form>

      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-red-500">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
