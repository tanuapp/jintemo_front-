import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, errorMessage, json } from "@/lib/api";
import { useCatalog } from "@/lib/catalog-store";
import type { StockLocation } from "@/lib/products";
import { cn } from "@/lib/utils";
import { DataError, Empty, Loading, PageTitle, Panel, inputClass } from "@/components/admin/shared";

export const Route = createFileRoute("/admin/inventory")({
  component: Inventory,
  head: () => ({
    meta: [{ title: "Үлдэгдэл | JINTEMO" }, { name: "robots", content: "noindex" }],
  }),
});

/** One stock-keeping unit: a colour of a variant product, or a single-item product. */
type Row = {
  key: string;
  slug: string;
  variantId?: string | undefined;
  name: string;
  code: string;
  image: string;
  typeId: string;
  active: boolean;
  inventory: Record<string, number>;
  stock: number;
  updatedAt?: string | undefined;
  updatedBy: string;
};
type InventoryData = { locations: StockLocation[]; rows: Row[] };
const QUERY_KEY = ["admin", "inventory"];
const MAX_STOCK = 10000000;
const total = (row: Row) => Object.values(row.inventory).reduce((sum, n) => sum + n, 0);

function Inventory() {
  const qc = useQueryClient();
  const { types } = useCatalog();
  const q = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api<InventoryData>("/admin/inventory"),
    refetchOnWindowFocus: true,
  });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  if (q.isLoading) return <Loading />;
  if (q.error) return <DataError error={q.error.message} retry={q.refetch} />;
  const { locations, rows } = q.data!;

  const setCell = (key: string, locationId: string, quantity: number) =>
    qc.setQueryData<InventoryData>(
      QUERY_KEY,
      (data) =>
        data && {
          ...data,
          rows: data.rows.map((r) =>
            r.key === key ? { ...r, inventory: { ...r.inventory, [locationId]: quantity } } : r,
          ),
        },
    );
  // The cell shows the new number at once; a failed save puts the old one back.
  const save = async (row: Row, locationId: string, quantity: number) => {
    const previous = row.inventory[locationId] ?? 0;
    setCell(row.key, locationId, quantity);
    try {
      const r = await api<{ row: Row }>(
        `/admin/inventory/${encodeURIComponent(row.slug)}`,
        json("PATCH", { variantId: row.variantId, locationId, quantity, expected: previous }),
      );
      // Only this cell and the audit fields: other cells of the row may be saving too.
      qc.setQueryData<InventoryData>(
        QUERY_KEY,
        (data) =>
          data && {
            ...data,
            rows: data.rows.map((x) =>
              x.key === row.key
                ? {
                    ...x,
                    inventory: { ...x.inventory, [locationId]: r.row.inventory[locationId] ?? 0 },
                    updatedAt: r.row.updatedAt,
                    updatedBy: r.row.updatedBy,
                  }
                : x,
            ),
          },
      );
      void qc.invalidateQueries({ queryKey: ["catalog"] });
    } catch (e) {
      setCell(row.key, locationId, previous);
      toast.error(errorMessage(e));
      // Someone else changed the stock: load the current numbers.
      if (e instanceof ApiError && e.status === 409) void q.refetch();
      throw e;
    }
  };

  const needle = search.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      (!needle || r.name.toLowerCase().includes(needle) || r.code.toLowerCase().includes(needle)) &&
      (!typeFilter || r.typeId === typeFilter),
  );
  const typeName = (id: string) => types.find((t) => t.id === id)?.name ?? id;

  return (
    <>
      <PageTitle
        title="Үлдэгдэл"
        description="Салбар бүрийн үлдэгдлийг тоон дээр дарж шууд засна. Enter дарах эсвэл гадна дарахад хадгалагдана, Esc дарвал болино."
      />
      <Panel>
        <div className="mb-5 flex flex-wrap gap-3">
          <input
            aria-label="Бүтээгдэхүүн хайх"
            className={`${inputClass} max-w-sm`}
            placeholder="Нэр эсвэл кодоор хайх…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Төрлөөр шүүх"
            className={`${inputClass} max-w-56`}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Бүх төрөл</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        {/* Phones: one card per item, every location editable without sideways scrolling. */}
        <ul className="space-y-3 md:hidden">
          {visible.map((row) => (
            <li key={row.key} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                {row.image ? (
                  <img
                    src={row.image}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded bg-surface object-cover"
                  />
                ) : (
                  <span className="h-12 w-12 shrink-0 rounded bg-surface" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug">{row.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {typeName(row.typeId)} · {row.code || "Кодгүй"}
                    {!row.active && " · Нуусан"}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {locations.map((l) => (
                  <div
                    key={l.id}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-md bg-surface pl-3 pr-1"
                  >
                    <span className="text-sm">{l.name}</span>
                    <StockCell
                      label={`${row.name} — ${l.name}`}
                      value={row.inventory[l.id] ?? 0}
                      onSave={(n) => save(row, l.id, n)}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-border pt-2">
                <span className="text-sm text-muted-foreground">Нийт үлдэгдэл</span>
                <span className="font-display text-lg font-bold tabular-nums">{total(row)}</span>
              </div>
              {row.updatedAt && (
                <p className="text-right text-[11px] text-muted-foreground">
                  {new Date(row.updatedAt).toLocaleString()}
                  {row.updatedBy && ` · ${row.updatedBy}`}
                </p>
              )}
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-10 bg-card pb-3 pr-4">Бүтээгдэхүүн</th>
                <th className="pb-3 pr-4">Төрөл</th>
                {locations.map((l) => (
                  <th key={l.id} className="pb-3 pr-2 text-right">
                    {l.name}
                  </th>
                ))}
                <th className="pb-3 text-right">Нийт үлдэгдэл</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.key} className="border-t border-border">
                  <td className="sticky left-0 z-10 bg-card py-3 pr-4">
                    <div className="flex items-center gap-3">
                      {row.image ? (
                        <img
                          src={row.image}
                          alt=""
                          className="h-11 w-11 shrink-0 rounded bg-surface object-cover"
                        />
                      ) : (
                        <span className="h-11 w-11 shrink-0 rounded bg-surface" />
                      )}
                      <div className="min-w-0">
                        <p className="max-w-56 truncate font-semibold">{row.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {row.code || "Кодгүй"}
                          {!row.active && " · Нуусан"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="pr-4">{typeName(row.typeId)}</td>
                  {locations.map((l) => (
                    <td key={l.id} className="pr-2 text-right">
                      <StockCell
                        label={`${row.name} — ${l.name}`}
                        value={row.inventory[l.id] ?? 0}
                        onSave={(n) => save(row, l.id, n)}
                      />
                    </td>
                  ))}
                  <td className="text-right">
                    <p className="font-display text-base font-bold tabular-nums">{total(row)}</p>
                    {row.updatedAt && (
                      <p className="mt-0.5 whitespace-nowrap text-[11px] text-muted-foreground">
                        {new Date(row.updatedAt).toLocaleString()}
                        {row.updatedBy && ` · ${row.updatedBy}`}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {visible.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border font-semibold">
                  <td className="sticky left-0 z-10 bg-card py-3 pr-4">Нийт</td>
                  <td />
                  {locations.map((l) => (
                    <td key={l.id} className="pr-4 text-right tabular-nums">
                      {visible.reduce((sum, r) => sum + (r.inventory[l.id] ?? 0), 0)}
                    </td>
                  ))}
                  <td className="text-right tabular-nums">
                    {visible.reduce((sum, r) => sum + total(r), 0)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {!visible.length && <Empty />}
      </Panel>
    </>
  );
}

/**
 * A number that turns into an input on click. Enter or leaving the cell saves, Escape
 * cancels. Only whole numbers from 0 up are accepted; a failed save restores the old value.
 */
function StockCell({
  label,
  value,
  onSave,
}: {
  label: string;
  value: number;
  onSave: (quantity: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  // Enter and Escape end the edit before the input's blur event; blur must not act again.
  const finished = useRef(false);
  const start = () => {
    finished.current = false;
    setText(String(value));
    setError(null);
    setEditing(true);
  };
  const commit = async (fromBlur: boolean) => {
    if (finished.current) return;
    const t = text.trim();
    if (!/^\d+$/.test(t) || Number(t) > MAX_STOCK) {
      const message = "Үлдэгдэл 0 эсвэл түүнээс их бүхэл тоо байна.";
      if (!fromBlur) {
        setError(message);
        return;
      }
      // Leaving the cell with an invalid number keeps the saved value.
      finished.current = true;
      setEditing(false);
      toast.error(message);
      return;
    }
    finished.current = true;
    setEditing(false);
    const quantity = Number(t);
    if (quantity === value) return;
    setState("saving");
    try {
      await onSave(quantity);
      setState("saved");
      window.setTimeout(() => setState((s) => (s === "saved" ? "idle" : s)), 1500);
    } catch {
      setState("failed");
    }
  };

  if (editing)
    return (
      <div className="inline-flex flex-col items-end">
        <input
          autoFocus
          aria-label={label}
          aria-invalid={!!error}
          inputMode="numeric"
          className={cn(
            "h-9 w-24 rounded-md border bg-card px-2 text-right text-base tabular-nums outline-none focus:ring-2 focus:ring-ring/30",
            error ? "border-destructive" : "border-input",
          )}
          value={text}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commit(false);
            } else if (e.key === "Escape") {
              finished.current = true;
              setEditing(false);
            }
          }}
          onBlur={() => void commit(true)}
        />
        {error && <span className="mt-1 max-w-40 text-[11px] text-destructive">{error}</span>}
      </div>
    );
  return (
    <button
      type="button"
      onClick={start}
      aria-label={`${label}: ${value}. Засах`}
      title="Засахын тулд дарна уу"
      className={cn(
        "inline-flex h-9 min-w-20 items-center justify-end gap-1.5 rounded-md border border-transparent px-2 tabular-nums transition-colors hover:border-input hover:bg-secondary/60",
        state === "failed" && "border-destructive/50 text-destructive",
      )}
    >
      {state === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      {state === "saved" && <Check className="h-3.5 w-3.5 text-success" />}
      {value}
    </button>
  );
}
