import { Link } from "@tanstack/react-router";
import { Droplets, Trash2 } from "lucide-react";
import { QuantityStepper } from "@/components/ui-kit";
import { useCatalog } from "@/lib/catalog-store";
import { m2, mnt } from "@/lib/format";
import { variantThickness } from "@/lib/products";
import { itemTotal, useCart, type CartItem } from "@/lib/store";

export function CarpetLine({
  item,
  onRemove,
}: {
  item: Extract<CartItem, { kind: "carpet" }>;
  onRemove: () => void;
}) {
  const { updateItem } = useCart();
  const { products, glues, getProduct, getGlueProduct } = useCatalog();
  const product = getProduct(item.productSlug);
  if (!product) return <UnavailableLine name={item.productSlug} onRemove={onRemove} />;
  const variant = product.variants.find((v) => v.id === item.colorId);
  if (!variant)
    return <UnavailableLine name={`${product.name} / ${item.colorId}`} onRemove={onRemove} />;
  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex gap-4">
        <div className="grid h-24 w-24 shrink-0 place-items-center rounded-md bg-surface p-1.5">
          <img
            src={variant.image}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-contain"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link to="/products/$slug" params={{ slug: product.slug }}>
                <h2 className="truncate font-display font-bold">{product.name}</h2>
              </Link>
              <p className="text-sm text-muted-foreground">
                Өнгө: {variant.name} · Код: {variant.code}
              </p>
              <p className="text-sm text-muted-foreground">
                {product.tileSize * 100}×{product.tileSize * 100} см · Зузаан:{" "}
                {variantThickness(product, variant)} ·{" "}
                {m2(item.pieces * product.tileSize * product.tileSize)}
              </p>
            </div>
            <button
              aria-label="Устгах"
              onClick={onRemove}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <QuantityStepper
              value={item.pieces}
              onChange={(v) => updateItem(item.id, { pieces: v })}
            />
            <p className="font-display font-bold">{mnt(itemTotal(item, products, glues))}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

export function GlueLine({
  item,
  onRemove,
}: {
  item: Extract<CartItem, { kind: "glue" }>;
  onRemove: () => void;
}) {
  const { updateItem } = useCart();
  const { products, glues, getGlueProduct } = useCatalog();
  const glue = getGlueProduct(item.glueSlug);
  if (!glue) return <UnavailableLine name={item.glueSlug} onRemove={onRemove} />;
  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex gap-4">
        <img
          src={glue.image}
          alt={glue.name}
          loading="lazy"
          className="h-24 w-24 shrink-0 rounded-md object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link to="/products/$slug" params={{ slug: glue.slug }}>
                <h2 className="truncate font-display font-bold">{glue.name}</h2>
              </Link>
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <Droplets className="h-3.5 w-3.5" /> Цавуу · {glue.glueTypeLabel} ·{" "}
                {glue.packageSize}
              </p>
            </div>
            <button
              aria-label="Устгах"
              onClick={onRemove}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <QuantityStepper
              value={item.quantity}
              onChange={(v) => updateItem(item.id, { quantity: v })}
            />
            <p className="font-display font-bold">{mnt(itemTotal(item, products, glues))}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

export function CartLine({ item, onRemove }: { item: CartItem; onRemove: () => void }) {
  if (item.kind === "carpet") return <CarpetLine item={item} onRemove={onRemove} />;
  return <GlueLine item={item} onRemove={onRemove} />;
}

function UnavailableLine({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <article className="rounded-lg border border-destructive/30 bg-card p-4">
      <p className="font-semibold">{name}</p>
      <p className="mt-1 text-sm text-destructive">
        Энэ бараа эсвэл өнгө худалдаанд байхгүй. Сагснаас хасаад өөр сонголт хийнэ үү.
      </p>
      <button
        className="mt-3 flex items-center gap-2 text-sm font-medium text-destructive"
        onClick={onRemove}
      >
        <Trash2 size={16} />
        Сагснаас хасах
      </button>
    </article>
  );
}
