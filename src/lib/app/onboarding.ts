import type { AppUser } from "./auth";
import { appDb } from "./db";
import { noticeEmail, sendEmail } from "./email";
import { AppError, audit } from "./orgs";
import { appUrl } from "@/lib/mode";

/**
 * Getting started: a checklist for owners until their organisation locks its first record, and one
 * reminder email a few days after the owner joins if nothing has been locked yet.
 */
export interface OnboardingStep {
  id: "profile" | "policy" | "invite" | "record" | "review" | "lock";
  label: string;
  help: string;
  href: string;
  done: boolean;
  optional?: boolean;
}

export interface Onboarding {
  steps: OnboardingStep[];
  done: number;
  total: number;
}

interface Facts {
  hasProfile: boolean;
  policyLocked: boolean;
  invited: boolean;
  draftId: string | null;
  started: boolean;
  reviewed: boolean;
  locked: boolean;
  dismissed: boolean;
}

async function facts(orgId: string, userId: string): Promise<Facts> {
  const db = await appDb();
  const [f] = await db<Facts[]>`
    SELECT
      EXISTS (SELECT 1 FROM kl_profiles p WHERE p.user_id = ${userId} AND p.name <> '') AS "hasProfile",
      (o.policy_lock_id IS NOT NULL) AS "policyLocked",
      (
        (SELECT count(*) FROM kl_members m WHERE m.org_id = o.id AND m.role IN ('owner', 'signer')) > 1
        OR EXISTS (
          SELECT 1 FROM kl_invites i
          WHERE i.org_id = o.id AND i.role IN ('owner', 'signer') AND i.revoked_at IS NULL
            AND i.invited_by IN (SELECT user_id FROM kl_members WHERE org_id = o.id)
        )
      ) AS invited,
      (SELECT r.id FROM kl_app_records r
        WHERE r.org_id = o.id AND r.kind = 'requirements' AND r.status = 'draft' AND r.data->'archived' IS NULL
        ORDER BY r.updated_at DESC LIMIT 1) AS "draftId",
      EXISTS (SELECT 1 FROM kl_app_records r WHERE r.org_id = o.id AND r.kind = 'requirements') AS started,
      EXISTS (
        SELECT 1 FROM kl_audit a JOIN kl_app_records r ON r.id = a.target
        WHERE a.org_id = o.id AND a.action = 'record.reviewed' AND r.kind = 'requirements'
      ) AS reviewed,
      EXISTS (SELECT 1 FROM kl_app_records r WHERE r.org_id = o.id AND r.kind = 'requirements' AND r.status = 'locked') AS locked,
      (o.onboarding_dismissed_at IS NOT NULL OR o.closing_at IS NOT NULL) AS dismissed
    FROM kl_organisations o WHERE o.id = ${orgId}`;
  return f;
}

/** The checklist, for owners only, until a record is locked or an owner hides it. */
export async function getOnboarding(orgId: string, userId: string, role: string): Promise<Onboarding | null> {
  if (role !== "owner") return null;
  const f = await facts(orgId, userId);
  if (!f || f.locked || f.dismissed) return null;
  const draft = f.draftId ? `/app/r/${f.draftId}` : "/app/records/new";
  const steps: OnboardingStep[] = [
    {
      id: "profile",
      label: "Add your name and job title",
      help: "They go into every sign-off you give, so colleagues can see who agreed what.",
      href: "/app/profile",
      done: f.hasProfile,
    },
    {
      id: "policy",
      label: "Lock your policy",
      help: "The rules every record is checked against. Start from a template if you don't have one written down.",
      href: "/app/policies",
      done: f.policyLocked,
      optional: true,
    },
    {
      id: "record",
      label: "Start your first record",
      help: "Five to ten statements your team needs to agree on. Templates give you a head start.",
      href: f.draftId ? draft : "/app/records/new",
      done: f.started,
    },
    {
      id: "invite",
      label: "Invite a colleague to sign off",
      help: "Signers approve records from their own accounts. If you'd rather try it first, you can lock your first record on your own.",
      href: "/app/team",
      done: f.invited,
    },
    {
      id: "review",
      label: "Send it for AI review",
      help: "Several AI models check every line for contradictions, unclear wording and clashes with your policy.",
      href: draft,
      done: f.reviewed,
    },
    {
      id: "lock",
      label: "Sign it off and lock it",
      help: "Once enough signers approve, lock it. It becomes the version your teams and AI agents work from.",
      href: draft,
      done: f.locked,
    },
  ];
  return { steps, done: steps.filter((s) => s.done).length, total: steps.length };
}

export async function dismissOnboarding(orgId: string, user: AppUser): Promise<void> {
  const db = await appDb();
  const [m] = await db<{ role: string }[]>`SELECT role FROM kl_members WHERE org_id = ${orgId} AND user_id = ${user.id}`;
  if (m?.role !== "owner") throw new AppError("Only owners can hide the getting-started list.");
  await db`UPDATE kl_organisations SET onboarding_dismissed_at = now() WHERE id = ${orgId} AND onboarding_dismissed_at IS NULL`;
}

// ---------- The reminder email ----------

const REMIND_AFTER_DAYS = 3;
/** Owners who joined longer ago than this aren't sent a reminder (it would arrive out of the blue). */
const REMIND_WITHIN_DAYS = 21;

const longDate = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "Europe/London" }).format(d);

/**
 * One reminder per organisation, a few days after its first owner joined, if nothing is locked yet.
 * Run once a day by a scheduled job. Returns how many organisations were reminded.
 */
export async function sendOnboardingReminders(now = new Date()): Promise<number> {
  const db = await appDb();
  const due = await db<{ id: string; name: string; joined: Date }[]>`
    SELECT o.id, o.name, min(m.created_at) AS joined
    FROM kl_organisations o JOIN kl_members m ON m.org_id = o.id AND m.role = 'owner'
    WHERE o.onboarding_reminded_at IS NULL AND o.onboarding_dismissed_at IS NULL AND o.closing_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM kl_app_records r WHERE r.org_id = o.id AND r.kind = 'requirements' AND r.status = 'locked')
    GROUP BY o.id, o.name
    HAVING min(m.created_at) <= ${now}::timestamptz - make_interval(days => ${REMIND_AFTER_DAYS})
       AND min(m.created_at) > ${now}::timestamptz - make_interval(days => ${REMIND_WITHIN_DAYS})`;
  let sent = 0;
  for (const org of due) {
    // Claim it first, so two runs at once can't both send.
    const claimed = await db`UPDATE kl_organisations SET onboarding_reminded_at = now() WHERE id = ${org.id} AND onboarding_reminded_at IS NULL RETURNING id`;
    if (!claimed.length) continue;
    const owners = await db<{ email: string }[]>`SELECT email FROM kl_members WHERE org_id = ${org.id} AND role = 'owner'`;
    const [draft] = await db<{ id: string; title: string }[]>`
      SELECT id, data->'payload'->>'title' AS title FROM kl_app_records
      WHERE org_id = ${org.id} AND kind = 'requirements' AND status = 'draft' AND data->'archived' IS NULL
      ORDER BY updated_at DESC LIMIT 1`;
    const last = "This is the only reminder we'll send.";
    const mail = draft
      ? noticeEmail({
          orgName: org.name,
          subject: `Your draft is waiting: ${draft.title}`,
          heading: `Your draft "${draft.title}" isn't locked yet`,
          lines: [
            `You started it in ${org.name} on Knowledge Lock. Send it for AI review, sign it off, and it becomes the signed-off version your teams and AI agents work from.`,
            "If you're the only signer so far, you can lock it on your own.",
            last,
          ],
          cta: "Open your draft",
          url: `${appUrl()}/app/r/${draft.id}`,
        })
      : noticeEmail({
          orgName: org.name,
          subject: `Your first record in ${org.name}`,
          heading: "Lock your first record",
          lines: [
            `You joined ${org.name} on Knowledge Lock on ${longDate(org.joined)}. The quickest way to see what it does is to lock one small record, with five to ten statements your team needs to agree on, such as the requirements for a feature or the rules for an AI assistant.`,
            "Start from a template and edit the wording. You can sign it off on your own to see the whole flow, then invite colleagues for the next one.",
            last,
          ],
          cta: "Start your first record",
          url: `${appUrl()}/app/records/new`,
        });
    for (const o of owners) {
      await sendEmail(o.email, mail.subject, mail.html, mail.text).catch((err) => console.error("[knowledge-lock] reminder failed", err));
    }
    await audit(org.id, null, "org.onboarding_reminder", undefined, { draft: Boolean(draft), owners: owners.length });
    sent++;
  }
  return sent;
}
