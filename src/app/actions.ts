"use server";

import { revalidatePath } from "next/cache";

import { VISIBLE_DAYS } from "@/lib/constants";
import { isEditableDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string };

/**
 * The client tells us which calendar day it is, because only the browser knows
 * the user's timezone. Two things widen the window we accept: timezones run
 * from UTC-12 to UTC+14, so the client's "today" can be a day either side of
 * ours, and the board deliberately lets people tick off a day they forgot.
 * VISIBLE_DAYS is shared with the board so the two cannot drift apart.
 */
function dateOutOfRange(date: string): string | null {
  const utcToday = new Date().toISOString().slice(0, 10);
  if (!isEditableDate(date, utcToday, VISIBLE_DAYS)) {
    return `You can only change the last ${VISIBLE_DAYS} days.`;
  }
  return null;
}

export async function addHabit(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();

  if (!name) return { error: "Give the habit a name." };
  if (name.length > 80) return { error: "Keep the name under 80 characters." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You are signed out. Sign in and try again." };

  const { error } = await supabase.from("habits").insert({ user_id: user.id, name });
  if (error) return { error: error.message };

  revalidatePath("/");
  return {};
}

export async function toggleCompletion(
  habitId: string,
  date: string,
  done: boolean,
): Promise<ActionResult> {
  const rangeError = dateOutOfRange(date);
  if (rangeError) return { error: rangeError };

  const supabase = await createClient();

  // RLS (and, for inserts, the habit-ownership check in the policy) is what
  // stops one user from writing to another's habit.
  const { error } = done
    ? await supabase
        .from("habit_completions")
        .upsert(
          { habit_id: habitId, completed_on: date },
          { onConflict: "habit_id,completed_on", ignoreDuplicates: true },
        )
    : await supabase
        .from("habit_completions")
        .delete()
        .eq("habit_id", habitId)
        .eq("completed_on", date);

  if (error) return { error: error.message };

  revalidatePath("/");
  return {};
}

export async function deleteHabit(formData: FormData): Promise<void> {
  const habitId = String(formData.get("habitId") ?? "");
  if (!habitId) return;

  const supabase = await createClient();
  await supabase.from("habits").delete().eq("id", habitId);

  revalidatePath("/");
}
