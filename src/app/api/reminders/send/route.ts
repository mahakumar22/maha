import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { emailConfigured, sendEmail } from "@/lib/email";
import { buildReminderEmail } from "@/lib/reminder-email";

export const dynamic = "force-dynamic";

/** A single run will not mail more than this, so a bad day cannot fan out. */
const MAX_PER_RUN = 200;

/**
 * The nightly mailer, triggered by Vercel Cron (see vercel.json).
 *
 * It reads every user's due reminder, so it runs with the service role key and
 * bypasses row level security. That makes two things load-bearing: the endpoint
 * refuses to run without CRON_SECRET (so it fails closed rather than becoming a
 * public send button), and every query below is explicitly scoped by user_id,
 * because RLS is no longer doing that for us.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set; refusing to run." },
      { status: 500 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set." },
      { status: 500 },
    );
  }
  if (!emailConfigured()) {
    return NextResponse.json({ error: "RESEND_API_KEY is not set." }, { status: 500 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const today = new Date().toISOString().slice(0, 10);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;

  const { data: due, error: dueError } = await admin
    .from("habit_reminders")
    .select("id, user_id, email")
    .eq("enabled", true)
    .or(`last_sent_on.is.null,last_sent_on.lt.${today}`)
    .limit(MAX_PER_RUN);

  if (dueError) {
    return NextResponse.json({ error: dueError.message }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const reminder of due ?? []) {
    const [{ data: habits }, { data: completions }] = await Promise.all([
      admin
        .from("habits")
        .select("id, name")
        .eq("user_id", reminder.user_id)
        .is("archived_at", null),
      admin
        .from("habit_completions")
        .select("habit_id")
        .eq("user_id", reminder.user_id)
        .eq("completed_on", today),
    ]);

    const doneToday = new Set((completions ?? []).map((row) => row.habit_id));
    const pending = (habits ?? []).filter((habit) => !doneToday.has(habit.id));

    // Nothing to nag about: no habits yet, or all of them already ticked off.
    // Leave last_sent_on alone so it still reflects the last real send.
    if (pending.length === 0) {
      skipped += 1;
      continue;
    }

    const message = buildReminderEmail(
      pending.map((habit) => habit.name),
      appUrl,
    );
    const { error: sendError } = await sendEmail({ to: reminder.email, ...message });

    if (sendError) {
      failures.push(`${reminder.id}: ${sendError}`);
      continue;
    }

    const { error: markError } = await admin
      .from("habit_reminders")
      .update({ last_sent_on: today })
      .eq("id", reminder.id);

    if (markError) failures.push(`${reminder.id}: sent but not marked (${markError.message})`);
    sent += 1;
  }

  return NextResponse.json({ date: today, due: due?.length ?? 0, sent, skipped, failures });
}
