import { Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Layers } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, Btn, QuantityStepper } from "@/components/ui-kit";
import { useCatalog } from "@/lib/catalog-store";
import { mnt } from "@/lib/format";
import { variantPrice, type GlueProduct } from "@/lib/products";
import { useCart } from "@/lib/store";

export function GlueDetail({ product }: { product: GlueProduct }) {
  const navigate = useNavigate();
  const { addItem, ready: cartReady, cartError } = useCart();
  const { products } = useCatalog();
  const [qty, setQty] = useState(1);

  const total = product.price * qty;
  const compatibleCarpets = [...products]
    .filter((p) => p.variants.length > 0)
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 3);

  const addToCart = () => {
    if (!cartReady) {
      toast.error(cartError || "Сагс ачаалж байна. Түр хүлээнэ үү.");
      return;
    }
    if (!Number.isSafeInteger(qty) || qty < 1 || qty > product.stock) {
      toast.error(`Үлдэгдэл ${product.stock} ширхэг. Тоо хэмжээгээ шалгана уу.`);
      return;
    }
    addItem({ kind: "glue", glueSlug: product.slug, quantity: qty });
    toast.success("Сагсанд нэмэгдлээ", {
      description: `${product.name} · ${qty} сав`,
      action: { label: "Сагс руу", onClick: () => navigate({ to: "/cart" }) },
    });
  };

  return (
    <div className="pb-28 lg:pb-16">
      <div className="container-page pt-5 text-xs text-muted-foreground">
        <Link to="/" className="hover:underline">
          Нүүр
        </Link>{" "}
        /{" "}
        <Link to="/products" search={{ category: "glue" }} className="hover:underline">
          Цавуу
        </Link>{" "}
        / <span className="text-foreground">{product.name}</span>
      </div>

      <div className="container-page mt-4 grid gap-10 lg:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-lg border border-border bg-surface">
          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
        </div>

        <div>
          <p className="eyebrow">{product.sku}</p>
          <h1 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl">{product.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="muted">{product.glueTypeLabel}</Badge>
            {product.badge && <Badge>{product.badge}</Badge>}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{product.description}</p>

          <p className="mt-5 font-display text-2xl font-bold">{mnt(product.price)}</p>
          <p className="text-sm text-muted-foreground">
            {product.packageSize} · {product.coverage} m² хамарна
          </p>
          <p
            className={
              product.inStock ? "mt-1 text-sm text-success" : "mt-1 text-sm text-muted-foreground"
            }
          >
            {product.inStock ? "Бэлэн байгаа" : "Түр дууссан"}
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border bg-card p-5 text-sm">
            {[
              ["Төрөл", product.glueTypeLabel],
              ["Савлагаа", product.packageSize],
              ["Хамрах талбай", `${product.coverage} m²`],
              ["Код", product.sku],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>

          <section className="mt-6">
            <h2 className="font-display text-lg font-bold">Ашиглах заавар</h2>
            <ol className="mt-3 space-y-2">
              {product.usage.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-6">
            <h2 className="font-display text-lg font-bold">Тохирох гадаргуу</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {product.surfaces.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" /> {s}
                </span>
              ))}
            </div>
          </section>

          <section className="mt-8 rounded-lg border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-sm font-medium">Тоо ширхэг (сав)</span>
                <div className="mt-2">
                  <QuantityStepper value={qty} onChange={setQty} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Нийт дүн</p>
                <p className="font-display text-xl font-bold">{mnt(total)}</p>
              </div>
            </div>
            <Btn
              size="lg"
              className="mt-4 hidden w-full lg:flex"
              onClick={addToCart}
              disabled={!product.inStock}
            >
              Сагсанд хийх
            </Btn>
          </section>
        </div>
      </div>

      <section className="container-page mt-16">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <Layers className="h-5 w-5 text-accent" /> Энэ цавуутай тохирох хивс
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {compatibleCarpets.map((p) => (
            <Link
              key={p.slug}
              to="/products/$slug"
              params={{ slug: p.slug }}
              className="flex gap-4 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-secondary/40"
            >
              <span className="grid h-20 w-20 shrink-0 place-items-center rounded-md bg-surface">
                <img
                  src={p.variants[0]!.image}
                  alt={p.name}
                  loading="lazy"
                  className="h-full w-full object-contain p-1.5"
                />
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{p.name}</p>
                <p className="truncate text-sm text-muted-foreground">{p.short}</p>
                <p className="mt-1 text-sm font-semibold">{mnt(variantPrice(p, p.variants[0]!))}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 p-3 backdrop-blur lg:hidden">
        <div className="container-page grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-0">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Нийт дүн</p>
            <p className="truncate font-display text-lg font-bold">{mnt(total)}</p>
          </div>
          <Btn size="lg" onClick={addToCart} disabled={!product.inStock}>
            Сагсанд хийх
          </Btn>
        </div>
      </div>
    </div>
  );
}
