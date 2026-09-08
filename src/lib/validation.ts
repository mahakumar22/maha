/**
 * Pure input checks, deliberately free of any server or Supabase import so they
 * can be exercised directly by the tests.
 */

/**
 * A loose shape check on an email address, matching the constraint on
 * habit_reminders.email. The database is the real gate; this exists so the user
 * gets a sentence back instead of a constraint violation.
 */
export function isEmailish(value: string): boolean {
  return value.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}
