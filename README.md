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

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm test` | Streak and date-handling tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## How it fits together

```
src/
  app/
    page.tsx              Dashboard (server component, force-dynamic)
    actions.ts            Server actions: add habit, toggle a day, delete
    auth/actions.ts       Server actions: sign in, sign up, sign out
    auth/callback/        Landing route for Supabase email links
    login/, signup/
  components/             Client components (forms, habit board, habit card)
  lib/
    dates.ts              Calendar-day arithmetic
    streak.ts             Streak calculation
    habits.ts             Dashboard queries
    supabase/             Server client, middleware session refresh, env
  middleware.ts           Refreshes the session, guards private routes
supabase/schema.sql       Tables, indexes, trigger, RLS policies
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

`unique (habit_id, completed_on)` makes marking a day done idempotent, so a
double tap can never inflate a streak. `user_id` is denormalised onto
completions so RLS filters without a join; a `before insert or update` trigger
overwrites it with the habit's real owner, so a forged `user_id` from a client
cannot stick. Deleting a habit cascades to its completions, and deleting a user
cascades to everything.

RLS is enabled on both tables with select/insert/update/delete policies keyed on
`auth.uid() = user_id`. Inserting a completion additionally requires that the
target habit belongs to the caller.

## Deploying

Works on any Next.js host. Set the same two environment variables in the host's
settings, and add `https://your-domain/auth/callback` to the Supabase redirect
allow-list.
