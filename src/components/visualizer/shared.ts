import { useEffect, useMemo, useState } from "react";
import {
  buildTexture,
  findTile,
  type Crop,
  type Layout,
  type Texture,
} from "@/lib/room-visualizer";
import type { ColorVariant, Product } from "@/lib/products";

/** One thing the customer can lay on the floor: a colour of a product. */
export type VizItem = {
  key: string;
  product: Product;
  variant: ColorVariant;
  name: string;
  code: string;
  image: string;
  /** "500 мм × 500 мм" */
  size: string;
  typeId: string;
};

export type Filters = { types: string[]; sizes: string[] };
export const NO_FILTERS: Filters = { types: [], sizes: [] };

export function filterItems(items: VizItem[], query: string, filters: Filters) {
  const needle = query.trim().toLowerCase();
  return items.filter(
    (i) =>
      (!needle || i.name.toLowerCase().includes(needle) || i.code.toLowerCase().includes(needle)) &&
      (!filters.types.length || filters.types.includes(i.typeId)) &&
      (!filters.sizes.length || filters.sizes.includes(i.size)),
  );
}

/** What the visualizer is busy with, shown as a ring with a percentage. */
export type Busy = { label: string; pct: number; done?: boolean };

export const loadImage = (src: string, cors: boolean) =>
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

type Source = { img: HTMLImageElement; crop: Crop };
/** Product photos already prepared in this visit. */
const sources = new Map<string, Source>();

/**
 * The floor pattern for an item. The previous pattern stays on screen until the new one is
 * ready, and `busy` reports the progress so a click always gets visible feedback.
 */
export function useTileTexture(item: VizItem | null, layout: Layout, seams: boolean) {
  const [ready, setReady] = useState<{ source: Source; w: number; l: number } | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  const src = item?.image ?? "";
  const label = item?.name ?? "";
  const w = item?.product.widthM || 0.5;
  const l = item?.product.lengthM || item?.product.widthM || 0.5;
  useEffect(() => {
    if (!src) {
      setReady(null);
      setBusy(null);
      return;
    }
    let live = true;
    let hide = 0;
    let timer = 0;
    const finish = (source: Source) => {
      if (!live) return;
      setReady({ source, w, l });
      setBusy({ label, pct: 100, done: true });
      hide = window.setTimeout(() => live && setBusy(null), 550);
    };
    const cached = sources.get(src);
    if (cached) {
      // Even an instant swap shows the ring briefly, so the click visibly registers.
      setBusy({ label, pct: 45 });
      hide = window.setTimeout(() => finish(cached), 160);
    } else {
      const started = performance.now();
      let real = 0;
      const show = () => {
        // Creeps on its own while the server reports nothing.
        const idle = 60 * (1 - Math.exp(-(performance.now() - started) / 1500));
        setBusy({ label, pct: Math.round(Math.max(real * 92, idle)) });
      };
      show();
      timer = window.setInterval(() => live && show(), 150);
      loadProductImage(src, (fraction) => {
        real = fraction;
        if (live) show();
      })
        .then((img) => {
          const source = { img, crop: findTile(img) };
          sources.set(src, source);
          finish(source);
        })
        .catch(() => live && setBusy({ label: "Хивсний зургийг ачаалж чадсангүй", pct: 0 }))
        .finally(() => window.clearInterval(timer));
    }
    return () => {
      live = false;
      window.clearTimeout(hide);
      window.clearInterval(timer);
    };
  }, [src, label, w, l]);
  const texture: Texture | null = useMemo(
    () =>
      ready
        ? buildTexture(ready.source.img, ready.source.crop, ready.w, ready.l, layout, seams)
        : null,
    [ready, layout, seams],
  );
  return { texture: src ? texture : null, busy };
}
