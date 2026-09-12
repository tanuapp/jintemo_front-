import { Link, useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Btn } from "@/components/ui-kit";
import { useCatalog } from "@/lib/catalog-store";
import { mnt } from "@/lib/format";
import { productInStock, variantPrice, type Product } from "@/lib/products";
import { useUi } from "@/lib/ui-store";

type Row = { label: string; render: (p: Product) => ReactNode };

const rows: Row[] = [
  {
    label: "Зураг",
    render: (p) => (
      <span className="grid h-20 w-20 place-items-center rounded-md bg-surface">
        <img
          src={p.variants[0]!.image}
          alt={p.name}
          className="h-full w-full object-contain p-1.5"
        />
      </span>
    ),
  },
  { label: "Нэр", render: (p) => <span className="font-display font-bold">{p.name}</span> },
  {
    label: "Үнэ",
    render: (p) => <span className="font-semibold">{mnt(variantPrice(p, p.variants[0]!))}</span>,
  },
  { label: "Хэмжээ", render: (p) => `${p.tileSize * 100}×${p.tileSize * 100} см` },
  { label: "Материал", render: (p) => p.material },
  {
    label: "Өнгө",
    render: (p) => (
      <div className="flex flex-wrap gap-1">
        {p.variants.map((v) => (
          <span
            key={v.id}
            title={v.name}
            className="h-5 w-5 rounded-full border border-border"
            style={{ backgroundColor: v.hex }}
          />
        ))}
      </div>
    ),
  },
  { label: "Зузаан", render: (p) => p.thickness },
  { label: "Өрөөний төрөл", render: (p) => p.rooms.join(", ") },
  {
    label: "Бэлэн байгаа эсэх",
    render: (p) => (
      <span className={productInStock(p) ? "text-success" : "text-muted-foreground"}>
        {productInStock(p) ? "Тийм" : "Захиалгаар"}
      </span>
    ),
  },
  { label: "Суурилуулахад тохиромжтой эсэх", render: () => "Тийм" },
  { label: "Preview available эсэх", render: () => "Тийм" },
];

export function CompareView() {
  const { compareOpen, closeCompareView, compareIds, removeFromCompare } = useUi();
  const { getProduct } = useCatalog();
  const navigate = useNavigate();

  const products = compareIds
    .map((slug) => getProduct(slug))
    .filter((p): p is Product => Boolean(p && p.variants.length));

  return (
    <Dialog open={compareOpen} onOpenChange={(open) => !open && closeCompareView()}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-5xl overflow-y-auto p-5">
        <DialogHeader>
          <DialogTitle className="font-display">Бүтээгдэхүүн харьцуулах</DialogTitle>
        </DialogHeader>

        {products.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Харьцуулах бүтээгдэхүүн сонгогдоогүй байна.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="grid min-w-[600px] gap-x-4 gap-y-3"
              style={{ gridTemplateColumns: `9rem repeat(${products.length}, minmax(11rem, 1fr))` }}
            >
              {rows.map((row) => (
                <Fragment key={row.label}>
                  <div className="self-center text-sm font-semibold text-muted-foreground">
                    {row.label}
                  </div>
                  {products.map((p) => (
                    <div key={`${row.label}-${p.slug}`} className="self-center text-sm">
                      {row.render(p)}
                    </div>
                  ))}
                </Fragment>
              ))}

              <div />
              {products.map((p) => (
                <div key={`actions-${p.slug}`} className="flex flex-col gap-2 pt-2">
                  <Btn
                    size="md"
                    onClick={() => {
                      closeCompareView();
                      navigate({ to: "/products/$slug", params: { slug: p.slug } });
                    }}
                  >
                    Захиалах
                  </Btn>
                  <button
                    type="button"
                    onClick={() => removeFromCompare(p.slug)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium text-muted-foreground hover:bg-secondary"
                  >
                    <X className="h-3.5 w-3.5" /> Хасах
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link
          to="/products"
          search={{ category: "carpet" }}
          onClick={closeCompareView}
          className="text-sm text-accent hover:underline"
        >
          Бусад хивс үзэх
        </Link>
      </DialogContent>
    </Dialog>
  );
}
