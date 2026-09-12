import { X } from "lucide-react";
import { Btn } from "@/components/ui-kit";
import { useCatalog } from "@/lib/catalog-store";
import { useUi } from "@/lib/ui-store";

export function CompareBar() {
  const { compareIds, clearCompare, openCompareView } = useUi();
  const { getProduct } = useCatalog();
  if (compareIds.length === 0) return null;

  const products = compareIds
    .map((slug) => getProduct(slug))
    .filter((p): p is NonNullable<typeof p> => Boolean(p && p.variants.length));

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 lg:inset-x-auto lg:bottom-6 lg:right-6">
      <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-t-xl border border-border bg-card/95 p-3 shadow-lift backdrop-blur lg:w-[22rem] lg:rounded-xl">
        <div className="flex -space-x-2">
          {products.slice(0, 4).map((p) => (
            <img
              key={p.slug}
              src={p.variants[0]!.image}
              alt={p.name}
              className="h-10 w-10 shrink-0 rounded-full border-2 border-card bg-surface object-contain p-0.5"
            />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {compareIds.length} бүтээгдэхүүн сонгогдсон
          </p>
        </div>
        <button
          type="button"
          aria-label="Цэвэрлэх"
          onClick={clearCompare}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary"
        >
          <X className="h-4 w-4" />
        </button>
        <Btn size="md" onClick={openCompareView} className="shrink-0">
          Харьцуулах
        </Btn>
      </div>
    </div>
  );
}
