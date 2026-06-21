import { env } from "@directory/config";
import { db, eq, tables } from "@directory/db";

/**
 * Provider-agnostic transactional email. We talk to the Resend HTTP API with the
 * global `fetch` (no SDK dependency). Email is OPTIONAL: with no credentials we
 * degrade gracefully — every caller gets `{ sent: false, reason }` and nothing
 * throws, so a missing/failed email never aborts the work that triggered it.
 */

export type SendResult = { sent: boolean; reason?: string };

export async function sendEmail(msg: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendResult> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    const reason = "email not configured (set RESEND_API_KEY + EMAIL_FROM)";
    console.warn(reason);
    return { sent: false, reason };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const reason = `resend ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`;
      return { sent: false, reason };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Compose + send the facilitator claim invite — a warm, single-use link that
 * lets a graduate claim their pre-seeded profile.
 */
export async function sendClaimInvite(opts: {
  to: string;
  schoolName: string;
  claimUrl: string;
}): Promise<SendResult> {
  const { to, schoolName, claimUrl } = opts;
  const subject = `Claim your ${schoolName} profile`;
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;max-width:480px;margin:0 auto">
    <p>Hi,</p>
    <p>Your profile on the <strong>${schoolName}</strong> directory is ready. Claim it to add your story, modalities, and start accepting clients.</p>
    <p style="margin:24px 0">
      <a href="${claimUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Claim your profile</a>
    </p>
    <p style="font-size:13px;color:#666">Or paste this link into your browser:<br><a href="${claimUrl}">${claimUrl}</a></p>
    <p style="font-size:13px;color:#666">This link is single-use and expires in 14 days.</p>
  </div>`;
  const text = `Claim your ${schoolName} profile.\n\nYour profile is ready — claim it here (single-use, expires in 14 days):\n${claimUrl}`;
  return sendEmail({ to, subject, html, text });
}

/** Resolve a school's display name from its organization id (for email copy). */
export async function schoolNameForOrg(organizationId: string): Promise<string> {
  const [org] = await db
    .select({ name: tables.organization.name })
    .from(tables.organization)
    .where(eq(tables.organization.id, organizationId))
    .limit(1);
  return org?.name ?? "your school";
}
