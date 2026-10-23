import { createHash, randomUUID } from "node:crypto";
import { chargeUsage, DemoError } from "@/lib/demo/service";
import { appUrl } from "@/lib/mode";
import type { AppUser } from "./auth";
import { appDb } from "./db";
import { noticeEmail, sendEmail } from "./email";
import { AppError, audit, checkEmail } from "./orgs";

/**
 * Requests for access from the sign-in page. They go to the admins (KL_ADMIN_EMAILS), who can turn
 * one into a new organisation with the requester as its owner, or dismiss it. The requester only ever
 * sees the same thank-you message, so the form doesn't reveal who already has access.
 */
export interface AccessRequest {
  id: string;
  name: string;
  email: string;
  company: string;
  title: string;
  message: string;
  createdAt: Date;
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

export async function submitAccessRequest(
  input: { name?: unknown; email?: unknown; company?: unknown; title?: unknown; message?: unknown; website?: unknown },
  ip: string
): Promise<void> {
  // A field people can't see. Bots fill it in; we quietly drop those.
  if (clean(input.website, 200)) return;
  const name = clean(input.name, 80);
  const email = checkEmail(input.email);
  const company = clean(input.company, 120);
  const title = clean(input.title, 80);
  const message = typeof input.message === "string" ? input.message.trim().slice(0, 1000) : "";
  if (!name) throw new AppError("Enter your name.");
  if (!company) throw new AppError("Enter your organisation's name.");
  const ipHash = createHash("sha256").update(`kl-access:${ip}`).digest("hex").slice(0, 32);
  try {
    await chargeUsage(`access:${ipHash}`, 1, {
      perHour: 5,
      perDay: 200,
      dayKey: "access-requests",
      hourMessage: "You've sent a few requests already. Please try again later, or email us.",
      dayMessage: "We've had a lot of requests today. Please try again tomorrow, or email us.",
    });
  } catch (err) {
    if (err instanceof DemoError) throw new AppError(err.message);
    throw err;
  }

  const db = await appDb();
  // One open request per email: a second one updates the first.
  const [existing] = await db<{ id: string }[]>`
    SELECT id FROM kl_access_requests WHERE email = ${email} AND status = 'pending' LIMIT 1`;
  if (existing) {
    await db`UPDATE kl_access_requests SET name = ${name}, company = ${company}, title = ${title}, message = ${message},
               ip_hash = ${ipHash}, created_at = now() WHERE id = ${existing.id}`;
    return;
  }
  const id = `req_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  await db`INSERT INTO kl_access_requests (id, name, email, company, title, message, ip_hash)
           VALUES (${id}, ${name}, ${email}, ${company}, ${title}, ${message}, ${ipHash})`;

  const admins = (process.env.KL_ADMIN_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean);
  const mail = noticeEmail({
    orgName: "Guided Orchestration",
    subject: `Access request: ${name}, ${company}`,
    heading: `${name} asked for access to Knowledge Lock`,
    lines: [
      `${name}${title ? `, ${title}` : ""} at ${company} (${email}).`,
      ...(message ? [`"${message}"`] : []),
      "Approve it from the Admin page to create their organisation and invite them as its owner.",
    ],
    cta: "Open Admin",
    url: `${appUrl()}/app/admin`,
  });
  await Promise.all(
    admins.map((to) => sendEmail(to, mail.subject, mail.html, mail.text).catch((e) => console.error("[knowledge-lock] access email", e)))
  );
}

export async function listAccessRequests(): Promise<AccessRequest[]> {
  const db = await appDb();
  return db<AccessRequest[]>`
    SELECT id, name, email, company, title, message, created_at AS "createdAt"
    FROM kl_access_requests WHERE status = 'pending' ORDER BY created_at DESC LIMIT 100`;
}

export async function getAccessRequest(id: string): Promise<AccessRequest | null> {
  const db = await appDb();
  const [r] = await db<AccessRequest[]>`
    SELECT id, name, email, company, title, message, created_at AS "createdAt"
    FROM kl_access_requests WHERE id = ${id} AND status = 'pending'`;
  return r ?? null;
}

export async function closeAccessRequest(admin: AppUser, id: string, status: "approved" | "dismissed", orgId?: string) {
  const db = await appDb();
  const [r] = await db<{ email: string }[]>`
    UPDATE kl_access_requests SET status = ${status}, handled_by = ${admin.id}, handled_at = now(), org_id = ${orgId ?? null}
    WHERE id = ${id} AND status = 'pending' RETURNING email`;
  if (r) await audit(orgId ?? null, admin, `access_request.${status}`, r.email);
}
