import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Image as ImageIcon, Info, RefreshCw, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Btn, ColorSwatch } from "@/components/ui-kit";
import { useCatalog } from "@/lib/catalog-store";
import { variantThickness } from "@/lib/products";
import { cn } from "@/lib/utils";

type Search = { slug?: string | undefined };

export const Route = createFileRoute("/visualizer")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    slug: typeof search["slug"] === "string" ? (search["slug"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Өрөөндөө туршиж үзэх — хивсний урьдчилсан харагдац | JINTEMO" },
      {
        name: "description",
        content:
          "Өрөөнийхөө зургийг оруулаад сонгосон Японы модуль хивс хэрхэн харагдахыг урьдчилж үзээрэй.",
      },
      { property: "og:title", content: "Өрөөндөө туршиж үзэх | JINTEMO" },
      {
        property: "og:description",
        content: "Хивсний урьдчилсан харагдацыг өөрийн өрөөний зурган дээр үзнэ.",
      },
    ],
  }),
  component: Visualizer,
});

function Visualizer() {
  const { slug } = Route.useSearch();
  const navigate = useNavigate();
  const { products: allProducts, ready } = useCatalog();
  const products = allProducts.filter((p) => p.variants.length > 0);
  const fileRef = useRef<HTMLInputElement>(null);

  const fallback = products[0];
  const [productSlug, setProductSlug] = useState(slug ?? fallback?.slug ?? "");
  const product = products.find((p) => p.slug === productSlug) ?? fallback;
  const [colorId, setColorId] = useState(product?.variants[0]?.id ?? "");
  const variant = product?.variants.find((v) => v.id === colorId) ?? product?.variants[0];

  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [floor, setFloor] = useState(45); // % of image height covered by floor
  const [opacity, setOpacity] = useState(92);

  const onFile = (file?: File) => {
    if (!file) return;
    if (!/image\/(jpeg|png|jpg|webp)/.test(file.type)) {
      toast.error("Зөвхөн JPG эсвэл PNG хэлбэрийн зураг оруулна уу.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Зураг 10MB-аас бага байна.");
      return;
    }
    setLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(reader.result as string);
      setLoading(false);
    };
    reader.onerror = () => {
      setLoading(false);
      toast.error("Зургийг уншиж чадсангүй.");
    };
    reader.readAsDataURL(file);
  };

  if (ready && (!product || !variant))
    return (
      <div className="container-page py-16">
        <h1 className="text-xl font-bold">Урьдчилж үзэх хивс байхгүй байна.</h1>
        <Btn className="mt-5" onClick={() => navigate({ to: "/products" })}>
          Бүтээгдэхүүн үзэх
        </Btn>
      </div>
    );

  if (!ready || !product || !variant) {
    return (
      <div className="container-page py-16">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="mt-6 h-72 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Өрөөндөө туршиж үзэх</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Өрөөнийхөө зургийг оруулаад сонгосон хивс танай өрөөнд хэрхэн харагдахыг урьдчилж үзээрэй.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {!photo ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onFile(e.dataTransfer.files[0]);
              }}
              className="grid min-h-72 place-items-center rounded-xl border-2 border-dashed border-border bg-surface p-10 text-center"
            >
              {loading ? (
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                  <p className="text-sm">Зураг ачааллаж байна...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-4 font-medium">Өрөөний зураг оруулах</p>
                  <p className="mt-1 text-xs text-muted-foreground">JPG, PNG · 10MB хүртэл</p>
                  <Btn className="mt-5" onClick={() => fileRef.current?.click()}>
                    <Upload className="h-4 w-4" /> Зураг сонгох
                  </Btn>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="relative aspect-4/3 w-full overflow-hidden bg-surface">
                <img
                  src={photo}
                  alt="Оруулсан өрөөний зураг"
                  className="h-full w-full object-cover"
                />
                <div
                  className="absolute inset-x-0 bottom-0"
                  style={{
                    height: `${floor}%`,
                    backgroundImage: `url(${variant.image})`,
                    backgroundSize: "22% auto",
                    opacity: opacity / 100,
                    maskImage: "linear-gradient(to bottom, transparent, black 12%)",
                    WebkitMaskImage: "linear-gradient(to bottom, transparent, black 12%)",
                    transform: "perspective(320px) rotateX(38deg)",
                    transformOrigin: "bottom center",
                  }}
                />
              </div>
              <div className="space-y-4 p-5">
                <div>
                  <label className="text-sm font-medium">Шалны хэсгийг тэмдэглэх</label>
                  <input
                    type="range"
                    min={20}
                    max={70}
                    value={floor}
                    onChange={(e) => setFloor(Number(e.target.value))}
                    className="mt-2 w-full accent-[var(--accent)]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Хивс эхлэх шугамыг дээш доош гүйлгэж тохируулна.
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Тунгалаг байдал</label>
                  <input
                    type="range"
                    min={50}
                    max={100}
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                    className="mt-2 w-full accent-[var(--accent)]"
                  />
                </div>
              </div>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />

          <p className="mt-4 flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <Info className="h-4 w-4 shrink-0" />
            Энэ дүрслэл нь бүтээгдэхүүний харагдах байдлыг урьдчилан төсөөлөхөд зориулагдсан.
          </p>
        </div>

        {/* Controls */}
        <aside className="space-y-6 rounded-xl border border-border bg-card p-5">
          <div>
            <p className="text-sm font-semibold">Хивс солих</p>
            <div className="mt-3 space-y-2">
              {products.map((p) => (
                <button
                  key={p.slug}
                  onClick={() => {
                    setProductSlug(p.slug);
                    setColorId(p.variants[0]?.id ?? "");
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border p-2 text-left",
                    p.slug === productSlug ? "border-accent bg-accent/5" : "border-border",
                  )}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-surface">
                    <img
                      src={p.variants[0]?.image}
                      alt=""
                      className="h-full w-full object-contain p-1"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{p.short}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold">Өнгө солих — {variant.name}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {product.variants.map((v) => (
                <ColorSwatch
                  key={v.id}
                  hex={v.hex}
                  name={v.name}
                  selected={v.id === variant.id}
                  onSelect={() => setColorId(v.id)}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Код: {variant.code} · Зузаан: {variantThickness(product, variant)}
            </p>
          </div>

          <div className="space-y-2">
            <Btn
              variant="secondary"
              className="w-full"
              onClick={() => fileRef.current?.click()}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4" /> Дахин зураг оруулах
            </Btn>
            <Btn
              className="w-full"
              size="lg"
              onClick={() =>
                navigate({
                  to: "/products/$slug",
                  params: { slug: product.slug },
                  search: { color: variant.id },
                })
              }
            >
              Энэ хивсийг захиалах
            </Btn>
            <p className="text-center text-xs text-muted-foreground">
              Дэлгэрэнгүй хуудсанд өнгө, хэмжээгээ тохируулж захиална.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
