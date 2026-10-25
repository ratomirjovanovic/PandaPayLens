import "server-only";
import type { AdminConfig } from "./config";

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Sends the sign-in link through the Resend HTTP API. */
export async function sendMagicLinkEmail(cfg: AdminConfig, to: string, url: string): Promise<void> {
  const link = escapeHtml(url);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: cfg.emailFrom,
      to: [to],
      subject: "Your PandaPayLens admin sign-in link",
      text: `Sign in to PandaPayLens admin:\n\n${url}\n\nThe link expires in 10 minutes and can be used once. If you did not request it, ignore this email.`,
      html: `<p>Sign in to PandaPayLens admin:</p><p><a href="${link}">Sign in</a></p><p>The link expires in 10 minutes and can be used once. If you did not request it, ignore this email.</p>`,
    }),
  });
  if (!res.ok) {
    // Never log the link or the address.
    throw new Error(`Email delivery failed with status ${res.status}.`);
  }
}
