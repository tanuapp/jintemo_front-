import { Check } from "lucide-react";
import type { Busy } from "./shared";

/** The round "Loading…" indicator over the room, with the percentage inside. */
export function ProgressRing({ busy }: { busy: Busy }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, busy.pct));
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-0 z-20 grid place-items-center"
    >
      <div className="flex flex-col items-center">
        <div className="relative grid h-[120px] w-[120px] place-items-center rounded-full bg-foreground/45 shadow-lift backdrop-blur-md">
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="5"
            />
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke="white"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - pct / 100)}
              className="transition-[stroke-dashoffset] duration-200"
            />
          </svg>
          {busy.done ? (
            <Check className="h-9 w-9 text-white" />
          ) : (
            <span className="font-display text-2xl font-bold tabular-nums text-white">{pct}%</span>
          )}
        </div>
        <p className="mt-3 max-w-[260px] truncate rounded-full bg-foreground/55 px-3 py-1 text-center text-xs font-medium text-white backdrop-blur">
          {busy.label}
        </p>
      </div>
    </div>
  );
}
