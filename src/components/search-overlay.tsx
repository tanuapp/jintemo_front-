import { Link, useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCatalog } from "@/lib/catalog-store";
import { mnt } from "@/lib/format";
import { variantPrice } from "@/lib/products";
import { cn } from "@/lib/utils";

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { catalog } = useCatalog();

  useEffect(() => {
    if (open) {
      setQ("");
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return catalog
      .filter((c) => c.kind === "glue" || c.variants.length > 0)
      .filter((c) => c.name.toLowerCase().includes(needle) || c.short.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [catalog, q]);

  if (!open) return null;

  const submit = () => {
    if (!q.trim()) return;
    onClose();
    navigate({ to: "/products", search: { q: q.trim() } });
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-foreground/40" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 max-h-[85vh] overflow-y-auto rounded-b-2xl bg-card p-4 shadow-lift">
        <div className="container-page flex items-center gap-3 px-0">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Хивс, цавуу хайх..."
            className="h-12 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground/70"
          />
          <button
            aria-label="Хаах"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {results.length > 0 && (
          <div className="container-page mt-2 space-y-1 px-0 pb-2">
            {results.map((r) => (
              <Link
                key={r.slug}
                to="/products/$slug"
                params={{ slug: r.slug }}
                onClick={onClose}
                className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-secondary/60"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-surface">
                  <img
                    src={r.kind === "carpet" ? r.variants[0]!.image : r.image}
                    alt=""
                    loading="lazy"
                    className={cn("h-full w-full", r.kind === "carpet" ? "object-contain p-1" : "object-cover")}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.kind === "carpet" ? "Хивс" : "Цавуу"} · {r.short}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold">
                  {mnt(r.kind === "carpet" ? variantPrice(r, r.variants[0]!) : r.price)}
                </span>
              </Link>
            ))}
            <button
              onClick={submit}
              className="mt-1 w-full rounded-lg py-2.5 text-center text-sm font-medium text-accent hover:underline"
            >
              "{q}" гэсэн бүх илэрцийг харах
            </button>
          </div>
        )}

        {q.trim() && results.length === 0 && (
          <p className="container-page px-0 py-6 text-center text-sm text-muted-foreground">Илэрц олдсонгүй.</p>
        )}
      </div>
    </div>
  );
}
