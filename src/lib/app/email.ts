/** Product emails go through Resend's HTTP API. Without RESEND_API_KEY they're logged instead. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.KL_EMAIL_FROM || "Knowledge Lock <onboarding@resend.dev>";
  if (!key) {
    console.info(`[knowledge-lock] email to ${to} not sent (no RESEND_API_KEY): ${subject}\n${text}`);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });
  if (!res.ok) console.error("[knowledge-lock] email failed", res.status, await res.text().catch(() => ""));
  return res.ok;
}

export function inviteEmail(p: { orgName: string; inviter: string; role: string; url: string }) {
  const article = /^[aeiou]/i.test(p.role) ? "an" : "a";
  const subject = `${p.inviter} invited you to ${p.orgName} on Knowledge Lock`;
  const text = `${p.inviter} invited you to join ${p.orgName} on Knowledge Lock as ${article} ${p.role}.\n\nAccept the invite: ${p.url}\n\nThe link works for 7 days.`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;color:#293241;font-size:15px;line-height:1.6">
  <p><strong>${esc(p.inviter)}</strong> invited you to join <strong>${esc(p.orgName)}</strong> on Knowledge Lock as ${article} ${esc(p.role)}.</p>
  <p>Knowledge Lock is where your team and AI models agree on what's true, then lock it so everyone builds from the same version.</p>
  <p><a href="${esc(p.url)}" style="display:inline-block;background:#ee6c4d;color:#fff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px">Accept the invite</a></p>
  <p style="color:#5b6b7f;font-size:13px">The link works for 7 days. If you weren't expecting this, you can ignore it.</p></div>`;
  return { subject, html, text };
}

/** A short product notification with one button. */
export function noticeEmail(p: { subject: string; heading: string; lines: string[]; cta: string; url: string; orgName: string }) {
  const text = `${p.heading}\n\n${p.lines.join("\n\n")}\n\n${p.cta}: ${p.url}\n\n— Knowledge Lock, ${p.orgName}`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;color:#293241;font-size:15px;line-height:1.6">
  <p style="font-size:17px;font-weight:600;margin:0 0 12px">${esc(p.heading)}</p>
  ${p.lines.map((l) => `<p style="margin:0 0 12px">${esc(l)}</p>`).join("")}
  <p style="margin:20px 0"><a href="${esc(p.url)}" style="display:inline-block;background:#ee6c4d;color:#fff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px">${esc(p.cta)}</a></p>
  <p style="color:#5b6b7f;font-size:13px">Knowledge Lock, ${esc(p.orgName)}. You're getting this because you're part of this organisation on Knowledge Lock.</p></div>`;
  return { subject: p.subject, html, text };
}
