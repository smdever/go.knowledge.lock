import { ROLE_HELP, withArticle, type Role } from "./roles";

/** Product emails go through Resend's HTTP API. Without RESEND_API_KEY they're logged instead. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A display name that's safe inside a From header. */
const headerName = (s: string) => s.replace(/[\r\n"<>\\]/g, "").trim().slice(0, 60);

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  opts: { fromName?: string; replyTo?: string } = {}
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  let from = process.env.KL_EMAIL_FROM || "Knowledge Lock <onboarding@resend.dev>";
  if (opts.fromName) {
    // Keep our sending address, but show who it's from: "Olivia Ward via Knowledge Lock <no-reply@…>".
    const address = from.match(/<([^>]+)>/)?.[1] ?? from;
    from = `"${headerName(opts.fromName)} via Knowledge Lock" <${address}>`;
  }
  if (!key) {
    console.info(`[knowledge-lock] email to ${to} not sent (no RESEND_API_KEY): ${subject}\nFrom: ${from}${opts.replyTo ? `\nReply-To: ${opts.replyTo}` : ""}\n${text}`);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, text, ...(opts.replyTo ? { reply_to: opts.replyTo } : {}) }),
  });
  if (!res.ok) console.error("[knowledge-lock] email failed", res.status, await res.text().catch(() => ""));
  return res.ok;
}

export interface Inviter {
  name: string;
  title?: string;
  email: string;
}

/**
 * The invite says plainly who sent it (name, job title and email), what the role lets you do, and
 * replies go straight to that person, so the recipient can check it's genuine.
 */
export function inviteEmail(p: { orgName: string; inviter: Inviter; role: Role; url: string; onBehalfOf?: string }) {
  const who = p.inviter.name || p.inviter.email;
  const whoLine = [who, p.inviter.title, p.onBehalfOf ? `at ${p.onBehalfOf}` : ""].filter(Boolean).join(", ");
  const subject = `${who} invited you to ${p.orgName} on Knowledge Lock`;
  const roleLine = `As ${withArticle(p.role)}, you can ${ROLE_HELP[p.role]}.`;
  const text = [
    `${whoLine} (${p.inviter.email}) invited you to join ${p.orgName} on Knowledge Lock as ${withArticle(p.role)}.`,
    "Knowledge Lock is where your team and AI models agree on what's true, then lock it, so everyone builds from the same signed-off version.",
    roleLine,
    `Accept the invite: ${p.url}`,
    `The link works for 7 days. Not sure about this invite? Reply to this email to ask ${who} directly. If you weren't expecting it, you can ignore it.`,
  ].join("\n\n");
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;color:#293241;font-size:15px;line-height:1.6">
  <p style="font-size:17px;font-weight:600;margin:0 0 12px">You're invited to ${esc(p.orgName)} on Knowledge Lock</p>
  <div style="border-left:3px solid #b8442a;padding:4px 0 4px 12px;margin:0 0 16px">
    <p style="margin:0;font-weight:600">${esc(who)}</p>
    <p style="margin:0;color:#5b6b7f;font-size:14px">${esc([p.inviter.title, p.onBehalfOf].filter(Boolean).join(", "))}${p.inviter.title || p.onBehalfOf ? " · " : ""}<a href="mailto:${esc(p.inviter.email)}" style="color:#5b6b7f">${esc(p.inviter.email)}</a></p>
  </div>
  <p style="margin:0 0 12px">${esc(who)} invited you to join <strong>${esc(p.orgName)}</strong> as ${withArticle(p.role)}.</p>
  <p style="margin:0 0 12px">Knowledge Lock is where your team and AI models agree on what's true, then lock it, so everyone builds from the same signed-off version. ${esc(roleLine)}</p>
  <p style="margin:20px 0"><a href="${esc(p.url)}" style="display:inline-block;background:#b8442a;color:#fff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px">Accept the invite</a></p>
  <p style="margin:0 0 12px;color:#5b6b7f;font-size:13px">The link works for 7 days. Not sure about this invite? Reply to this email to ask ${esc(who)} directly. If you weren't expecting it, you can ignore it.</p>
  <p style="color:#5b6b7f;font-size:13px">Knowledge Lock, by Guided Orchestration Ltd</p></div>`;
  return { subject, html, text, fromName: who, replyTo: p.inviter.email };
}

/** A short product notification with one button. */
export function noticeEmail(p: { subject: string; heading: string; lines: string[]; cta: string; url: string; orgName: string }) {
  const text = `${p.heading}\n\n${p.lines.join("\n\n")}\n\n${p.cta}: ${p.url}\n\n— Knowledge Lock, ${p.orgName}`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;color:#293241;font-size:15px;line-height:1.6">
  <p style="font-size:17px;font-weight:600;margin:0 0 12px">${esc(p.heading)}</p>
  ${p.lines.map((l) => `<p style="margin:0 0 12px">${esc(l)}</p>`).join("")}
  <p style="margin:20px 0"><a href="${esc(p.url)}" style="display:inline-block;background:#b8442a;color:#fff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px">${esc(p.cta)}</a></p>
  <p style="color:#5b6b7f;font-size:13px">Knowledge Lock, ${esc(p.orgName)}. You're getting this because you're part of this organisation on Knowledge Lock.</p></div>`;
  return { subject: p.subject, html, text };
}
