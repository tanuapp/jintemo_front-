import { Link } from "@tanstack/react-router";
import { ArrowRight, GitCompare, Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui-kit";
import { mnt } from "@/lib/format";
import {
  productInStock,
  variantInStock,
  variantPrice,
  variantThickness,
  type Product,
} from "@/lib/products";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

const MAX_VISIBLE_SWATCHES = 4;

export function ProductCard({
  product,
  appearance = "card",
  initialVariantId,
}: {
  product: Product;
  appearance?: "card" | "editorial";
  initialVariantId?: string;
}) {
  const first = product.variants[0]!;
  const preferred = product.variants.some((v) => v.id === initialVariantId)
    ? initialVariantId!
    : first.id;
  const [variantId, setVariantId] = useState(preferred);
  const variant = product.variants.find((v) => v.id === variantId) ?? first;
  const { compareIds, toggleCompare, wishlistIds, toggleWishlist } = useUi();
  const comparing = compareIds.includes(product.slug);
  const saved = wishlistIds.includes(product.slug);
  const price = variantPrice(product, variant);
  const showOldPrice = typeof product.oldPrice === "number" && product.oldPrice > price;
  const discountPercent = showOldPrice
    ? Math.round(((product.oldPrice! - price) / product.oldPrice!) * 100)
    : 0;
  const inStock = variantInStock(variant);
  const modelInStock = productInStock(product);

  useEffect(() => {
    setVariantId(preferred);
  }, [preferred, product.slug]);

  // Carry the previewed colour into the detail page so the SKU matches.
  const detailLink = {
    to: "/products/$slug" as const,
    params: { slug: product.slug },
    search: { color: variant.id },
  };

  const visibleColors = product.variants.slice(0, MAX_VISIBLE_SWATCHES);
  const hiddenColorCount = product.variants.length - visibleColors.length;

  return (
    <article
      className={cn(
        "group flex flex-col",
        appearance === "card"
          ? "h-full overflow-hidden rounded-md border border-border/80 bg-card transition-colors hover:border-foreground/20"
          : "bg-transparent",
      )}
    >
      {/* Image — full tile always visible (contain, never cropped) */}
      <div className="relative">
        <Link
          {...detailLink}
          aria-label={`${product.name} — дэлгэрэнгүй`}
          className={cn(
            "relative block overflow-hidden bg-surface",
            appearance === "card" ? "h-[230px] bg-card" : "h-[230px] rounded-md",
          )}
        >
          <img
            src={variant.image}
            alt={`${product.name} — ${variant.name}`}
            loading="lazy"
            width={900}
            height={900}
            className={cn(
              "h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.03]",
              appearance === "card" ? "p-0" : "p-7",
            )}
          />
          {/* Subtle hover affordance — desktop only (no hover on touch) */}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 hidden justify-center p-3 md:flex">
            <span className="translate-y-2 rounded-full bg-card/90 px-3 py-1 text-[11px] font-medium text-foreground opacity-0 shadow-soft backdrop-blur transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
              Дэлгэрэнгүй
            </span>
          </span>
        </Link>
        <span className="pointer-events-none absolute left-3 top-3 flex gap-2">
          {appearance === "card" ? (
            <>
              {!modelInStock && <Badge tone="soldout">Дууссан</Badge>}
              {showOldPrice && <Badge tone="sale">−{discountPercent}%</Badge>}
              {inStock && !showOldPrice && product.badge === "Шинээр ирсэн" && (
                <Badge tone="new">Шинээр ирсэн</Badge>
              )}
              {inStock && !showOldPrice && product.badge === "Онцлох" && (
                <Badge tone="featured">Онцлох</Badge>
              )}
            </>
          ) : (
            <>
              {product.badge && <Badge>{product.badge}</Badge>}
              {!inStock && <Badge tone="muted">Дууссан</Badge>}
            </>
          )}
        </span>

        {/* Subtle floating icon buttons — hover on desktop, always visible on touch */}
        <div className="product-card-actions absolute right-3 top-3 flex flex-col gap-2 transition-opacity">
          <button
            type="button"
            aria-label={saved ? "Хадгалснаас хасах" : "Хадгалах"}
            aria-pressed={saved}
            onClick={() => toggleWishlist(product.slug)}
            className="grid h-9 w-9 place-items-center rounded-full bg-card/95 shadow-soft backdrop-blur transition-colors hover:bg-card"
          >
            <Heart
              className={cn("h-4 w-4", saved ? "fill-accent text-accent" : "text-foreground")}
            />
          </button>
          <button
            type="button"
            aria-label="Харьцуулах"
            aria-pressed={comparing}
            onClick={() => toggleCompare(product.slug)}
            className="grid h-9 w-9 place-items-center rounded-full bg-card/95 shadow-soft backdrop-blur transition-colors hover:bg-card"
          >
            <GitCompare className={cn("h-4 w-4", comparing ? "text-accent" : "text-foreground")} />
          </button>
        </div>
      </div>

      {/* Info — clean catalog layout: name → colours → spec → availability → price → CTA */}
      <div
        className={cn(
          "flex flex-col gap-2",
          appearance === "card" ? "flex-1 p-4" : "px-0 pb-0 pt-4",
        )}
      >
        <Link {...detailLink} className="min-w-0">
          <h3 className="font-display text-[15px] font-bold leading-snug hover:text-accent sm:text-base">
            {product.name}
          </h3>
        </Link>

        {product.variants.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {visibleColors.map((v) => (
              <button
                key={v.id}
                type="button"
                title={v.name}
                aria-label={v.name}
                aria-pressed={v.id === variantId}
                onClick={() => setVariantId(v.id)}
                className={cn(
                  "h-4 w-4 rounded-full border transition-transform hover:scale-110",
                  v.id === variantId ? "border-foreground/60" : "border-border",
                )}
                style={{ backgroundColor: v.hex }}
              />
            ))}
            {hiddenColorCount > 0 && (
              <span className="text-[11px] text-muted-foreground">+{hiddenColorCount}</span>
            )}
          </div>
        )}

        <p className="text-[13px] text-muted-foreground">
          {product.tileSize * 100}×{product.tileSize * 100} см ·{" "}
          {variantThickness(product, variant)}
        </p>

        {appearance === "editorial" && (
          <p
            className={cn(
              "text-[13px] font-medium",
              inStock ? "text-success" : "text-muted-foreground",
            )}
          >
            {inStock ? "Бэлэн байгаа" : "Захиалгаар"}
          </p>
        )}

        <div
          className={cn(
            "flex flex-wrap items-baseline gap-x-2 gap-y-1 pt-1",
            appearance === "card" && "mt-auto",
          )}
        >
          <span className="font-display text-[19px] font-bold">{mnt(price)}</span>
          <span className="text-[13px] font-medium text-muted-foreground">/ ширхэг</span>
          {showOldPrice && (
            <span className="text-sm text-muted-foreground line-through">
              {mnt(product.oldPrice!)}
            </span>
          )}
        </div>

        {appearance === "card" && (
          <p
            className={cn(
              "text-[13px] font-medium",
              inStock ? "text-success" : "text-muted-foreground",
            )}
          >
            {inStock ? "Бэлэн байгаа" : "Дууссан"}
          </p>
        )}

        <div className="space-y-2 pt-1">
          {inStock || appearance === "editorial" ? (
            <Link
              {...detailLink}
              className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-6 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Захиалах
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex h-11 w-full cursor-not-allowed items-center justify-center rounded-md bg-secondary px-6 text-base font-medium text-muted-foreground"
            >
              Дууссан
            </button>
          )}
          {appearance === "card" && (
            <Link
              {...detailLink}
              className="flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none"
            >
              Дэлгэрэнгүй <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
