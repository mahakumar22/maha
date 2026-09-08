/**
 * Email goes out through Resend's REST API. Called over plain fetch rather than
 * their SDK to keep this to one dependency-free file -- swapping providers means
 * rewriting only sendEmail().
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Reminders are an optional extra: with no API key the app still runs and still
 * stores people's settings, it just cannot post the mail. Callers check this so
 * a missing key reads as a clear message instead of a runtime failure.
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendEmail(message: EmailMessage): Promise<{ error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { error: "RESEND_API_KEY is not set." };

  const from = process.env.REMINDER_FROM_EMAIL ?? "Habit Tracker <onboarding@resend.dev>";

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) {
      return { error: `Resend returned ${response.status}: ${await response.text()}` };
    }

    return {};
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : "Could not reach Resend." };
  }
}
