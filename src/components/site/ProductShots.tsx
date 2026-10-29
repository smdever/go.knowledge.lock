"use client";

import { useEffect, useRef, useState } from "react";
import { STEPS, SHOTS, type StepId } from "./content";

const WIDTH = 1200;
const PHONE_WIDTH = 800;
const PHONE = "(max-width: 639px)";

/**
 * Screenshots of each step, as tabs. Each has light, dark and phone versions, picked by screen size and theme,
 * and only the one being shown loads, once the frame is near the screen.
 */
export default function ProductShots() {
  const [active, setActive] = useState<StepId>("propose");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const frame = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = frame.current;
    if (!el || near) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: "300px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  const index = STEPS.findIndex((s) => s.id === active);
  const shot = SHOTS[active];

  function onKey(e: React.KeyboardEvent) {
    const last = STEPS.length - 1;
    const next =
      e.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    setActive(STEPS[next].id);
    tabs.current[next]?.focus();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
      <div className="lg:col-span-5">
        <div role="tablist" aria-label="Steps" onKeyDown={onKey} className="grid gap-2">
          {STEPS.map((step, i) => {
            const selected = step.id === active;
            return (
              <button
                key={step.id}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`shot-tab-${step.id}`}
                aria-selected={selected}
                aria-controls="shot-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(step.id)}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                  selected ? "border-accent bg-surface" : "border-ink/15 hover:border-ink/35"
                }`}
              >
                <span className="flex items-baseline gap-3">
                  <span className="font-mono text-xs font-semibold text-accent">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-bold">{step.title}</span>
                </span>
                <span className={`mt-1 block text-sm leading-relaxed ${selected ? "text-ink/80" : "text-muted"}`}>{step.text}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div id="shot-panel" role="tabpanel" aria-labelledby={`shot-tab-${active}`} className="lg:col-span-7">
        <div
          ref={frame}
          className={`overflow-hidden rounded-2xl border border-ink/15 bg-bg shadow-[0_12px_40px_rgba(41,50,65,0.12)] ${near ? "" : "aspect-[var(--ar-phone)] sm:aspect-[var(--ar)]"}`}
          // Until the screenshot loads, hold its space so the page doesn't jump.
          style={near ? undefined : ({ "--ar": `${WIDTH} / ${shot.height}`, "--ar-phone": `${PHONE_WIDTH} / ${shot.phoneHeight}` } as React.CSSProperties)}
        >
          {near ? (
            <picture key={active} className="block motion-safe:animate-[fade_180ms_ease-out]">
              <source srcSet={`/knowledge-lock/${active}-dark-phone.webp`} media={`${PHONE} and (prefers-color-scheme: dark)`} width={PHONE_WIDTH} height={shot.phoneHeight} />
              <source srcSet={`/knowledge-lock/${active}-light-phone.webp`} media={PHONE} width={PHONE_WIDTH} height={shot.phoneHeight} />
              <source srcSet={`/knowledge-lock/${active}-dark.webp`} media="(prefers-color-scheme: dark)" width={WIDTH} height={shot.height} />
              <img src={`/knowledge-lock/${active}-light.webp`} alt={shot.alt} width={WIDTH} height={shot.height} decoding="async" className="block h-auto w-full" />
            </picture>
          ) : null}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">{shot.caption}</p>
      </div>
    </div>
  );
}
