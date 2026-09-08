import { createClient } from "@/lib/supabase/server";

export type Habit = {
  id: string;
  name: string;
  created_at: string;
};

export type HabitWithHistory = Habit & {
  /** Every `YYYY-MM-DD` this habit has been completed on, oldest first. */
  completedDates: string[];
};

/**
 * Loads the signed-in user's active habits together with their full completion
 * history, which is what the longest-streak figure needs. Row level security
 * scopes both queries to the caller, so no user_id filter is required here.
 */
export async function getHabitsWithHistory(): Promise<HabitWithHistory[]> {
  const supabase = await createClient();

  const [{ data: habits, error: habitsError }, { data: completions, error: completionsError }] =
    await Promise.all([
      supabase
        .from("habits")
        .select("id, name, created_at")
        .is("archived_at", null)
        .order("created_at", { ascending: true }),
      supabase
        .from("habit_completions")
        .select("habit_id, completed_on")
        .order("completed_on", { ascending: true }),
    ]);

  if (habitsError) throw new Error(habitsError.message);
  if (completionsError) throw new Error(completionsError.message);

  const byHabit = new Map<string, string[]>();
  for (const { habit_id, completed_on } of completions ?? []) {
    const dates = byHabit.get(habit_id);
    if (dates) dates.push(completed_on);
    else byHabit.set(habit_id, [completed_on]);
  }

  return (habits ?? []).map((habit) => ({
    ...habit,
    completedDates: byHabit.get(habit.id) ?? [],
  }));
}
