import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  Brush,
  Columns2,
  Download,
  Eraser,
  Grid3x3,
  Home,
  ImagePlus,
  Info,
  MoreVertical,
  Move,
  RotateCcw,
  RotateCw,
  Search,
  Share2,
  ShoppingCart,
  SlidersHorizontal,
  ThumbsDown,
  ThumbsUp,
  X,
  ZoomIn,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import heroRoom from "@/assets/hero-room.jpg";
import roomOffice from "@/assets/room-office.jpg";
import roomSample from "@/assets/room-sample.jpg";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CatalogPanel } from "@/components/visualizer/catalog-panel";
import { EntryScreen } from "@/components/visualizer/entry-screen";
import { ProgressRing } from "@/components/visualizer/progress-ring";
import {
  NO_FILTERS,
  filterItems,
  loadImage,
  useTileTexture,
  type Busy,
  type Filters,
  type VizItem,
} from "@/components/visualizer/shared";
import { useCatalog } from "@/lib/catalog-store";
import { detectFloor, readFocal35, warmDetector } from "@/lib/floor-detect";
import { formatPrice, hasColours, priceUnitOf, variantPrice } from "@/lib/products";
import {
  ROOM_PRESETS,
  floorOutline,
  measureLight,
  renderScene,
  shadeFloor,
  uploadQuad,
  type Layout,
  type Light,
  type Pt,
  type Quad,
} from "@/lib/room-visualizer";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

type Search = { slug?: string | undefined; color?: string | undefined };

export const Route = createFileRoute("/visualizer")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    slug: typeof search["slug"] === "string" ? (search["slug"] as string) : undefined,
    color: typeof search["color"] === "string" ? (search["color"] as string) : undefined,
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
/** Extra space around the photo while fixing the floor, so points can sit outside it. */
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
const sizeLabel = (w?: number, l?: number) => {
  const mm = (m: number) => `${Math.round(m * 1000)} мм`;
  if (w && l) return `${mm(w)} × ${mm(l)}`;
  return w ? mm(w) : "";
};
let compareCanvas: HTMLCanvasElement | null = null;

function Visualizer() {
  const { slug, color } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const { products, types, ready } = useCatalog();
  const { settings } = useSettings();

  // --- catalogue: every colour of every product is one floor to choose
  const items: VizItem[] = useMemo(
    () =>
      products.flatMap((p) =>
        p.variants.map((v) => ({
          key: `${p.slug}:${v.id}`,
          product: p,
          variant: v,
          name: hasColours(p) ? `${p.name} · ${v.name}` : p.name,
          code: v.code,
          image: v.image,
          size: sizeLabel(p.widthM, p.lengthM),
          typeId: p.typeId,
        })),
      ),
    [products],
  );
  const typeNames = useMemo(() => Object.fromEntries(types.map((t) => [t.id, t.name])), [types]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current || !items.length) return;
    initialised.current = true;
    if (!slug) return;
    const found =
      items.find((i) => i.product.slug === slug && i.variant.id === color) ??
      items.find((i) => i.product.slug === slug);
    if (found) setSelectedKey(found.key);
  }, [items, slug, color]);
  const selected = items.find((i) => i.key === selectedKey) ?? null;
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);

  // --- look
  const [layout, setLayout] = useState<Layout>("straight");
  const [angle, setAngle] = useState(0);
  const [baseAngle, setBaseAngle] = useState(0);
  const [seams, setSeams] = useState(true);
  const [lightStrength, setLightStrength] = useState(0.85);

  // --- room
  const [room, setRoom] = useState<Room | null>(null);
  const [roomLoading, setRoomLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Busy | null>(null);
  const [askFeedback, setAskFeedback] = useState(false);
  const [mode, setMode] = useState<Mode>("view");
  const [brush, setBrush] = useState<{ tool: "keep" | "erase"; size: number }>({
    tool: "keep",
    size: 36,
  });
  /** Before/after divider (0–1) and the second floor compared against, if any. */
  const [compare, setCompare] = useState<{ x: number; key: string | null } | null>(null);
  const [zoom, setZoom] = useState({ s: 1, x: 0, y: 0 });
  const [maskVersion, setMaskVersion] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [drawer, setDrawer] = useState<null | "list" | "search" | "filters">(null);
  const keepRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });

  const main = useTileTexture(selected, layout, seams);
  const otherItem = compare?.key ? (items.find((i) => i.key === compare.key) ?? null) : null;
  const other = useTileTexture(otherItem, layout, seams);
  const busy: Busy | null = analysis ?? main.busy ?? other.busy;

  // --- choosing a floor
  const choose = (item: VizItem) => {
    setDrawer((d) => (d === null ? d : null));
    if (compare && selected && item.key !== selected.key) {
      setCompare((c) => c && { ...c, key: item.key });
      return;
    }
    setSelectedKey(item.key);
    // Only the address changes: the page must stay where the customer is looking.
    void navigate({
      to: "/visualizer",
      search: { slug: item.product.slug, color: item.variant.id },
      replace: true,
      resetScroll: false,
    });
  };
  const clearFloor = () => {
    setSelectedKey(null);
    setAngle(baseAngle);
    setLayout("straight");
    setCompare(null);
    void navigate({ to: "/visualizer", search: {}, replace: true, resetScroll: false });
  };

  // --- rooms
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
      setAngle(0);
      setBaseAngle(0);
      setMode("view");
      setAskFeedback(false);
      setZoom({ s: 1, x: 0, y: 0 });
    } catch {
      toast.error("Өрөөний зургийг ачаалж чадсангүй.");
    } finally {
      setRoomLoading(false);
    }
  };

  const onFile = async (file: File) => {
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
    setAskFeedback(false);
    setZoom({ s: 1, x: 0, y: 0 });
    setAnalysis({ label: "Таних модель бэлтгэж байна", pct: 2 });
    // Only this photo's result may land: the customer can pick another room meanwhile.
    const mine = (r: Room | null): r is Room => r?.photo === photo;
    try {
      const found = await detectFloor(photo, {
        focal35: await readFocal35(file),
        onProgress: ({ stage, pct }) =>
          setAnalysis({
            label: stage === "download" ? "Таних модель бэлтгэж байна" : "Шалыг таньж байна",
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
      setBaseAngle(found.angle);
      setAskFeedback(true);
    } catch {
      setRoom((r) => (mine(r) ? { ...r, analyzing: false } : r));
      setMode("floor");
      toast.info("Шалыг автоматаар таньж чадсангүй. Шалны 4 цэгийг гараар байрлуулна уу.");
    } finally {
      setAnalysis(null);
    }
  };

  // --- furniture mask: detected or preset outlines, then whatever the customer paints
  const photo = room?.photo;
  const quad = room?.quad;
  const keepShapes = room?.keepShapes;
  const keepMask = room?.keepMask;
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
  /** A tiny copy of the photo, blurred behind the stage like a backdrop. */
  const backdrop = useMemo(() => {
    if (!photo) return "";
    const c = document.createElement("canvas");
    c.width = 48;
    c.height = Math.max(1, Math.round((photo.height / photo.width) * 48));
    c.getContext("2d")!.drawImage(photo, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.7);
  }, [photo]);

  // --- render
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, r: Room, withCompare: boolean) => {
      const base = {
        photo: r.photo,
        quad: r.quad,
        floorW: r.floorW,
        floorD: r.floorD,
        angle,
        shading,
        keep: keepRef.current,
        compareX: null,
        draft: dragging,
      };
      renderScene(ctx, { ...base, texture: r.analyzing ? null : main.texture });
      if (!withCompare || !compare) return;
      // Right of the divider: the second floor, or the room as photographed.
      compareCanvas ??= document.createElement("canvas");
      compareCanvas.width = r.photo.width;
      compareCanvas.height = r.photo.height;
      const c = compareCanvas.getContext("2d")!;
      renderScene(c, { ...base, texture: compare.key ? other.texture : null });
      const x = compare.x * r.photo.width;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, 0, r.photo.width - x, r.photo.height);
      ctx.clip();
      ctx.drawImage(compareCanvas, 0, 0);
      ctx.restore();
    },
    [angle, shading, dragging, main.texture, other.texture, compare],
  );
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !room) return;
    const frame = requestAnimationFrame(() => {
      const ctx = canvas.getContext("2d");
      if (ctx) draw(ctx, room, true);
    });
    return () => cancelAnimationFrame(frame);
  }, [room, draw, maskVersion]);

  // --- stage size: the photo fitted into the free space between the bars
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const update = () => setArea({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [room]);
  const m = mode === "floor" ? MARGIN : 0;
  const W = room?.photo.width ?? 4;
  const H = room?.photo.height ?? 3;
  const fit = Math.min(area.w / (W * (1 + 2 * m)) || 0, area.h / (H * (1 + 2 * m)) || 0);
  const stageW = W * (1 + 2 * m) * fit;
  const stageH = H * (1 + 2 * m) * fit;
  const screenScale = fit ? 1 / fit : 1;

  // --- pointer interaction on the stage
  const gesture = useRef<
    | { kind: "corner"; index: number }
    | { kind: "paint"; last: Pt }
    | { kind: "compare" }
    | { kind: "pan"; x: number; y: number; ox: number; oy: number }
    | null
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
    ctx.lineCap = "round";
    ctx.lineWidth = (brush.size * screenScale) / zoom.s;
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
      let dist = (34 * screenScale) / zoom.s;
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
    } else if (compare) {
      gesture.current = { kind: "compare" };
      setCompare((c) => c && { ...c, x: Math.min(1, Math.max(0, p[0] / room.photo.width)) });
    } else if (zoom.s > 1) {
      gesture.current = { kind: "pan", x: e.clientX, y: e.clientY, ox: zoom.x, oy: zoom.y };
    } else return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!room) return;
    const g = gesture.current;
    if (g?.kind === "pan") {
      const limitX = (stageW * (zoom.s - 1)) / 2;
      const limitY = (stageH * (zoom.s - 1)) / 2;
      setZoom((z) => ({
        ...z,
        x: Math.max(-limitX, Math.min(limitX, g.ox + e.clientX - g.x)),
        y: Math.max(-limitY, Math.min(limitY, g.oy + e.clientY - g.y)),
      }));
      return;
    }
    const p = toPhotoPoint(e);
    if (mode === "furniture") setCursor(p);
    if (!g) return;
    if (g.kind === "corner") {
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
    } else setCompare((c) => c && { ...c, x: Math.min(1, Math.max(0, p[0] / W)) });
  };
  const onUp = () => {
    gesture.current = null;
    setDragging(false);
  };
  const toggleZoom = () => {
    setMode("view");
    setZoom((z) => (z.s > 1 ? { s: 1, x: 0, y: 0 } : { s: 2, x: 0, y: 0 }));
  };
  const startCompare = () => {
    setMode("view");
    setZoom({ s: 1, x: 0, y: 0 });
    setCompare(compare ? null : { x: 0.5, key: null });
  };

  // --- save and share
  const renderImage = async () => {
    if (!room) return null;
    const c = document.createElement("canvas");
    c.width = room.photo.width;
    c.height = room.photo.height;
    const ctx = c.getContext("2d")!;
    draw(ctx, room, false);
    const label = ["JINTEMO", selected?.name, selected?.code].filter(Boolean).join(" · ");
    const size = Math.max(14, Math.round(c.width / 70));
    ctx.font = `600 ${size}px Inter, sans-serif`;
    const width = ctx.measureText(label).width;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(size, c.height - size * 2.6, width + size * 1.2, size * 1.8);
    ctx.fillStyle = "#2b2622";
    ctx.fillText(label, size * 1.6, c.height - size * 1.25);
    try {
      return await new Promise<Blob | null>((resolve) => c.toBlob(resolve, "image/jpeg", 0.92));
    } catch {
      return null;
    }
  };
  const download = async () => {
    const blob = await renderImage();
    if (!blob) {
      toast.error("Зургийг хадгалж чадсангүй.");
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `jintemo-${selected?.product.slug ?? "room"}.jpg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const share = async () => {
    const url = window.location.href;
    const title = selected ? `${selected.name} — JINTEMO` : "JINTEMO — Өрөөндөө үзэх";
    try {
      const blob = await renderImage();
      const file = blob ? new File([blob], "jintemo-room.jpg", { type: "image/jpeg" }) : null;
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title, url, files: [file] });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Холбоосыг хууллаа");
    } catch {
      toast.error("Хуваалцаж чадсангүй.");
    }
  };
  const order = () =>
    selected &&
    navigate({
      to: "/products/$slug",
      params: { slug: selected.product.slug },
      search: { color: selected.variant.id },
    });
  const goBack = () =>
    window.history.length > 1 ? router.history.back() : void navigate({ to: "/" });

  if (ready && !items.length)
    return (
      <div className="grid min-h-[100dvh] place-items-center p-6 text-center">
        <div>
          <h1 className="text-xl font-bold">Урьдчилж үзэх хивс одоогоор алга.</h1>
          <button
            type="button"
            onClick={() => navigate({ to: "/products" })}
            className="mt-5 h-11 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Бүтээгдэхүүн үзэх
          </button>
        </div>
      </div>
    );

  if (!room)
    return (
      <EntryScreen
        brand={settings.brandName}
        logo={settings.logo}
        rooms={ROOM_PRESETS.map((p) => ({ id: p.id, name: p.name, image: ROOM_IMAGES[p.id]! }))}
        productName={selected?.name ?? null}
        busy={roomLoading}
        onBack={goBack}
        onFile={(f) => void onFile(f)}
        onRoom={(id) => void loadPreset(id)}
        onWarm={warmDetector}
      />
    );

  const outline = floorOutline(room.quad, room.photo.height);
  const handle = (9 * screenScale) / zoom.s;
  const editing = mode !== "view";
  const visibleItems = filterItems(items, query, filters);
  const pendingKey =
    main.busy && !main.busy.done
      ? selectedKey
      : other.busy && !other.busy.done
        ? (compare?.key ?? null)
        : null;

  const lookPanel = (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold">Тавих хэв маяг</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
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
              disabled={id === "quarter" && main.texture !== null && !main.texture.quarterPossible}
              onClick={() => setLayout(id)}
              className={cn(
                "h-9 rounded-md border text-sm font-medium disabled:opacity-40",
                layout === id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <label className="block text-sm">
        Чиглэл: {angle}°
        <input
          type="range"
          min={0}
          max={179}
          value={angle}
          onChange={(e) => setAngle(Number(e.target.value))}
          className="mt-1 w-full accent-[var(--primary)]"
        />
      </label>
      <label className="block text-sm">
        Өрөөний гэрэл, сүүдэр: {Math.round(lightStrength * 100)}%
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={lightStrength}
          onChange={(e) => setLightStrength(Number(e.target.value))}
          className="mt-1 w-full accent-[var(--primary)]"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[var(--primary)]"
          checked={seams}
          onChange={(e) => setSeams(e.target.checked)}
        />
        Хавтангийн заадас харуулах
      </label>
    </div>
  );
  const lookButton = (className: string, iconOnly = false) => (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Хэв маяг" className={className}>
          <Grid3x3 className="h-[18px] w-[18px]" />
          {!iconOnly && "Хэв маяг"}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-72">
        {lookPanel}
      </PopoverContent>
    </Popover>
  );
  const menu = (extra: ReactNode) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Цэс"
          className="inline-flex h-11 items-center gap-2 rounded-lg px-3 text-[15px] font-medium hover:bg-secondary"
        >
          <span className="hidden lg:inline">Цэс</span>
          <MoreVertical className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {extra}
        <DropdownMenuItem onSelect={() => fileRef.current?.click()} onPointerEnter={warmDetector}>
          <ImagePlus className="h-4 w-4" /> Өөрийн зураг оруулах
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setRoom(null)}>
          <Home className="h-4 w-4" /> Өрөө солих
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={startCompare}>
          <Columns2 className="h-4 w-4" /> {compare ? "Харьцуулалтаас гарах" : "Хивс харьцуулах"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={toggleZoom}>
          <ZoomIn className="h-4 w-4" /> {zoom.s > 1 ? "Томруулалтаас гарах" : "Томруулах"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setMode("floor")}>
          <Move className="h-4 w-4" /> Шалны байрлал засах
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setMode("furniture")}>
          <Brush className="h-4 w-4" /> Тавилга хамгаалах
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const toolbarButton = (
    label: string,
    Icon: typeof Share2,
    onClick: () => void,
    active = false,
  ) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-[15px] font-medium transition-colors",
        active ? "bg-secondary" : "hover:bg-secondary",
      )}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} /> {label}
    </button>
  );
  const primaryButton = (label: string, Icon: typeof Share2, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-lg bg-primary px-4 text-[15px] font-semibold text-primary-foreground hover:bg-primary/90"
    >
      <Icon className="h-[18px] w-[18px]" /> {label}
    </button>
  );
  const editPanel = editing && (
    <div className="rounded-2xl bg-card p-4 shadow-lift">
      {mode === "floor" ? (
        <>
          <p className="text-sm leading-relaxed">
            Цэнхэр <b>дээд 2 цэгийг</b> арын хана шалтай нийлсэн буланд, <b>доод 2 цэгийг</b> хажуу
            хананы шугамын дагуу байрлуулна. Хавтангууд дөрвөлжин харагдах хүртэл хэмжээг тааруулна.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
                  className="mt-1 w-full accent-[var(--primary)]"
                />
              </label>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-sm leading-relaxed">
            Хивсэн доор орох ёсгүй тавилга, ургамлыг будаж хамгаална. Алдаатай будсаныг арилгагчаар
            засна.
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
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border",
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
            <label className="flex min-w-36 flex-1 items-center gap-2 text-sm">
              Хэмжээ
              <input
                type="range"
                min={10}
                max={120}
                value={brush.size}
                onChange={(e) => setBrush((b) => ({ ...b, size: Number(e.target.value) }))}
                className="w-full accent-[var(--primary)]"
              />
            </label>
          </div>
        </>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          onClick={() => {
            if (mode === "furniture") {
              const c = keepRef.current;
              c?.getContext("2d")!.clearRect(0, 0, c.width, c.height);
              setMaskVersion((v) => v + 1);
            } else if (room.id === "upload")
              setRoom((r) => r && { ...r, quad: uploadQuad(r.photo.width, r.photo.height) });
            else void loadPreset(room.id);
          }}
        >
          <RotateCcw className="h-4 w-4" />{" "}
          {mode === "furniture" ? "Бүгдийг арилгах" : "Анхны байрлал"}
        </button>
        <button
          type="button"
          onClick={() => setMode("view")}
          className="h-10 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          Болсон
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 bg-background lg:grid lg:grid-cols-[350px_minmax(0,1fr)]">
      {/* Computers: product column */}
      <aside className="hidden min-h-0 flex-col border-r border-border bg-card lg:flex">
        <div className="flex items-center gap-2 px-3 pb-4 pt-4">
          <button
            type="button"
            aria-label="Буцах"
            onClick={goBack}
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-secondary"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-md bg-white">
            <img src={settings.logo} alt="" className="h-full w-full object-contain" />
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight">
            {settings.brandName}
          </span>
        </div>
        <div className="min-h-0 flex-1">
          <CatalogPanel
            items={items}
            typeNames={typeNames}
            selectedKey={compare?.key ?? selectedKey}
            pendingKey={pendingKey}
            onSelect={choose}
            query={query}
            setQuery={setQuery}
            filters={filters}
            setFilters={setFilters}
          />
        </div>
      </aside>

      {/* The room */}
      <main className="relative h-full min-w-0 overflow-hidden">
        {backdrop && (
          <img
            src={backdrop}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-125 object-cover opacity-80 blur-2xl"
          />
        )}
        <div className="absolute inset-0 bg-background/35" />

        <div
          ref={areaRef}
          className={cn(
            "absolute inset-x-0 top-[76px] lg:top-[88px]",
            editing
              ? "bottom-[250px] lg:bottom-[210px]"
              : selected
                ? "bottom-[214px] lg:bottom-[104px]"
                : "bottom-[176px] lg:bottom-6",
          )}
        >
          <div
            className={cn(
              "absolute left-1/2 top-1/2 overflow-hidden",
              mode !== "view" || compare || zoom.s > 1 ? "touch-none" : "",
              mode === "floor" &&
                "bg-[repeating-linear-gradient(45deg,var(--surface)_0_10px,var(--muted)_10px_20px)]",
            )}
            style={{ width: stageW, height: stageH, transform: "translate(-50%, -50%)" }}
          >
            <div
              className="absolute inset-0 transition-transform duration-200"
              style={{ transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})` }}
            >
              <canvas
                ref={canvasRef}
                width={W}
                height={H}
                aria-label="Өрөөний урьдчилсан харагдац"
                className="absolute shadow-lift"
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
                  mode === "view" && compare && "cursor-ew-resize",
                  mode === "view" && !compare && zoom.s > 1 && "cursor-grab",
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
                    r={((brush.size / 2) * screenScale) / zoom.s}
                    fill={brush.tool === "keep" ? "rgba(255,255,255,0.25)" : "rgba(220,38,38,0.2)"}
                    stroke="white"
                    strokeWidth={1.5 * screenScale}
                  />
                )}
                {mode === "view" && compare && (
                  <g>
                    <line
                      x1={compare.x * W}
                      x2={compare.x * W}
                      y1={0}
                      y2={H}
                      stroke="white"
                      strokeWidth={3 * screenScale}
                    />
                    <circle
                      cx={compare.x * W}
                      cy={H / 2}
                      r={handle * 2}
                      fill="white"
                      stroke="var(--primary)"
                      strokeWidth={2 * screenScale}
                    />
                    <path
                      d={`M ${compare.x * W - handle * 0.9} ${H / 2} l ${handle * 0.6} ${-handle * 0.6} m 0 ${handle * 1.2} l ${-handle * 0.6} ${-handle * 0.6} M ${compare.x * W + handle * 0.9} ${H / 2} l ${-handle * 0.6} ${-handle * 0.6} m 0 ${handle * 1.2} l ${handle * 0.6} ${-handle * 0.6}`}
                      stroke="var(--primary)"
                      strokeWidth={1.6 * screenScale}
                      fill="none"
                    />
                  </g>
                )}
              </svg>
            </div>
            {mode === "view" && compare && (
              <div className="pointer-events-none absolute inset-x-2 top-2 flex justify-between gap-2 text-xs font-semibold">
                <span className="max-w-[48%] truncate rounded-full bg-card/90 px-3 py-1 shadow-soft">
                  {selected?.name ?? "Хивс сонгоогүй"}
                </span>
                <span className="max-w-[48%] truncate rounded-full bg-card/90 px-3 py-1 shadow-soft">
                  {otherItem?.name ?? "Одоогийн шал"}
                </span>
              </div>
            )}
            {mode === "view" && compare && !compare.key && (
              <p className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit max-w-[90%] rounded-full bg-foreground/75 px-4 py-1.5 text-center text-xs font-medium text-background backdrop-blur">
                {selected
                  ? "Харьцуулах хоёр дахь хивсээ сонгоно уу"
                  : "Эхлээд нэг хивс, дараа нь харьцуулах хивсээ сонгоно уу"}
              </p>
            )}
          </div>
          {busy && <ProgressRing busy={busy} />}
          {roomLoading && !busy && <ProgressRing busy={{ label: "Өрөө ачаалж байна", pct: 50 }} />}
          {askFeedback && !busy && mode === "view" && (
            <div className="absolute bottom-2 right-3 z-10 flex items-center gap-1 rounded-full bg-card/95 py-1 pl-4 pr-1 text-sm shadow-lift backdrop-blur">
              Шал зөв танигдсан уу?
              <button
                type="button"
                aria-label="Тийм, зөв байна"
                onClick={() => {
                  setAskFeedback(false);
                  toast.success("Баярлалаа!");
                }}
                className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"
              >
                <ThumbsUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Үгүй, буруу байна"
                onClick={() => {
                  setAskFeedback(false);
                  setMode("floor");
                }}
                className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"
              >
                <ThumbsDown className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Top toolbar */}
        <div className="absolute inset-x-2 top-2 z-30 flex h-16 items-center justify-between gap-1 rounded-2xl bg-card/95 px-2 shadow-soft backdrop-blur lg:inset-x-10 lg:top-0 lg:rounded-t-none lg:px-4">
          {/* Phones */}
          <div className="flex min-w-0 flex-1 items-center justify-center gap-1 lg:hidden">
            {toolbarButton("Хуваалцах", Share2, () => void share())}
            {primaryButton("Өрөө солих", Home, () => setRoom(null))}
          </div>
          {/* Computers */}
          <div className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex">
            {selected ? (
              <>
                {toolbarButton("Хуваалцах", Share2, () => void share())}
                {toolbarButton("Татах", Download, () => void download())}
                {toolbarButton("Бүтээгдэхүүний мэдээлэл", Info, () =>
                  window.open(
                    `/products/${encodeURIComponent(selected.product.slug)}?color=${encodeURIComponent(selected.variant.id)}`,
                    "_blank",
                  ),
                )}
                {primaryButton("Захиалах", ShoppingCart, () => void order())}
              </>
            ) : (
              <>
                {toolbarButton("Харьцуулах", Columns2, startCompare, !!compare)}
                {toolbarButton("Томруулах", ZoomIn, toggleZoom, zoom.s > 1)}
                {toolbarButton("Хуваалцах", Share2, () => void share())}
                {toolbarButton("Татах", Download, () => void download())}
                {primaryButton("Зураг оруулах", ImagePlus, () => {
                  warmDetector();
                  fileRef.current?.click();
                })}
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center border-l border-border pl-1 lg:pl-3">
            {menu(
              <>
                <div className="lg:hidden">
                  <DropdownMenuItem onSelect={() => void download()}>
                    <Download className="h-4 w-4" /> Зураг татах
                  </DropdownMenuItem>
                  {selected && (
                    <DropdownMenuItem onSelect={() => void order()}>
                      <ShoppingCart className="h-4 w-4" /> Захиалах
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                </div>
              </>,
            )}
          </div>
        </div>

        {/* Mode chips */}
        {(compare || zoom.s > 1) && mode === "view" && (
          <div className="absolute left-1/2 top-[84px] z-20 -translate-x-1/2 lg:top-[96px]">
            <button
              type="button"
              onClick={() => (compare ? setCompare(null) : setZoom({ s: 1, x: 0, y: 0 }))}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground/80 px-4 text-sm font-medium text-background shadow-lift backdrop-blur"
            >
              <X className="h-4 w-4" /> {compare ? "Харьцуулалтаас гарах" : "Томруулалтаас гарах"}
            </button>
          </div>
        )}

        {/* Computers: selected floor bar, or the editing tools */}
        <div className="absolute inset-x-10 bottom-4 z-30 hidden lg:block">
          {editing ? (
            <div className="mx-auto max-w-2xl">{editPanel}</div>
          ) : (
            selected && (
              <div className="flex h-[72px] items-center gap-4 rounded-2xl bg-card/95 px-3 shadow-soft backdrop-blur">
                <span className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-surface">
                  {selected.image && (
                    <img src={selected.image} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{selected.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[
                      selected.code,
                      selected.size,
                      formatPrice(
                        variantPrice(selected.product, selected.variant),
                        priceUnitOf(selected.product),
                      ),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="h-10 w-px bg-border" />
                {toolbarButton("Анхны шал", RotateCcw, clearFloor)}
                {toolbarButton("Эргүүлэх", RotateCw, () => setAngle((a) => (a + 90) % 180))}
                {lookButton(
                  "inline-flex h-11 items-center gap-2 rounded-lg px-3 text-[15px] font-medium hover:bg-secondary",
                )}
              </div>
            )
          )}
        </div>

        {/* Phones: drawer with the floors */}
        <div className="absolute inset-x-0 bottom-0 z-30 lg:hidden">
          {editing ? (
            <div className="p-2">{editPanel}</div>
          ) : (
            <div
              className={cn(
                "flex flex-col rounded-t-3xl bg-card shadow-lift",
                drawer ? "h-[78dvh]" : "",
              )}
            >
              <button
                type="button"
                aria-label={drawer ? "Хураах" : "Бүх хивсийг харах"}
                onClick={() => setDrawer((d) => (d ? null : "list"))}
                className="flex h-7 w-full shrink-0 items-center justify-center"
              >
                <span className="h-1 w-12 rounded-full bg-muted-foreground/40" />
              </button>
              {drawer ? (
                <div className="min-h-0 flex-1 pb-2">
                  <CatalogPanel
                    key={drawer}
                    items={items}
                    typeNames={typeNames}
                    selectedKey={compare?.key ?? selectedKey}
                    pendingKey={pendingKey}
                    onSelect={choose}
                    query={query}
                    setQuery={setQuery}
                    filters={filters}
                    setFilters={setFilters}
                    open={drawer === "list" ? null : drawer}
                  />
                </div>
              ) : (
                <>
                  {selected && (
                    <div className="flex items-center gap-1 px-4 pb-1">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {selected.name}
                      </span>
                      <button
                        type="button"
                        aria-label="Анхны шал"
                        onClick={clearFloor}
                        className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"
                      >
                        <RotateCcw className="h-[18px] w-[18px]" />
                      </button>
                      <button
                        type="button"
                        aria-label="Эргүүлэх"
                        onClick={() => setAngle((a) => (a + 90) % 180)}
                        className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"
                      >
                        <RotateCw className="h-[18px] w-[18px]" />
                      </button>
                      {lookButton(
                        "grid h-9 w-9 place-items-center rounded-full hover:bg-secondary",
                        true,
                      )}
                    </div>
                  )}
                  <div className="flex gap-3 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none]">
                    {visibleItems.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        aria-label={item.name}
                        aria-pressed={item.key === (compare?.key ?? selectedKey)}
                        onClick={() => choose(item)}
                        className={cn(
                          "relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-lg border-2 bg-surface",
                          item.key === (compare?.key ?? selectedKey)
                            ? "border-primary"
                            : "border-transparent",
                        )}
                      >
                        {item.image && (
                          <img
                            src={item.image}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end gap-1 px-3 pb-[max(env(safe-area-inset-bottom),8px)]">
                    <button
                      type="button"
                      aria-label="Хивс хайх"
                      onClick={() => setDrawer("search")}
                      className="grid h-10 w-10 place-items-center rounded-full hover:bg-secondary"
                    >
                      <Search className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Шүүлтүүр"
                      onClick={() => setDrawer("filters")}
                      className="grid h-10 w-10 place-items-center rounded-full hover:bg-secondary"
                    >
                      <SlidersHorizontal className="h-5 w-5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
