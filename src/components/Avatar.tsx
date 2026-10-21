import { Check } from "lucide-react";

/**
 * Initials avatar for the demo's fictional people. Colours come from the Guided Orchestration
 * palette and are keyed by role, so the same role looks the same everywhere.
 */
const ROLE_COLOURS: Record<string, { bg: string; fg: string }> = {
  product: { bg: "#3d5a80", fg: "#ffffff" },
  compliance: { bg: "#98c1d9", fg: "#293241" },
  engineering: { bg: "#6d597a", fg: "#ffffff" },
};
const FALLBACK = { bg: "#3d5a80", fg: "#ffffff" };

export function initials(name: string): string {
  return name
    .replace(/\(.*\)/, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function Avatar({
  name,
  role,
  size = 40,
  signed = false,
}: {
  name: string;
  role?: string;
  size?: number;
  signed?: boolean;
}) {
  const colour = (role && ROLE_COLOURS[role]) || FALLBACK;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      <span
        className="flex h-full w-full items-center justify-center rounded-full font-semibold ring-2 ring-bg"
        style={{ backgroundColor: colour.bg, color: colour.fg, fontSize: Math.round(size * 0.38) }}
      >
        {initials(name)}
      </span>
      {signed ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-good text-white ring-2 ring-bg"
          style={{ width: Math.round(size * 0.42), height: Math.round(size * 0.42) }}
        >
          <Check style={{ width: Math.round(size * 0.28), height: Math.round(size * 0.28) }} strokeWidth={3} />
        </span>
      ) : null}
    </span>
  );
}
