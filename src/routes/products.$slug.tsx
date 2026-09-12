import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Calculator, Droplets, Eye, Info, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { GlueDetail } from "@/components/glue-detail";
import {
  Badge,
  Btn,
  ColorSwatch,
  EmptyState,
  Field,
  OptionCard,
  QuantityStepper,
  SummaryRow,
  TextInput,
} from "@/components/ui-kit";
import { useCatalog } from "@/lib/catalog-store";
import { m2, mnt } from "@/lib/format";
import {
  recommendGlueQty,
  variantInStock,
  variantPrice,
  variantThickness,
  type CatalogEntry,
} from "@/lib/products";
import { useCart } from "@/lib/store";
import { cn } from "@/lib/utils";

type Search = { color?: string | undefined };

export const Route = createFileRoute("/products/$slug")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    color: typeof search["color"] === "string" ? (search["color"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Бүтээгдэхүүний дэлгэрэнгүй | JINTEMO" },
      {
        name: "description",
        content: "JINTEMO хивс, цавууны дэлгэрэнгүй мэдээлэл, өнгөний сонголт, захиалга.",
      },
    ],
  }),
  component: ProductDetail,
});

function ProductDetail() {
  const { slug } = Route.useParams();
  const { getAnyProduct, ready, glues: glueProducts } = useCatalog();

  if (!ready) {
    return (
      <div className="container-page py-16">
        <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-6 grid gap-10 lg:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-md bg-muted" />
          <div className="space-y-4">
            <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-24 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  const product = getAnyProduct(slug);

  if (!product || (product.kind === "carpet" && !product.variants.length)) {
    return (
      <div className="container-page py-20">
        <EmptyState
          icon={X}
          title="Бүтээгдэхүүн олдсонгүй"
          description="Энэ холбоос хүчингүй эсвэл бүтээгдэхүүн устгагдсан байж болзошгүй."
          action={
            <Link
              to="/products"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground"
            >
              Бүтээгдэхүүн үзэх
            </Link>
          }
        />
      </div>
    );
  }

  if (product.kind === "glue") return <GlueDetail product={product} />;
  return <CarpetDetail product={product} />;
}

const COLOR_GRID_LIMIT = 12;

function CarpetDetail({ product }: { product: Extract<CatalogEntry, { kind: "carpet" }> }) {
  const navigate = useNavigate();
  const { color: colorParam } = Route.useSearch();
  const { addItem, ready: cartReady, cartError } = useCart();
  const { products, glues: glueProducts } = useCatalog();

  const firstVariant = product.variants[0]!;
  const initialVariantId =
    (colorParam && product.variants.find((v) => v.id === colorParam)?.id) ?? firstVariant.id;
  const [variantId, setVariantId] = useState(initialVariantId);
  const variant = product.variants.find((v) => v.id === variantId) ?? firstVariant;
  const gallery = useMemo(
    () => [variant.image, ...(variant.gallery ?? []), ...product.gallery],
    [variant, product.gallery],
  );
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [showAllColors, setShowAllColors] = useState(false);

  const price = variantPrice(product, variant);
  const thickness = variantThickness(product, variant);
  const inStock = variantInStock(variant);

  const [length, setLength] = useState("4.0");
  const [width, setWidth] = useState("3.5");
  const tileArea = product.tileSize * product.tileSize;

  // Area is used exactly as measured — no automatic waste percentage is added.
  // Any cutting allowance is discussed with the customer separately.
  const roomArea = (parseFloat(length) || 0) * (parseFloat(width) || 0);
  const suggestedPieces = Math.max(1, Math.ceil(roomArea / tileArea));

  const [pieces, setPieces] = useState(suggestedPieces);
  const [manual, setManual] = useState(false);
  const effectivePieces = manual ? pieces : suggestedPieces;

  const [glueChoice, setGlueChoice] = useState<"none" | string>("none");
  const selectedGlue =
    glueChoice === "none" ? undefined : glueProducts.find((g) => g.slug === glueChoice);
  const [glueQty, setGlueQty] = useState(1);
  const [glueManual, setGlueManual] = useState(false);

  useEffect(() => {
    if (glueManual || !selectedGlue) return;
    setGlueQty(recommendGlueQty(roomArea, selectedGlue.coverage));
  }, [selectedGlue, roomArea, glueManual]);

  const goods = price * effectivePieces;
  const glueTotal = selectedGlue ? selectedGlue.price * glueQty : 0;
  const total = goods + glueTotal;

  const addToCart = () => {
    if (!cartReady) {
      toast.error(cartError || "Сагс ачаалж байна. Түр хүлээнэ үү.");
      return;
    }
    if (
      !Number.isSafeInteger(effectivePieces) ||
      effectivePieces < 1 ||
      effectivePieces > variant.stock
    ) {
      toast.error(`Үлдэгдэл ${variant.stock} ширхэг. Тоо хэмжээгээ шалгана уу.`);
      return;
    }
    if (
      selectedGlue &&
      (glueQty > selectedGlue.stock || glueQty < 1 || !Number.isSafeInteger(glueQty))
    ) {
      toast.error("Цавууны үлдэгдэл, тоо хэмжээгээ шалгана уу.");
      return;
    }
    addItem({
      kind: "carpet",
      productSlug: product.slug,
      colorId: variant.id,
      pieces: effectivePieces,
    });
    if (selectedGlue) {
      addItem({ kind: "glue", glueSlug: selectedGlue.slug, quantity: glueQty });
    }
    toast.success("Сагсанд нэмэгдлээ", {
      description: `${product.name} · ${variant.name} · ${effectivePieces} ширхэг`,
    });
    navigate({ to: "/cart" });
  };

  const related = products
    .filter((p) => p.slug !== product.slug && p.variants.length > 0)
    .slice(0, 3);

  const visibleColors = showAllColors
    ? product.variants
    : product.variants.slice(0, COLOR_GRID_LIMIT);
  const hasMoreColors = product.variants.length > COLOR_GRID_LIMIT;

  return (
    <div className="pb-28 lg:pb-16">
      <div className="container-page pt-5 text-xs text-muted-foreground">
        <Link to="/" className="hover:underline">
          Нүүр
        </Link>{" "}
        /{" "}
        <Link to="/products" className="hover:underline">
          Бүтээгдэхүүн
        </Link>{" "}
        / <span className="text-foreground">{product.name}</span>
      </div>

      <div className="container-page mt-4 grid gap-10 lg:grid-cols-2">
        {/* Gallery — full carpet tile always visible, never cropped */}
        <div>
          <div
            className={cn(
              "relative aspect-square overflow-hidden rounded-md border border-border bg-surface",
              zoom ? "cursor-zoom-out" : "cursor-zoom-in",
            )}
            onClick={() => setZoom((v) => !v)}
          >
            <img
              src={gallery[active]}
              alt={`${product.name} — ${variant.name}`}
              className={cn(
                "h-full w-full object-contain p-6 transition-transform duration-500",
                zoom && "scale-[1.8]",
              )}
            />
            <span className="absolute left-3 top-3 flex gap-2">
              {product.badge && <Badge>{product.badge}</Badge>}
            </span>
            <span className="absolute bottom-3 right-3 rounded-full bg-card/90 px-3 py-1 text-[11px] text-muted-foreground">
              Томруулж харах
            </span>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-3">
            {gallery.map((g, i) => (
              <button
                key={i}
                onClick={() => {
                  setActive(i);
                  setZoom(false);
                }}
                className={cn(
                  "grid aspect-square place-items-center overflow-hidden rounded-md border-2 bg-surface",
                  i === active ? "border-accent" : "border-border",
                )}
              >
                <img src={g} alt="" loading="lazy" className="h-full w-full object-contain p-1.5" />
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div>
          <p className="eyebrow">Код: {variant.code}</p>
          <h1 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl">{product.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{product.description}</p>

          <p className="mt-5 font-display text-2xl font-bold">{mnt(price)}</p>
          <p className="text-sm text-muted-foreground">1 ширхэг · {mnt(price / tileArea)}/m²</p>
          <p className={cn("mt-1 text-sm", inStock ? "text-success" : "text-muted-foreground")}>
            {inStock ? "Бэлэн байгаа" : "Түр дууссан"}
          </p>

          <div className="mt-6">
            <p className="text-sm font-semibold">Сонгосон өнгө: {variant.name}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {visibleColors.map((v) => (
                <ColorSwatch
                  key={v.id}
                  hex={v.hex}
                  name={v.name}
                  selected={v.id === variantId}
                  onSelect={() => {
                    setVariantId(v.id);
                    setActive(0);
                  }}
                />
              ))}
            </div>
            {hasMoreColors && (
              <button
                type="button"
                onClick={() => setShowAllColors((v) => !v)}
                className="mt-3 text-xs font-medium text-accent hover:underline"
              >
                {showAllColors ? "Хураах" : `Бүх өнгө харах (${product.variants.length})`}
              </button>
            )}
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border bg-card p-5 text-sm">
            {[
              ["Хэмжээ", `${product.tileSize * 100}×${product.tileSize * 100} см`],
              ["Зузаан", thickness],
              ["Материал", product.material],
              ["Код", variant.code],
              ["Үйлдвэрлэсэн улс", product.origin],
              ["Бэлэн үлдэгдэл", `${variant.stock} ширхэг`],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>

          {/* Calculator */}
          <section className="mt-8 rounded-lg border border-border bg-surface p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Calculator className="h-5 w-5 text-accent" />
              Хэдэн ширхэг хэрэгтэйгээ тооцоолох
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Өрөөний урт (м)">
                <TextInput
                  inputMode="decimal"
                  value={length}
                  onChange={(e) => {
                    setLength(e.target.value.replace(",", "."));
                    setManual(false);
                  }}
                />
              </Field>
              <Field label="Өрөөний өргөн (м)">
                <TextInput
                  inputMode="decimal"
                  value={width}
                  onChange={(e) => {
                    setWidth(e.target.value.replace(",", "."));
                    setManual(false);
                  }}
                />
              </Field>
            </div>

            <div className="mt-4 rounded-md border border-border bg-card p-4">
              <SummaryRow label="Өрөөний талбай" value={m2(roomArea)} />
              <SummaryRow label="Хэрэгцээт хэмжээ" value={`${suggestedPieces} ширхэг`} />
              <SummaryRow label="Бүтээгдэхүүний дүн" value={mnt(price * effectivePieces)} strong />
            </div>

            <p className="mt-3 flex gap-2 text-xs leading-relaxed text-muted-foreground">
              <Info className="h-4 w-4 shrink-0" />
              Зүсэлт болон өрөөний хэлбэрээс шалтгаалан шаардлагатай хэмжээ өөрчлөгдөж болно.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium">Тоо ширхэг:</span>
              <QuantityStepper
                value={effectivePieces}
                onChange={(v) => {
                  setManual(true);
                  setPieces(v);
                }}
              />
              {manual && (
                <button className="text-xs text-accent underline" onClick={() => setManual(false)}>
                  Тооцоолсон дүнг сэргээх
                </button>
              )}
            </div>
          </section>

          {/* Glue recommendation — real, separately purchasable products */}
          <section className="mt-8">
            <h2 className="font-display text-lg font-bold">Цавуу хэрэгтэй юу?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Сонгосон цавуу таны сагсанд тусдаа мөр болон нэмэгдэнэ — хожим тоо хэмжээг өөрчлөх,
              устгах боломжтой.
            </p>

            <div className="mt-3 space-y-2">
              <OptionCard
                selected={glueChoice === "none"}
                onSelect={() => {
                  setGlueChoice("none");
                  setGlueManual(false);
                }}
                title="Цавуугүй үргэлжлүүлэх"
                description="Хивсийг цавуугүйгээр эсвэл өөрийн цавуугаар суурилуулна."
                price={0}
              />
              {glueProducts.map((g) => {
                const qty =
                  glueChoice === g.slug ? glueQty : recommendGlueQty(roomArea, g.coverage);
                return (
                  <div key={g.slug}>
                    <OptionCard
                      selected={glueChoice === g.slug}
                      onSelect={() => {
                        setGlueChoice(g.slug);
                        setGlueManual(false);
                      }}
                      icon={<Droplets className="h-4 w-4" />}
                      title={`${g.name} · ${g.glueTypeLabel}`}
                      description={`Хамрах талбай: ${g.coverage} m²/сав · Санал болгож буй тоо: ${qty} сав`}
                      price={g.price * qty}
                    />
                    {glueChoice === g.slug && (
                      <div className="mt-2 ml-8 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
                        <img
                          src={g.image}
                          alt={g.name}
                          className="h-12 w-12 rounded-md object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">
                            Таны сонгосон талбайд ойролцоогоор{" "}
                            {recommendGlueQty(roomArea, g.coverage)} сав хэрэгтэй.
                          </p>
                          <p className="text-sm font-semibold">{mnt(g.price)} / сав</p>
                        </div>
                        <QuantityStepper
                          value={glueQty}
                          onChange={(v) => {
                            setGlueManual(true);
                            setGlueQty(v);
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <Link
              to="/products"
              search={{ category: "glue" }}
              className="mt-3 inline-block text-xs text-accent hover:underline"
            >
              Бүх цавууны сонголтыг үзэх →
            </Link>
          </section>

          {/* Installation is chosen later, at checkout — no forms or pricing here. */}
          <div className="mt-6 flex gap-2 rounded-lg border border-border bg-surface p-4 text-xs leading-relaxed text-muted-foreground">
            <Info className="h-4 w-4 shrink-0" />
            Мэргэжлийн суурилуулалт хэрэгтэй бол захиалгын үед сонгоно. Суурилуулалт сонгосон
            тохиолдолд хүргэлт үнэгүй болно.
          </div>

          {/* Desktop price summary */}
          <section className="mt-8 hidden rounded-lg border border-border bg-card p-5 lg:block">
            <SummaryRow label={`Хивс (${effectivePieces} ш)`} value={mnt(goods)} />
            <SummaryRow
              label={selectedGlue ? `${selectedGlue.name} (${glueQty} сав)` : "Цавуу"}
              value={mnt(glueTotal)}
            />
            <SummaryRow label="Одоогийн нийт" value={mnt(total)} strong />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Btn size="lg" onClick={addToCart} disabled={!inStock}>
                Сагсанд нэмэх
              </Btn>
              <Link
                to="/visualizer"
                search={{ slug: product.slug }}
                className="inline-flex h-13 items-center justify-center gap-2 rounded-md border border-border px-5 text-base font-medium transition-colors hover:bg-secondary"
              >
                <Eye className="h-4 w-4" /> Өрөөндөө үзэх
              </Link>
            </div>
          </section>
        </div>
      </div>

      {/* Related */}
      <section className="container-page mt-16">
        <h2 className="font-display text-xl font-bold">Төстэй бүтээгдэхүүн</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((p) => (
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

      {/* Mobile sticky */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 p-3 backdrop-blur lg:hidden">
        <div className="container-page grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-0">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Одоогийн нийт</p>
            <p className="truncate font-display text-lg font-bold">{mnt(total)}</p>
          </div>
          <Btn size="lg" onClick={addToCart} disabled={!inStock}>
            Сагсанд нэмэх
          </Btn>
        </div>
      </div>
    </div>
  );
}
