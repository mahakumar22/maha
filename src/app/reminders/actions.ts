"use server";

import { revalidatePath } from "next/cache";

import { isEmailish } from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";

export type ReminderResult = { error?: string; message?: string };

/**
 * Creates or updates the daily nudge. One row per user, so this is an upsert
 * keyed on user_id; RLS keeps it to the caller's own row either way.
 */
export async function saveReminder(
  _prev: ReminderResult,
  formData: FormData,
): Promise<ReminderResult> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) return { error: "Enter the email address to send reminders to." };
  if (!isEmailish(email)) return { error: "That does not look like an email address." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You are signed out. Sign in and try again." };

  const { error } = await supabase.from("habit_reminders").upsert(
    { user_id: user.id, email, enabled: true, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );

  if (error) return { error: error.message };

  revalidatePath("/");
  return { message: `Daily reminders will go to ${email}.` };
}

/** Pauses or resumes the nudge without throwing the address away. */
export async function setReminderEnabled(enabled: boolean): Promise<ReminderResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You are signed out. Sign in and try again." };

  const { error } = await supabase
    .from("habit_reminders")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/");
  return {};
}

export async function deleteReminder(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.from("habit_reminders").delete().eq("user_id", user.id);
  revalidatePath("/");
}
