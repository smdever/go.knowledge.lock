import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/app/context";
import { listActivity } from "@/lib/app/activity";

const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(d);
const time = (d: Date) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(d);

export default async function ActivityPage() {
  const ctx = await getContext("/app/activity");
  if (!ctx.current || ctx.current.role !== "owner") notFound();
  const items = await listActivity(ctx.current.orgId);

  // Group by day for scanning.
  const groups: { day: string; items: typeof items }[] = [];
  for (const item of items) {
    const label = day(item.at);
    const last = groups.at(-1);
    if (last?.day === label) last.items.push(item);
    else groups.push({ day: label, items: [item] });
  }

  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold text-accent">{ctx.current.orgName}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Activity</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink/70">
        Everything people have done here, newest first. This log can&apos;t be edited or deleted. Times are UK time.
      </p>
      {groups.length ? (
        groups.map((g) => (
          <section key={g.day} className="mt-8">
            <h2 className="text-sm font-semibold text-ink/60">{g.day}</h2>
            <ol className="mt-2 divide-y divide-ink/10 border-y border-ink/10">
              {g.items.map((i) => (
                <li key={i.id} className="flex gap-4 py-3 text-[15px]">
                  <time className="w-12 shrink-0 pt-px text-sm tabular-nums text-ink/55" dateTime={i.at.toISOString()}>
                    {time(i.at)}
                  </time>
                  <div className="min-w-0">
                    <p>
                      <span className="font-semibold">{i.actor}</span>{" "}
                      {i.href ? (
                        <Link href={i.href} className="hover:underline">
                          {i.text}
                        </Link>
                      ) : (
                        i.text
                      )}
                    </p>
                    {i.note ? <p className="mt-0.5 text-sm text-ink/60">{i.note}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))
      ) : (
        <p className="mt-8 text-sm text-ink/60">Nothing yet.</p>
      )}
    </div>
  );
}
