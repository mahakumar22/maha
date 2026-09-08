"use server";

import { revalidatePath } from "next/cache";

import { daysBetween, isISODate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string };

/**
 * The client tells us which calendar day it is, because only the browser knows
 * the user's timezone. Timezones run from UTC-12 to UTC+14, so a legitimate
 * client date is never more than one day away from the server's UTC date.
 */
function assertPlausibleDate(date: unknown): asserts date is string {
  if (!isISODate(date)) throw new Error("Invalid date.");

  const utcToday = new Date().toISOString().slice(0, 10);
  if (Math.abs(daysBetween(utcToday, date)) > 1) throw new Error("Invalid date.");
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
  assertPlausibleDate(date);

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
