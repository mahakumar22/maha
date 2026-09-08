# Habit Tracker

A small habit tracker built with Next.js (App Router) and Supabase. Sign up,
add the things you want to do daily, tick them off, and watch the streak build.

- **Email + password auth** via Supabase Auth, with sessions refreshed in
  middleware so server components always see a fresh user.
- **Habits and completions** stored in Postgres, every row tied to `user_id` and
  fenced off by row level security.
- **One tap to mark a day done**, with the last seven days visible so you can
  catch up on a day you forgot.
- **Current and longest streaks**, calculated in the user's own timezone.
- **"enna kizhicha"** — a breakdown of how often each habit has actually been done.
- **"remind pannu"** — an optional daily email listing whatever is still outstanding.

## Getting started

### 1. Create the Supabase project

Make a project at [supabase.com](https://supabase.com), then open the **SQL
Editor** and run [`supabase/schema.sql`](supabase/schema.sql). That creates both
tables, their indexes, the ownership trigger, and every RLS policy.

If you use the Supabase CLI instead:

```bash
supabase db execute --file supabase/schema.sql
```

### 2. Point the app at it

```bash
cp .env.example .env.local
```

Fill in the two values from **Project Settings → API**:

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` / `public` key |

Both are safe to expose to the browser — RLS is what protects the data, not the
key. There is no service-role key anywhere in this app.

### 3. Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>, create an account, and add a habit.

> **Email confirmation.** New projects have it on by default, so signup asks you
> to click a link before you can sign in. For local development you can switch
> it off under **Authentication → Providers → Email**. If you leave it on, add
> `http://localhost:3000/auth/callback` to the allowed redirect URLs under
> **Authentication → URL Configuration**.

## Daily email reminders (optional)

The **remind pannu** button stores an address and an on/off switch per user. A
scheduled job then mails each person the habits they have not ticked off yet.
None of this is required: with the keys below unset the app runs normally, the
panel still saves settings, and it simply says sending is not switched on.

Sending needs four things.

**1. A Resend account.** Sign up at [resend.com](https://resend.com) and create an
API key. On the free tier the shared sender `onboarding@resend.dev` only delivers
to your own Resend account address — fine for testing. To mail anyone else, verify
a domain in Resend and set `REMINDER_FROM_EMAIL` to an address on it.

**2. A Supabase service role key.** Supabase dashboard → **Project Settings → API
Keys → `service_role`**. The job mails every user, so it has to read rows that are
not its own, which means bypassing row level security.

> This key bypasses every security policy in the database. Never prefix it with
> `NEXT_PUBLIC_`, never commit it, and never use it anywhere in `src/components`.
> It belongs only in the deployment's environment variables, where it is read by
> `src/app/api/reminders/send/route.ts` and nothing else.

**3. A cron secret.** Any long random string. Vercel sends it as
`Authorization: Bearer <CRON_SECRET>` when it triggers the job. The endpoint
**refuses to run if `CRON_SECRET` is unset**, so a misconfigured deployment fails
closed rather than exposing a public send button.

**4. The variables set where the app runs** — locally in `.env.local`, and in
Vercel under Settings → Environment Variables:

| Variable | Secret? | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | yes | Sends the mail |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Reads every due reminder |
| `CRON_SECRET` | yes | Authenticates the scheduled call |
| `REMINDER_FROM_EMAIL` | no | Sender address |
| `NEXT_PUBLIC_APP_URL` | no | Link inside the email |

`vercel.json` schedules the job daily at 08:00 UTC. Change the `schedule` field
to move it — it is standard cron, evaluated in UTC. Running more often than once
a day requires a paid Vercel plan.

To test it by hand once deployed:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-app.vercel.app/api/reminders/send
```

It replies with a JSON summary of how many were due, sent and skipped. A user
who has already finished everything is skipped rather than nagged.

## Supabase MCP server (optional)

`.mcp.json` registers Supabase's hosted MCP server, which lets an AI coding tool
inspect the project's schema, logs and docs directly. It holds no secrets — just
the project ref and the enabled feature set — and each person authenticates as
themselves:

```bash
claude          # approve the server when prompted
claude /mcp     # select "supabase", then Authenticate
```

Run that in a real terminal rather than an IDE extension, since it opens a
browser for OAuth. Optional Supabase agent skills: `npx skills add supabase/agent-skills`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm test` | Streak and date-handling tests |
| `./supabase/tests/run.sh` | Row level security tests (needs a local Postgres) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## How it fits together

```
src/
  app/
    page.tsx              Dashboard (server component, force-dynamic)
    actions.ts            Server actions: add habit, toggle a day, delete
    auth/actions.ts       Server actions: sign in, sign up, sign out
    reminders/actions.ts  Server actions: save, pause, delete a reminder
    api/reminders/send/   The scheduled mailer (service role; not user-facing)
    auth/callback/        Landing route for Supabase email links
    login/, signup/
  components/             Client components (forms, habit board, habit card)
  lib/
    dates.ts              Calendar-day arithmetic
    streak.ts             Streak calculation
    validation.ts         Pure input checks
    email.ts              Resend transport
    reminder-email.ts     Reminder message body
    habits.ts             Dashboard queries
    supabase/             Server client, middleware session refresh, env
  middleware.ts           Refreshes the session, guards private routes
supabase/schema.sql       Tables, indexes, trigger, RLS policies
vercel.json               Cron schedule for the daily reminder
```

Every mutation goes through a server action, so the browser never writes to the
database directly and the anon key is only ever used with a signed-in session.

### Timezones

A habit is done on a *calendar day*, and only the browser knows which day that
is. Dates travel as `YYYY-MM-DD` strings in the user's local timezone; date
arithmetic happens at UTC noon so a daylight-saving jump can never shift a day.
Server actions accept a client-supplied date only within one day of the server's
UTC date, which covers the real range of timezones (UTC-12 to UTC+14) without
letting someone backfill arbitrary history.

The dashboard first renders with the server's UTC date so the markup matches on
hydration, then switches to the real local date immediately after — and re-checks
every minute, so a board left open overnight rolls over on its own.

### Streaks

A streak counts back from today over unbroken days. It *survives an unfinished
today*: if you did the habit yesterday but haven't yet today, the streak still
stands, and it is only lost once another whole day passes. The card also shows
your longest run and total days.

## Data model

**`habits`** — `id`, `user_id`, `name`, `created_at`, `archived_at`

**`habit_completions`** — `id`, `habit_id`, `user_id`, `completed_on`, `created_at`

**`habit_reminders`** — `id`, `user_id` (unique), `email`, `enabled`,
`last_sent_on`, `created_at`, `updated_at`. One reminder per user, so saving is an
upsert; `last_sent_on` makes the send idempotent, and a cron that fires twice in a
day still mails once.

`unique (habit_id, completed_on)` makes marking a day done idempotent, so a
double tap can never inflate a streak. `user_id` is denormalised onto
completions so RLS filters without a join; a `before insert or update` trigger
overwrites it with the habit's real owner, so a forged `user_id` from a client
cannot stick. Deleting a habit cascades to its completions, and deleting a user
cascades to everything.

RLS is enabled on both tables with select/insert/update/delete policies keyed on
`auth.uid() = user_id`. Inserting a completion additionally requires that the
target habit belongs to the caller. The script also grants table access to
`authenticated` explicitly — a stock Supabase project already does this through
its default privileges, but without it a signed-in user hits `permission denied
for table habits` before RLS ever gets a say.

### Verifying the policies

`supabase/tests/` applies `schema.sql` to a throwaway database and checks the
policies hold, by having one user try to read, rename, delete and write to
another's habits. It runs against any local Postgres:

```bash
./supabase/tests/run.sh
# or point it somewhere:
PGHOST=/tmp PGPORT=5432 PGUSER=postgres ./supabase/tests/run.sh
```

`setup.sql` stubs the pieces of Supabase the schema leans on (the `auth` schema,
`auth.uid()`, and the `anon`/`authenticated`/`service_role` roles) so no Supabase
project is needed. It also confirms `schema.sql` is safe to apply twice.

## Deploying

Works on any Next.js host. Set the same two environment variables in the host's
settings, and add `https://your-domain/auth/callback` to the Supabase redirect
allow-list.
