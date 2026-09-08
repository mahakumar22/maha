import { createClient } from "@/lib/supabase/server";

export type Reminder = {
  id: string;
  email: string;
  enabled: boolean;
  last_sent_on: string | null;
};

/** The signed-in user's reminder, or null if they have not set one up. */
export async function getReminder(): Promise<Reminder | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("habit_reminders")
    .select("id, email, enabled, last_sent_on")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}
