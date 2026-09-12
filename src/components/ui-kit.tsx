import { Check, Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { mnt } from "@/lib/format";

/* ---------- Buttons ---------- */

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "accent";
  size?: "md" | "lg";
};

export function Btn({ variant = "primary", size = "md", className, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        size === "lg" ? "h-13 px-6 text-base" : "h-11 px-5 text-sm",
        variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "accent" && "bg-accent text-accent-foreground hover:bg-accent/90",
        variant === "secondary" &&
          "border border-border bg-card text-foreground hover:bg-secondary",
        variant === "ghost" && "text-foreground hover:bg-secondary",
        className,
      )}
    />
  );
}

/* ---------- Field ---------- */

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
      <div className="mt-1.5">{children}</div>
      {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
    </label>
  );
}

export function TextInput({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={cn(
        "h-12 w-full rounded-md border border-input bg-card px-3 text-base outline-none transition-shadow placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring/40",
        className,
      )}
    />
  );
}

export function TextArea({
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={cn(
        "min-h-24 w-full rounded-md border border-input bg-card p-3 text-base outline-none transition-shadow placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring/40",
        className,
      )}
    />
  );
}

/* ---------- Quantity ---------- */

export function QuantityStepper({
  value,
  onChange,
  min = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-border bg-card">
      <button
        type="button"
        aria-label="Хасах"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="grid h-11 w-11 place-items-center disabled:opacity-40"
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        value={value}
        inputMode="numeric"
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
          onChange(Number.isNaN(n) ? min : Math.max(min, n));
        }}
        className="h-11 w-14 border-x border-border bg-transparent text-center text-base font-semibold outline-none"
        aria-label="Тоо ширхэг"
      />
      <button
        type="button"
        aria-label="Нэмэх"
        onClick={() => onChange(value + 1)}
        className="grid h-11 w-11 place-items-center"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ---------- Option card (radio) ---------- */

export function OptionCard({
  selected,
  onSelect,
  icon,
  title,
  description,
  price,
  priceLabel,
  disabled,
}: {
  selected: boolean;
  onSelect: () => void;
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Numeric price. Ignored when `priceLabel` is set. */
  price?: number;
  /** Free-text shown in place of a price (e.g. "Үнэ тохирно"). */
  priceLabel?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      disabled={disabled}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors",
        disabled && "cursor-not-allowed opacity-55",
        selected ? "border-accent bg-accent/5" : "border-border bg-card hover:bg-secondary/50",
        disabled && "hover:bg-card",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border",
          selected ? "border-accent" : "border-muted-foreground/50",
        )}
      >
        {selected && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          {icon}
          <span className="font-medium">{title}</span>
        </span>
        {description && (
          <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
            {description}
          </span>
        )}
      </span>
      <span className="shrink-0 text-sm font-semibold">
        {priceLabel ?? (!price ? "0₮" : `+${mnt(price)}`)}
      </span>
    </button>
  );
}

/* ---------- Color swatch ---------- */

export function ColorSwatch({
  hex,
  name,
  selected,
  onSelect,
  size = "md",
}: {
  hex: string;
  name: string;
  selected: boolean;
  onSelect: () => void;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      title={name}
      aria-label={name}
      aria-pressed={selected}
      className={cn(
        "rounded-full border-2 p-0.5 transition-transform",
        size === "sm" ? "h-6 w-6" : "h-10 w-10",
        selected ? "border-accent scale-105" : "border-transparent hover:scale-105",
      )}
    >
      <span
        className="block h-full w-full rounded-full border border-border"
        style={{ backgroundColor: hex }}
      />
    </button>
  );
}

/* ---------- Rows / summary ---------- */

export function SummaryRow({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-1.5 text-sm",
        strong && "border-t border-border pt-3 text-base font-bold",
        muted && "text-muted-foreground",
      )}
    >
      <span className="shrink-0">{label}</span>
      <span
        className={cn(
          "ml-auto min-w-0 text-right tabular-nums [overflow-wrap:anywhere]",
          !muted && "font-medium",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function Badge({
  children,
  tone = "accent",
}: {
  children: ReactNode;
  tone?: "accent" | "muted" | "success" | "sale" | "soldout" | "new" | "featured";
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none",
        tone === "accent" && "bg-accent text-accent-foreground",
        tone === "muted" && "bg-secondary text-secondary-foreground",
        tone === "success" && "bg-success text-success-foreground",
        tone === "sale" && "bg-destructive text-destructive-foreground",
        tone === "soldout" && "bg-foreground text-background",
        tone === "new" && "bg-accent text-accent-foreground",
        tone === "featured" && "bg-secondary text-foreground",
      )}
    >
      {children}
    </span>
  );
}

/* ---------- Empty state ---------- */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border p-12 text-center">
      <Icon className="mx-auto h-9 w-9 text-muted-foreground" />
      <p className="mt-4 font-display text-lg font-bold">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/* ---------- Avatar (initials) ---------- */

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground",
        className,
      )}
    >
      {initials || "?"}
    </span>
  );
}

/* ---------- Order status timeline ---------- */

export type TimelineStep = { label: string; state: "done" | "current" | "todo" | "cancelled" };

export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="relative ml-3 border-l border-border">
      {steps.map((s) => (
        <li key={s.label} className="relative py-3 pl-6">
          <span
            className={cn(
              "absolute -left-[9px] top-4 grid h-4 w-4 place-items-center rounded-full border-2",
              s.state === "done" && "border-success bg-success",
              s.state === "current" && "border-accent bg-accent",
              s.state === "todo" && "border-border bg-background",
              s.state === "cancelled" && "border-destructive bg-destructive",
            )}
          >
            {s.state === "done" && <Check className="h-2.5 w-2.5 text-success-foreground" />}
          </span>
          <p
            className={cn(
              "text-sm",
              s.state === "todo" ? "text-muted-foreground" : "font-medium text-foreground",
              s.state === "cancelled" && "text-destructive",
            )}
          >
            {s.label}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** Small pill for the current order status. */
export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "confirmed" | "shipped" | "done" | "cancelled";
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tone === "confirmed" && "bg-accent/12 text-accent",
        tone === "shipped" && "bg-warning/18 text-warning-foreground",
        tone === "done" && "bg-success/15 text-success",
        tone === "cancelled" && "bg-destructive/15 text-destructive",
      )}
    >
      {label}
    </span>
  );
}
