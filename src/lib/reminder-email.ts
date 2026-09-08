import type { EmailMessage } from "@/lib/email";

/** Escapes habit names, which are user-supplied, before they reach the HTML body. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** The nudge itself: what is still outstanding today, and nothing else. */
export function buildReminderEmail(pending: string[], appUrl: string): Omit<EmailMessage, "to"> {
  const count = pending.length;
  const subject =
    count === 1 ? "1 habit still to do today" : `${count} habits still to do today`;

  const text = [
    subject,
    "",
    ...pending.map((name) => `- ${name}`),
    "",
    `Tick them off: ${appUrl}`,
    "",
    "To stop these, open the app and use \"remind pannu\".",
  ].join("\n");

  const items = pending
    .map(
      (name) =>
        `<li style="margin:0 0 8px;font-size:15px;color:#17171b">${escapeHtml(name)}</li>`,
    )
    .join("");

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f7f7f8;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e8;border-radius:12px;padding:24px">
    <h1 style="margin:0 0 4px;font-size:18px;color:#17171b">${escapeHtml(subject)}</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#6c6c78">Keep the streak alive.</p>
    <ul style="margin:0 0 20px;padding-left:20px">${items}</ul>
    <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px">Open the tracker</a>
    <p style="margin:20px 0 0;font-size:12px;color:#6c6c78">To stop these, open the app and use &quot;remind pannu&quot;.</p>
  </div>
</body></html>`;

  return { subject, html, text };
}
