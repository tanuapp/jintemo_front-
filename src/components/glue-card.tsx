import { Link } from "@tanstack/react-router";
import { ArrowRight, Heart, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Badge, Btn } from "@/components/ui-kit";
import { mnt } from "@/lib/format";
import type { GlueProduct } from "@/lib/products";
import { useCart } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

export function GlueCard({ product }: { product: GlueProduct }) {
  const { addItem, ready: cartReady } = useCart();
  const { wishlistIds, toggleWishlist } = useUi();
  const saved = wishlistIds.includes(product.slug);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-md border border-border/80 bg-card transition-colors hover:border-foreground/20">
      <div className="relative">
        <Link
          to="/products/$slug"
          params={{ slug: product.slug }}
          className="relative block h-[230px] overflow-hidden bg-surface"
        >
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            width={900}
            height={900}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </Link>
        <span className="pointer-events-none absolute left-3 top-3 flex gap-2">
          {!product.inStock && <Badge tone="soldout">Дууссан</Badge>}
          {product.inStock && product.badge === "Шинээр ирсэн" && (
            <Badge tone="new">Шинээр ирсэн</Badge>
          )}
          {product.inStock && product.badge === "Онцлох" && <Badge tone="featured">Онцлох</Badge>}
        </span>
        <div className="product-card-actions absolute right-3 top-3 transition-opacity">
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
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="min-w-0">
          <Link to="/products/$slug" params={{ slug: product.slug }}>
            <h3 className="font-display text-[15px] font-bold leading-snug sm:text-base">
              {product.name}
            </h3>
          </Link>
        </div>

        <p className="text-[13px] text-muted-foreground">
          {product.packageSize} · {product.coverage} m² / сав
        </p>

        <div className="mt-auto flex flex-wrap items-baseline gap-2 pt-1">
          <p className="font-display text-[19px] font-bold">{mnt(product.price)}</p>
          <span className="text-[13px] font-medium text-muted-foreground">/ сав</span>
        </div>

        <p
          className={cn(
            "text-[13px] font-medium",
            product.inStock ? "text-success" : "text-muted-foreground",
          )}
        >
          {product.inStock ? "Бэлэн байгаа" : "Дууссан"}
        </p>

        <div className="space-y-2 pt-1">
          <Btn
            variant="primary"
            className="h-11 w-full"
            disabled={!product.inStock || !cartReady}
            onClick={() => {
              addItem({ kind: "glue", glueSlug: product.slug, quantity: 1 });
              toast.success("Сагсанд нэмэгдлээ", { description: `${product.name} · 1 сав` });
            }}
          >
            <ShoppingBag className="h-4 w-4" />
            {product.inStock ? "Сагсанд хийх" : "Дууссан"}
          </Btn>
          <Link
            to="/products/$slug"
            params={{ slug: product.slug }}
            className="flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none"
          >
            Дэлгэрэнгүй <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
