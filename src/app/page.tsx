import { redirect } from "next/navigation";

import { signOut } from "@/app/auth/actions";
import { HabitBoard } from "@/components/HabitBoard";
import { getHabitsWithHistory } from "@/lib/habits";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

// Per-user, session-dependent, and never worth caching.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!hasSupabaseEnv()) return <SetupNotice />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const habits = await getHabitsWithHistory();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight">Habit Tracker</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:border-accent"
          >
            Sign out
          </button>
        </form>
      </header>

      <HabitBoard habits={habits} serverToday={new Date().toISOString().slice(0, 10)} />
    </main>
  );
}

function SetupNotice() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <h1 className="text-xl font-semibold">Finish the Supabase setup</h1>
      <p className="mt-3 text-sm text-muted">
        Copy <code className="text-foreground">.env.example</code> to{" "}
        <code className="text-foreground">.env.local</code>, fill in your project URL and anon
        key, run <code className="text-foreground">supabase/schema.sql</code> in the SQL editor,
        then restart the dev server. The README has the full walkthrough.
      </p>
    </main>
  );
}
