import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Brush,
  Check,
  Columns2,
  Download,
  Eraser,
  Eye,
  Grid3x3,
  ImagePlus,
  Info,
  Loader2,
  Move,
  RotateCcw,
  Search,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { toast } from "sonner";
import heroRoom from "@/assets/hero-room.jpg";
import roomOffice from "@/assets/room-office.jpg";
import roomSample from "@/assets/room-sample.jpg";
import { Btn, ColorSwatch } from "@/components/ui-kit";
import { useCatalog } from "@/lib/catalog-store";
import { detectFloor, readFocal35, warmDetector } from "@/lib/floor-detect";
import {
  formatPrice,
  formatSize,
  hasColours,
  priceUnitOf,
  variantPrice,
  variantThickness,
  type Product,
} from "@/lib/products";
import {
  ROOM_PRESETS,
  buildTexture,
  findTile,
  floorOutline,
  measureLight,
  renderScene,
  shadeFloor,
  uploadQuad,
  type Crop,
  type Layout,
  type Light,
  type Pt,
  type Quad,
  type Texture,
} from "@/lib/room-visualizer";
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
          "Өрөөнийхөө зургийг оруулаад сонгосон Японы модуль хивс шалан дээр хэрхэн харагдахыг бодит хэмжээ, перспективээр урьдчилж үзээрэй.",
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

const ROOM_IMAGES: Record<string, string> = {
  living: heroRoom,
  office: roomOffice,
  bedroom: roomSample,
};
const MAX_SIDE = 1600;
/** Extra space around the photo while placing the floor, so points can sit outside it. */
const MARGIN = 0.2;
type Mode = "view" | "floor" | "furniture";
type Room = {
  id: string;
  photo: HTMLCanvasElement;
  quad: Quad;
  floorW: number;
  floorD: number;
  keepShapes: Pt[][];
  /** Furniture mask found automatically in an uploaded photo. */
  keepMask?: HTMLCanvasElement;
  /** The floor is still being looked for: show the plain photo. */
  analyzing?: boolean;
};
/** What the stage is busy with, shown to the customer as a percentage. */
type Busy = { label: string; pct: number; done?: boolean };

const loadImage = (src: string, cors: boolean) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
/**
 * A product photo, reporting how much has arrived (0–1). Downloaded as a blob so its
 * pixels stay readable (auto-crop, download); servers that refuse that are loaded plainly.
 */
async function loadProductImage(src: string, onProgress: (fraction: number) => void) {
  try {
    const res = await fetch(src);
    if (!res.ok || !res.body) throw new Error(String(res.status));
    const total = Number(res.headers.get("content-length")) || 0;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      // Without a declared size, approach the end the more has arrived.
      onProgress(total ? loaded / total : 1 - Math.exp(-loaded / 150_000));
    }
    const url = URL.createObjectURL(
      new Blob(chunks as BlobPart[], { type: res.headers.get("content-type") || "image/jpeg" }),
    );
    try {
      return await loadImage(url, false);
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return loadImage(src, true).catch(() => loadImage(src, false));
  }
}

function toPhoto(img: HTMLImageElement) {
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

function Visualizer() {
  const { slug } = Route.useSearch();
  const navigate = useNavigate();
  const { products: allProducts, types, ready } = useCatalog();
  const products = useMemo(() => allProducts.filter((p) => p.variants.length > 0), [allProducts]);

  // --- product
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [productSlug, setProductSlug] = useState(slug ?? "");
  const product = products.find((p) => p.slug === productSlug) ?? products[0];
  const [colorId, setColorId] = useState("");
  const variant = product?.variants.find((v) => v.id === colorId) ?? product?.variants[0];
  const tileW = product?.widthM || 0.5;
  const tileL = product?.lengthM || product?.widthM || 0.5;

  // --- look
  const [layout, setLayout] = useState<Layout>("straight");
  const [angle, setAngle] = useState(0);
  const [seams, setSeams] = useState(true);
  const [lightStrength, setLightStrength] = useState(0.85);

  // --- room
  const [room, setRoom] = useState<Room | null>(null);
  const [roomLoading, setRoomLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Busy | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [brush, setBrush] = useState<{ tool: "keep" | "erase"; size: number }>({
    tool: "keep",
    size: 36,
  });
  const [compare, setCompare] = useState<number | null>(null);
  const [maskVersion, setMaskVersion] = useState(0);
  const [dragging, setDragging] = useState(false);
  const keepRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [screenScale, setScreenScale] = useState(1);

  // --- product texture
  type Source = { img: HTMLImageElement; crop: Crop };
  const [source, setSource] = useState<Source | null>(null);
  const [swapping, setSwapping] = useState<Busy | null>(null);
  const sources = useRef(new Map<string, Source>());
  const productName = product?.name ?? "";
  useEffect(() => {
    const src = variant?.image;
    if (!src) return setSource(null);
    let live = true;
    let hide = 0;
    // The floor keeps its old look until the new one is ready; the bar says which is coming.
    const finish = (next: Source) => {
      if (!live) return;
      setSource(next);
      setSwapping({ label: productName, pct: 100, done: true });
      hide = window.setTimeout(() => live && setSwapping(null), 900);
    };
    const cached = sources.current.get(src);
    if (cached) finish(cached);
    else {
      const started = performance.now();
      let real = 0;
      const show = () => {
        // Creeps on its own while the server reports nothing, never past the real figure's range.
        const idle = 60 * (1 - Math.exp(-(performance.now() - started) / 1500));
        setSwapping({ label: productName, pct: Math.round(Math.max(real * 92, idle)) });
      };
      show();
      const timer = window.setInterval(() => live && show(), 150);
      loadProductImage(src, (fraction) => {
        real = fraction;
        if (live) show();
      })
        .then((img) => {
          const next = { img, crop: findTile(img) };
          sources.current.set(src, next);
          finish(next);
        })
        .catch(() => {
          if (!live) return;
          setSwapping(null);
          toast.error("Хивсний зургийг ачаалж чадсангүй.");
        })
        .finally(() => window.clearInterval(timer));
    }
    return () => {
      live = false;
      window.clearTimeout(hide);
    };
  }, [variant?.image, productName]);
  const texture: Texture | null = useMemo(
    () => (source ? buildTexture(source.img, source.crop, tileW, tileL, layout, seams) : null),
    [source, tileW, tileL, layout, seams],
  );

  // --- room loading
  const loadPreset = async (id: string) => {
    const preset = ROOM_PRESETS.find((p) => p.id === id)!;
    setRoomLoading(true);
    try {
      const photo = toPhoto(await loadImage(ROOM_IMAGES[id]!, false));
      const k = photo.width / preset.w;
      const scale = (p: Pt): Pt => [p[0] * k, p[1] * k];
      setRoom({
        id,
        photo,
        quad: preset.quad.map(scale) as Quad,
        floorW: preset.floorW,
        floorD: preset.floorD,
        keepShapes: preset.keep.map((shape) => shape.map(scale)),
      });
      setMode("view");
    } catch {
      toast.error("Өрөөний зургийг ачаалж чадсангүй.");
    } finally {
      setRoomLoading(false);
    }
  };
  useEffect(() => {
    void loadPreset("living");
  }, []);

  const onFile = async (file?: File) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast.error("JPG, PNG эсвэл WEBP зураг оруулна уу.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Зураг 15MB-аас бага байна.");
      return;
    }
    setRoomLoading(true);
    const url = URL.createObjectURL(file);
    let photo: HTMLCanvasElement;
    try {
      photo = toPhoto(await loadImage(url, false));
    } catch {
      toast.error("Зургийг уншиж чадсангүй.");
      return;
    } finally {
      URL.revokeObjectURL(url);
      setRoomLoading(false);
    }
    // Show the photo at once; the floor is found in the background.
    setRoom({
      id: "upload",
      photo,
      quad: uploadQuad(photo.width, photo.height),
      floorW: 4,
      floorD: 4,
      keepShapes: [],
      analyzing: true,
    });
    setMode("view");
    setCompare(null);
    setAnalysis({ label: "Таних модель ачаалж байна", pct: 2 });
    // Only this photo's result may land: the customer can pick another room meanwhile.
    const mine = (r: Room | null): r is Room => r?.photo === photo;
    try {
      const found = await detectFloor(photo, {
        focal35: await readFocal35(file),
        onProgress: ({ stage, pct }) =>
          setAnalysis({
            label: stage === "download" ? "Таних модель ачаалж байна" : "Шалыг таньж байна",
            pct,
          }),
      });
      setRoom((r) =>
        mine(r)
          ? {
              ...r,
              quad: found.quad,
              floorW: found.floorW,
              floorD: found.floorD,
              keepMask: found.keep,
              analyzing: false,
            }
          : r,
      );
      setAngle(found.angle);
      toast.success("Шалыг автоматаар танилаа", {
        description: "Нарийвчлах бол «Шал тохируулах», «Тавилга хамгаалах»-ыг ашиглана.",
      });
    } catch {
      setRoom((r) => (mine(r) ? { ...r, analyzing: false } : r));
      setMode("floor");
      toast.info("Шалыг автоматаар таньж чадсангүй. 4 цэгийг гараар байрлуулна уу.");
    } finally {
      setAnalysis(null);
    }
  };

  const photo = room?.photo;
  const quad = room?.quad;
  const keepShapes = room?.keepShapes;
  const keepMask = room?.keepMask;
  // Furniture mask: what was detected or preset to start with, then whatever the customer paints.
  useEffect(() => {
    if (!photo || !keepShapes) return;
    const c = document.createElement("canvas");
    c.width = photo.width;
    c.height = photo.height;
    const ctx = c.getContext("2d")!;
    if (keepMask) ctx.drawImage(keepMask, 0, 0);
    ctx.fillStyle = "#fff";
    for (const shape of keepShapes) {
      ctx.beginPath();
      shape.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
    }
    keepRef.current = c;
    setMaskVersion((v) => v + 1);
  }, [photo, keepShapes, keepMask]);

  const light: Light | null = useMemo(() => (photo ? measureLight(photo) : null), [photo]);
  const shading = useMemo(
    () =>
      photo && quad && light && lightStrength > 0
        ? shadeFloor(light, floorOutline(quad, photo.height), photo.width, lightStrength)
        : null,
    [light, photo, quad, lightStrength],
  );

  // --- render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !room) return;
    const frame = requestAnimationFrame(() => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      renderScene(ctx, {
        photo: room.photo,
        quad: room.quad,
        floorW: room.floorW,
        floorD: room.floorD,
        texture: room.analyzing ? null : texture,
        angle,
        shading,
        keep: keepRef.current,
        compareX: compare === null ? null : compare * room.photo.width,
        draft: dragging,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [room, texture, angle, shading, compare, maskVersion, dragging]);

  // Handles and the brush keep their on-screen size whatever the photo resolution.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !room) return;
    const update = () => {
      const width = svg.getBoundingClientRect().width;
      const m = mode === "floor" ? MARGIN : 0;
      if (width) setScreenScale((room.photo.width * (1 + 2 * m)) / width);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(svg);
    return () => ro.disconnect();
  }, [room, mode]);

  // --- pointer interaction
  const gesture = useRef<
    { kind: "corner"; index: number } | { kind: "paint"; last: Pt } | { kind: "compare" } | null
  >(null);
  const toPhotoPoint = (e: ReactPointerEvent): Pt => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return [p.x, p.y];
  };
  const paint = (from: Pt, to: Pt) => {
    const c = keepRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.globalCompositeOperation = brush.tool === "keep" ? "source-over" : "destination-out";
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#fff";
    ctx.lineCap = "round";
    ctx.lineWidth = brush.size * screenScale;
    ctx.beginPath();
    ctx.moveTo(...from);
    ctx.lineTo(...to);
    ctx.stroke();
    setMaskVersion((v) => v + 1);
  };
  const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!room) return;
    const p = toPhotoPoint(e);
    if (mode === "floor") {
      let best = -1;
      let dist = 34 * screenScale;
      room.quad.forEach((q, i) => {
        const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (d < dist) {
          dist = d;
          best = i;
        }
      });
      if (best < 0) return;
      gesture.current = { kind: "corner", index: best };
      setDragging(true);
    } else if (mode === "furniture") {
      gesture.current = { kind: "paint", last: p };
      paint(p, p);
    } else if (compare !== null) {
      gesture.current = { kind: "compare" };
      setCompare(Math.min(1, Math.max(0, p[0] / room.photo.width)));
    } else return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!room) return;
    const p = toPhotoPoint(e);
    if (mode === "furniture") setCursor(p);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "corner") {
      const W = room.photo.width;
      const H = room.photo.height;
      const clamped: Pt = [
        Math.min(W * (1 + MARGIN), Math.max(-W * MARGIN, p[0])),
        Math.min(H * (1 + MARGIN), Math.max(-H * MARGIN, p[1])),
      ];
      setRoom(
        (r) => r && { ...r, quad: r.quad.map((q, i) => (i === g.index ? clamped : q)) as Quad },
      );
    } else if (g.kind === "paint") {
      paint(g.last, p);
      g.last = p;
    } else setCompare(Math.min(1, Math.max(0, p[0] / room.photo.width)));
  };
  const onUp = () => {
    gesture.current = null;
    setDragging(false);
  };

  const download = () => {
    if (!room || !product || !variant) return;
    const c = document.createElement("canvas");
    c.width = room.photo.width;
    c.height = room.photo.height;
    const ctx = c.getContext("2d")!;
    renderScene(ctx, {
      photo: room.photo,
      quad: room.quad,
      floorW: room.floorW,
      floorD: room.floorD,
      texture,
      angle,
      shading,
      keep: keepRef.current,
      compareX: null,
    });
    const label = ["JINTEMO", product.name, hasColours(product) ? variant.name : "", variant.code]
      .filter(Boolean)
      .join(" · ");
    const size = Math.max(14, Math.round(c.width / 70));
    ctx.font = `600 ${size}px Inter, sans-serif`;
    const width = ctx.measureText(label).width;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(size, c.height - size * 2.6, width + size * 1.2, size * 1.8);
    ctx.fillStyle = "#2b2622";
    ctx.fillText(label, size * 1.6, c.height - size * 1.25);
    try {
      c.toBlob((blob) => {
        if (!blob) {
          toast.error("Зургийг хадгалж чадсангүй.");
          return;
        }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `jintemo-${product.slug}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }, "image/png");
    } catch {
      toast.error("Энэ бүтээгдэхүүний зургийг татах боломжгүй байна.");
    }
  };

  const chooseProduct = (p: Product) => {
    setProductSlug(p.slug);
    setColorId("");
    // Only the address changes: the page must stay where the customer is looking.
    void navigate({
      to: "/visualizer",
      search: { slug: p.slug },
      replace: true,
      resetScroll: false,
    });
  };

  if (ready && !product)
    return (
      <div className="container-page py-16">
        <h1 className="text-xl font-bold">Урьдчилж үзэх хивс байхгүй байна.</h1>
        <Btn className="mt-5" onClick={() => navigate({ to: "/products" })}>
          Бүтээгдэхүүн үзэх
        </Btn>
      </div>
    );

  const carpetTypes = types.filter((t) => products.some((p) => p.typeId === t.id));
  const needle = query.trim().toLowerCase();
  const list = products.filter(
    (p) =>
      (!typeFilter || p.typeId === typeFilter) &&
      (!needle ||
        p.name.toLowerCase().includes(needle) ||
        p.variants.some((v) => v.code.toLowerCase().includes(needle))),
  );
  const m = mode === "floor" ? MARGIN : 0;
  const W = room?.photo.width ?? 4;
  const H = room?.photo.height ?? 3;
  const outline = room ? floorOutline(room.quad, room.photo.height) : [];
  const handle = 9 * screenScale;

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 pb-16 pt-8 md:px-8">
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Өрөөндөө туршиж үзэх</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Жишээ өрөө сонгох эсвэл өөрийн өрөөний зургийг оруулаад хивсийг бодит хэмжээ,
        перспективтэйгээр шалан дээр нь тавьж үзээрэй. Өнгө, хэв маягаа шууд сольж харьцуулна.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {/* Toolbar */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-border bg-card p-1">
              {(
                [
                  ["view", Eye, "Харах"],
                  ["floor", Move, "Шал тохируулах"],
                  ["furniture", Brush, "Тавилга хамгаалах"],
                ] as const
              ).map(([id, Icon, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={mode === id}
                  onClick={() => {
                    setMode(id);
                    if (id !== "view") setCompare(null);
                  }}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded px-3 text-sm font-medium transition-colors",
                    mode === id ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-pressed={compare !== null}
              onClick={() => {
                setMode("view");
                setCompare((c) => (c === null ? 0.5 : null));
              }}
              className={cn(
                "inline-flex h-11 items-center gap-1.5 rounded-md border px-3 text-sm font-medium",
                compare !== null
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-card",
              )}
            >
              <Columns2 className="h-4 w-4" /> Өмнө / дараа
            </button>
            <Btn variant="secondary" onClick={download} disabled={!room || !texture}>
              <Download className="h-4 w-4" /> Татаж авах
            </Btn>
          </div>

          {/* Stage */}
          <div
            className={cn(
              "relative w-full select-none overflow-hidden rounded-xl border border-border bg-surface",
              mode !== "view" || compare !== null ? "touch-none" : "",
              mode === "floor" &&
                "bg-[repeating-linear-gradient(45deg,var(--surface)_0_10px,var(--muted)_10px_20px)]",
            )}
            style={{ aspectRatio: `${W * (1 + 2 * m)} / ${H * (1 + 2 * m)}` }}
          >
            {room ? (
              <>
                <canvas
                  ref={canvasRef}
                  width={W}
                  height={H}
                  aria-label="Өрөөний урьдчилсан харагдац"
                  className="absolute"
                  style={{
                    left: `${(m / (1 + 2 * m)) * 100}%`,
                    top: `${(m / (1 + 2 * m)) * 100}%`,
                    width: `${100 / (1 + 2 * m)}%`,
                    height: `${100 / (1 + 2 * m)}%`,
                  }}
                />
                <svg
                  ref={svgRef}
                  viewBox={`${-m * W} ${-m * H} ${W * (1 + 2 * m)} ${H * (1 + 2 * m)}`}
                  preserveAspectRatio="none"
                  className={cn(
                    "absolute inset-0 h-full w-full",
                    mode === "furniture" && "cursor-none",
                    compare !== null && "cursor-ew-resize",
                  )}
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                  onPointerLeave={() => setCursor(null)}
                >
                  {mode === "floor" && (
                    <>
                      <polygon
                        points={outline.map((p) => p.join(",")).join(" ")}
                        fill="rgba(0,57,126,0.08)"
                        stroke="white"
                        strokeDasharray={`${8 * screenScale} ${6 * screenScale}`}
                        strokeWidth={1.5 * screenScale}
                      />
                      <polygon
                        points={room.quad.map((p) => p.join(",")).join(" ")}
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth={2.5 * screenScale}
                      />
                      {room.quad.map(([x, y], i) => (
                        <g key={i}>
                          <circle cx={x} cy={y} r={handle * 2.2} fill="rgba(255,255,255,0.35)" />
                          <circle
                            cx={x}
                            cy={y}
                            r={handle}
                            fill="var(--accent)"
                            stroke="white"
                            strokeWidth={2.5 * screenScale}
                          />
                        </g>
                      ))}
                    </>
                  )}
                  {mode === "furniture" && cursor && (
                    <circle
                      cx={cursor[0]}
                      cy={cursor[1]}
                      r={(brush.size / 2) * screenScale}
                      fill={
                        brush.tool === "keep" ? "rgba(255,255,255,0.25)" : "rgba(220,38,38,0.2)"
                      }
                      stroke="white"
                      strokeWidth={1.5 * screenScale}
                    />
                  )}
                  {compare !== null && (
                    <g>
                      <line
                        x1={compare * W}
                        x2={compare * W}
                        y1={0}
                        y2={H}
                        stroke="white"
                        strokeWidth={3 * screenScale}
                      />
                      <circle
                        cx={compare * W}
                        cy={H / 2}
                        r={handle * 2}
                        fill="white"
                        stroke="var(--accent)"
                        strokeWidth={2 * screenScale}
                      />
                      <text
                        x={compare * W - 14 * screenScale}
                        y={22 * screenScale}
                        textAnchor="end"
                        fontSize={13 * screenScale}
                        fontWeight={600}
                        fill="white"
                        style={{ paintOrder: "stroke" }}
                        stroke="rgba(0,0,0,0.45)"
                        strokeWidth={3 * screenScale}
                      >
                        Дараа
                      </text>
                      <text
                        x={compare * W + 14 * screenScale}
                        y={22 * screenScale}
                        fontSize={13 * screenScale}
                        fontWeight={600}
                        fill="white"
                        style={{ paintOrder: "stroke" }}
                        stroke="rgba(0,0,0,0.45)"
                        strokeWidth={3 * screenScale}
                      >
                        Өмнө
                      </text>
                    </g>
                  )}
                </svg>
              </>
            ) : (
              <div className="absolute inset-0 animate-pulse bg-muted" />
            )}
            {roomLoading && (
              <div className="absolute inset-0 grid place-items-center bg-background/60 text-sm font-medium">
                Ачаалж байна…
              </div>
            )}
            {analysis ? (
              <div
                role="status"
                aria-live="polite"
                className="absolute inset-0 grid place-items-center bg-foreground/35 p-4 backdrop-blur-[1px]"
              >
                <div className="w-full max-w-xs rounded-xl bg-card p-4 shadow-lift">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Loader2 className="h-4 w-4 animate-spin text-accent" />
                    {analysis.label}
                    <span className="ml-auto tabular-nums">{analysis.pct}%</span>
                  </p>
                  <ProgressBar pct={analysis.pct} />
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Зураг таны төхөөрөмж дээр боловсруулагдана. Анх удаа хэдэн секунд илүү
                    зарцуулна.
                  </p>
                </div>
              </div>
            ) : (
              swapping && (
                <div
                  role="status"
                  aria-live="polite"
                  className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3"
                >
                  <div className="w-full max-w-xs rounded-lg bg-card/95 px-4 py-3 shadow-lift backdrop-blur">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {swapping.done ? (
                        <Check className="h-4 w-4 shrink-0 text-success" />
                      ) : (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />
                      )}
                      <span className="truncate">
                        {swapping.done ? "Солигдлоо: " : "Хивс солигдож байна: "}
                        {swapping.label}
                      </span>
                      <span className="ml-auto tabular-nums">{swapping.pct}%</span>
                    </p>
                    <ProgressBar pct={swapping.pct} />
                  </div>
                </div>
              )
            )}
          </div>

          {/* Phones: switch carpets right under the picture; the full list is further down. */}
          <div className="mt-3 lg:hidden">
            <p className="text-sm font-semibold">Хивс солих</p>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {products.map((p) => (
                <button
                  key={p.slug}
                  type="button"
                  aria-pressed={p.slug === product?.slug}
                  onClick={() => chooseProduct(p)}
                  className={cn(
                    "w-24 shrink-0 overflow-hidden rounded-lg border-2 bg-card text-left",
                    p.slug === product?.slug ? "border-accent" : "border-transparent",
                  )}
                >
                  <span className="grid aspect-square w-full place-items-center bg-surface">
                    {p.variants[0]?.image && (
                      <img
                        src={p.variants[0].image}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-contain p-1"
                      />
                    )}
                  </span>
                  <span className="block truncate px-1.5 py-1 text-[11px] font-medium">
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Mode help and controls */}
          {mode === "floor" && room && (
            <div className="mt-3 rounded-lg border border-border bg-card p-4">
              <p className="text-sm leading-relaxed">
                Цэнхэр <b>дээд 2 цэгийг</b> арын хана шалтай нийлсэн буланд, <b>доод 2 цэгийг</b>{" "}
                хажуу хананы шугамын дагуу доош байрлуулна. Хивс хэтэрхий том/жижиг харагдвал доорх
                хэмжээг тааруулна — хавтангууд дөрвөлжин харагдах ёстой.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ["floorW", "Арын хананы өргөн", 1, 30],
                    ["floorD", "Тэмдэглэсэн хэсгийн гүн", 0.5, 30],
                  ] as const
                ).map(([key, label, min, max]) => (
                  <label key={key} className="block text-sm font-medium">
                    {label}: {room[key].toFixed(1)} м
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={0.1}
                      value={room[key]}
                      onChange={(e) => setRoom((r) => r && { ...r, [key]: Number(e.target.value) })}
                      className="mt-2 w-full accent-[var(--accent)]"
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent"
                onClick={() =>
                  room.id === "upload"
                    ? setRoom((r) => r && { ...r, quad: uploadQuad(r.photo.width, r.photo.height) })
                    : void loadPreset(room.id)
                }
              >
                <RotateCcw className="h-4 w-4" /> Анхны байрлал
              </button>
            </div>
          )}
          {mode === "furniture" && (
            <div className="mt-3 rounded-lg border border-border bg-card p-4">
              <p className="text-sm leading-relaxed">
                Шалан дээрх тавилга, ургамал, хивсэн доор орох ёсгүй зүйлсийг будаж хамгаална.
                Алдаатай будсан хэсгийг арилгагчаар засна.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(
                  [
                    ["keep", Brush, "Хамгаалах"],
                    ["erase", Eraser, "Арилгах"],
                  ] as const
                ).map(([tool, Icon, label]) => (
                  <button
                    key={tool}
                    type="button"
                    aria-pressed={brush.tool === tool}
                    onClick={() => setBrush((b) => ({ ...b, tool }))}
                    className={cn(
                      "inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium",
                      brush.tool === tool
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border",
                    )}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
                <label className="ml-2 flex min-w-40 flex-1 items-center gap-2 text-sm">
                  Хэмжээ
                  <input
                    type="range"
                    min={10}
                    max={120}
                    value={brush.size}
                    onChange={(e) => setBrush((b) => ({ ...b, size: Number(e.target.value) }))}
                    className="w-full accent-[var(--accent)]"
                  />
                </label>
                <button
                  type="button"
                  className="text-sm font-medium text-destructive"
                  onClick={() => {
                    const c = keepRef.current;
                    c?.getContext("2d")!.clearRect(0, 0, c.width, c.height);
                    setMaskVersion((v) => v + 1);
                  }}
                >
                  Бүгдийг арилгах
                </button>
              </div>
            </div>
          )}

          {/* Rooms */}
          <div className="mt-4">
            <p className="text-sm font-semibold">Өрөө сонгох</p>
            <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => {
                  // Start fetching the floor-recognition model while the customer picks a photo.
                  warmDetector();
                  fileRef.current?.click();
                }}
                className={cn(
                  "grid w-36 shrink-0 place-items-center rounded-lg border-2 border-dashed bg-card p-3 text-center",
                  room?.id === "upload" ? "border-accent" : "border-border",
                )}
              >
                <span className="flex flex-col items-center gap-1.5 text-xs font-medium">
                  <ImagePlus className="h-6 w-6 text-accent" />
                  Өөрийн өрөөний зураг
                  <span className="font-normal text-muted-foreground">Шалыг автоматаар танина</span>
                </span>
              </button>
              {ROOM_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void loadPreset(p.id)}
                  className={cn(
                    "w-36 shrink-0 overflow-hidden rounded-lg border-2 bg-card text-left",
                    room?.id === p.id ? "border-accent" : "border-transparent",
                  )}
                >
                  <img
                    src={ROOM_IMAGES[p.id]}
                    alt=""
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <span className="block px-2 py-1.5 text-xs font-medium">{p.name}</span>
                </button>
              ))}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          <p className="mt-4 flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <Info className="h-4 w-4 shrink-0" />
            Таны зураг зөвхөн энэ төхөөрөмж дээр боловсруулагдах ба сервер рүү илгээгдэхгүй. Дүрслэл
            нь урьдчилан төсөөлөхөд зориулагдсан тул бодит өнгө бага зэрэг ялгаатай байж болно.
          </p>
        </div>

        {/* Product and look */}
        <aside className="space-y-5">
          {product && variant && (
            <section className="rounded-xl border border-border bg-card p-4">
              <div className="flex gap-3">
                <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-md bg-surface">
                  {variant.image && (
                    <img src={variant.image} alt="" className="h-full w-full object-contain p-1" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="font-display font-bold leading-snug">{product.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[
                      hasColours(product) ? variant.name : "",
                      variant.code,
                      formatSize(product) || "0.5 × 0.5 м (тооцоолсон)",
                      variantThickness(product, variant),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="mt-1 font-semibold">
                    {formatPrice(variantPrice(product, variant), priceUnitOf(product))}
                  </p>
                </div>
              </div>
              {hasColours(product) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.variants.map((v) => (
                    <ColorSwatch
                      key={v.id}
                      hex={v.hex}
                      name={v.name}
                      size="sm"
                      selected={v.id === variant.id}
                      onSelect={() => setColorId(v.id)}
                    />
                  ))}
                </div>
              )}
              <Btn
                className="mt-4 w-full"
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
            </section>
          )}

          <section className="rounded-xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Grid3x3 className="h-4 w-4 text-accent" /> Тавих хэв маяг
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(
                [
                  ["straight", "Энгийн"],
                  ["quarter", "Шатар"],
                  ["brick", "Тоосго"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={layout === id}
                  disabled={id === "quarter" && texture !== null && !texture.quarterPossible}
                  onClick={() => setLayout(id)}
                  className={cn(
                    "h-10 rounded-md border text-sm font-medium disabled:opacity-40",
                    layout === id ? "border-accent bg-accent/10 text-accent" : "border-border",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="mt-4 block text-sm">
              Эргүүлэх: {angle}°
              <input
                type="range"
                min={0}
                max={90}
                step={1}
                value={angle}
                onChange={(e) => setAngle(Number(e.target.value))}
                className="mt-2 w-full accent-[var(--accent)]"
              />
            </label>
            <label className="mt-3 block text-sm">
              Өрөөний гэрэл, сүүдэр: {Math.round(lightStrength * 100)}%
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={lightStrength}
                onChange={(e) => setLightStrength(Number(e.target.value))}
                className="mt-2 w-full accent-[var(--accent)]"
              />
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--accent)]"
                checked={seams}
                onChange={(e) => setSeams(e.target.checked)}
              />
              Хавтангийн заадас харуулах
            </label>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">Хивс сонгох</p>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                aria-label="Хивс хайх"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Нэр эсвэл кодоор хайх…"
                className="h-10 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>
            {carpetTypes.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[{ id: "", name: "Бүгд" }, ...carpetTypes].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTypeFilter(t.id)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium",
                      typeFilter === t.id
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border",
                    )}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
              {list.map((p) => (
                <button
                  key={p.slug}
                  type="button"
                  onClick={() => chooseProduct(p)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border p-2 text-left",
                    p.slug === product?.slug ? "border-accent bg-accent/5" : "border-border",
                  )}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-md bg-surface">
                    {p.variants[0]?.image && (
                      <img
                        src={p.variants[0].image}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-contain p-1"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[formatSize(p), hasColours(p) ? `${p.variants.length} өнгө` : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {p.slug === product?.slug &&
                    swapping &&
                    (swapping.done ? (
                      <Check className="h-4 w-4 shrink-0 text-success" />
                    ) : (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />
                    ))}
                </button>
              ))}
              {!list.length && (
                <p className="py-6 text-center text-sm text-muted-foreground">Илэрц олдсонгүй.</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-200"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}
