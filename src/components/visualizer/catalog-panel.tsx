import {
  ArrowRight,
  ChevronLeft,
  ChevronUp,
  LayoutGrid,
  List,
  Loader2,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { NO_FILTERS, filterItems, type Filters, type VizItem } from "./shared";

/**
 * The product column: search, filters, and the list (or grid) of floors. Picking one lays
 * it in the room at once.
 */
export function CatalogPanel({
  items,
  typeNames,
  selectedKey,
  pendingKey,
  onSelect,
  query,
  setQuery,
  filters,
  setFilters,
  open = null,
}: {
  items: VizItem[];
  typeNames: Record<string, string>;
  selectedKey: string | null;
  /** Shows a spinner on the card while its pattern loads. */
  pendingKey: string | null;
  onSelect: (item: VizItem) => void;
  query: string;
  setQuery: (q: string) => void;
  filters: Filters;
  setFilters: (f: Filters) => void;
  /** Open on the search box or the filters (when reached from the phone drawer). */
  open?: "search" | "filters" | null;
}) {
  const [view, setView] = useState<"list" | "grid">("list");
  const [searchOpen, setSearchOpen] = useState(open === "search" || !!query);
  const [filtersOpen, setFiltersOpen] = useState(open === "filters");
  const [draft, setDraft] = useState<Filters>(filters);
  const [scrolled, setScrolled] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const visible = filterItems(items, query, filters);
  const active = filters.types.length + filters.sizes.length;
  const typeOptions = [...new Set(items.map((i) => i.typeId))];
  const sizeOptions = [...new Set(items.map((i) => i.size).filter(Boolean))];

  if (filtersOpen) {
    const toggle = (key: keyof Filters, value: string) =>
      setDraft((d) => ({
        ...d,
        [key]: d[key].includes(value) ? d[key].filter((v) => v !== value) : [...d[key], value],
      }));
    const group = (
      title: string,
      key: keyof Filters,
      options: string[],
      label: (v: string) => string,
    ) => (
      <section className="border-b border-border py-3">
        <p className="px-1 pb-1 text-[15px] font-semibold">{title}</p>
        {options.map((v) => (
          <label
            key={v}
            className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-2 text-[15px]"
          >
            {label(v)}
            <input
              type="checkbox"
              className="h-5 w-5 accent-[var(--primary)]"
              checked={draft[key].includes(v)}
              onChange={() => toggle(key, v)}
            />
          </label>
        ))}
      </section>
    );
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center gap-1 px-2 pb-2">
          <button
            type="button"
            aria-label="Буцах"
            onClick={() => setFiltersOpen(false)}
            className="grid h-10 w-10 place-items-center rounded-md hover:bg-secondary"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="font-display text-xl font-bold">Шүүлтүүр</h2>
        </div>
        <p className="px-4 pb-1 text-sm font-semibold text-muted-foreground">
          {draft.types.length + draft.sizes.length
            ? `${draft.types.length + draft.sizes.length} шүүлтүүр сонгосон`
            : "Шүүлтүүр сонгоогүй"}
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto px-3">
          {typeOptions.length > 1 && group("Төрөл", "types", typeOptions, (v) => typeNames[v] ?? v)}
          {sizeOptions.length > 1 && group("Хэмжээ", "sizes", sizeOptions, (v) => v)}
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-border p-4">
          <button
            type="button"
            disabled={!draft.types.length && !draft.sizes.length}
            onClick={() => setDraft(NO_FILTERS)}
            className="h-11 rounded-md border border-border text-sm font-medium disabled:opacity-40"
          >
            Цэвэрлэх
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters(draft);
              setFiltersOpen(false);
            }}
            className="h-11 rounded-md bg-primary text-sm font-semibold text-primary-foreground"
          >
            Болсон
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 px-2 pb-3">
        <button
          type="button"
          aria-label="Хайх"
          aria-pressed={searchOpen}
          onClick={() => {
            if (searchOpen) setQuery("");
            setSearchOpen((o) => !o);
          }}
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border",
            searchOpen && "bg-primary text-primary-foreground",
          )}
        >
          {searchOpen ? (
            <X className="h-[18px] w-[18px]" />
          ) : (
            <Search className="h-[18px] w-[18px]" />
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(filters);
            setFiltersOpen(true);
          }}
          className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-md border border-border text-sm font-medium"
        >
          <SlidersHorizontal className="h-4 w-4" /> Шүүлтүүр
          {active > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] text-primary-foreground">
              {active}
            </span>
          )}
        </button>
        <div className="inline-flex shrink-0 overflow-hidden rounded-md border border-border">
          {(
            [
              ["list", List, "Жагсаалтаар"],
              ["grid", LayoutGrid, "Зургаар"],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              type="button"
              aria-label={label}
              aria-pressed={view === id}
              onClick={() => setView(id)}
              className={cn(
                "grid h-10 w-10 place-items-center",
                view === id ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
            </button>
          ))}
        </div>
      </div>
      {searchOpen && (
        <div className="px-2 pb-3">
          <input
            ref={searchRef}
            aria-label="Хивс хайх"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Нэр эсвэл кодоор хайх…"
            className="h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
      )}
      <div
        ref={listRef}
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 300)}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto px-2 pb-14",
          view === "grid" ? "grid auto-rows-min grid-cols-3 gap-2" : "space-y-2.5",
        )}
      >
        {visible.map((item) => {
          const selected = item.key === selectedKey;
          const pending = item.key === pendingKey;
          return view === "grid" ? (
            <button
              key={item.key}
              type="button"
              title={item.name}
              aria-label={item.name}
              aria-pressed={selected}
              onClick={() => onSelect(item)}
              className={cn(
                "relative aspect-square overflow-hidden rounded-md border-2 bg-surface",
                selected ? "border-primary" : "border-transparent hover:border-border",
              )}
            >
              {item.image && (
                <img
                  src={item.image}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              )}
              {pending && <Spinner />}
            </button>
          ) : (
            <div
              key={item.key}
              className={cn(
                "relative flex gap-4 rounded-lg border bg-card p-3 transition-colors",
                selected
                  ? "border-foreground/60 ring-1 ring-foreground/40"
                  : "border-border hover:border-foreground/25",
              )}
            >
              <button
                type="button"
                aria-label={item.name}
                aria-pressed={selected}
                onClick={() => onSelect(item)}
                className="absolute inset-0 rounded-lg"
              />
              <span className="pointer-events-none relative h-[104px] w-[104px] shrink-0 overflow-hidden rounded-md bg-surface">
                {item.image && (
                  <img
                    src={item.image}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
                {pending && <Spinner />}
              </span>
              <span className="pointer-events-none flex min-w-0 flex-1 flex-col">
                <span className="line-clamp-2 text-sm font-semibold leading-snug">{item.name}</span>
                {item.code && (
                  <span className="mt-0.5 text-xs text-muted-foreground">{item.code}</span>
                )}
                <span className="mt-auto text-xs text-muted-foreground">
                  {item.size ? `Хэмжээ: ${item.size}` : typeNames[item.typeId]}
                </span>
                <a
                  href={`/products/${encodeURIComponent(item.product.slug)}?color=${encodeURIComponent(item.variant.id)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="pointer-events-auto relative mt-1 inline-flex w-fit items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Дэлгэрэнгүй <ArrowRight className="h-3 w-3" />
                </a>
              </span>
            </div>
          );
        })}
        {!visible.length && (
          <p className="col-span-3 py-10 text-center text-sm text-muted-foreground">
            Илэрц олдсонгүй.
          </p>
        )}
      </div>
      {scrolled && (
        <button
          type="button"
          onClick={() => listRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          className="absolute inset-x-0 bottom-0 flex h-12 items-center justify-center gap-2 bg-card/95 text-sm font-medium backdrop-blur"
        >
          <ChevronUp className="h-4 w-4" /> Дээш буцах
        </button>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span className="absolute inset-0 grid place-items-center bg-background/45">
      <Loader2 className="h-6 w-6 animate-spin text-foreground" />
    </span>
  );
}
