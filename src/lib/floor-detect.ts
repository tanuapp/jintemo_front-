/**
 * Finds the floor of a customer's room photo and works out how to lay tiles on it:
 *
 *  1. A segmentation model (in a worker) says which parts of the photo are floor, wall and
 *     ceiling. Everything that is not floor — walls, furniture, plants — stays in front of
 *     the new floor.
 *  2. The model answers on a coarse 128×128 grid; the mask is sharpened against the photo's
 *     own colours (joint bilateral upsampling) so its edges follow the furniture.
 *  3. The camera is taken to be level, at about phone height. The horizon is read from where
 *     a wall meets the ceiling and the floor in the same column; with the focal length (from
 *     the photo's EXIF when present) that fixes the floor plane, so tiles get their real
 *     size and perspective.
 *  4. The tiles are turned to run along the wall the floor ends at.
 */
import type { DetectMessage, DetectRequest } from "./floor-detect.worker";
import type { Pt, Quad } from "./room-visualizer";

export type Detection = {
  quad: Quad;
  floorW: number;
  floorD: number;
  /** Opaque where the photo must stay in front of the new floor. */
  keep: HTMLCanvasElement;
  /** Tile laying angle in degrees, along the far wall. */
  angle: number;
};
export type DetectProgress = { stage: "download" | "analyze"; pct: number };

const MODELS = {
  best: "Xenova/segformer-b2-finetuned-ade-512-512", // 29 MB
  medium: "Xenova/segformer-b1-finetuned-ade-512-512", // 15 MB
  light: "Xenova/segformer-b0-finetuned-ade-512-512", // 4 MB
};
/** Accuracy on computers, a smaller download on phones, the smallest on slow or metered links. */
function pickModel() {
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
    deviceMemory?: number;
  };
  const slow = nav.connection?.saveData || /2g|3g/.test(nav.connection?.effectiveType ?? "");
  if (slow || (nav.deviceMemory ?? 8) <= 2) return MODELS.light;
  const phone =
    matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 820;
  return phone ? MODELS.medium : MODELS.best;
}

let worker: Worker | null = null;
let nextId = 1;
/** Seconds the model took last time on this device; paces the progress bar. */
let typicalRun = 6;
function getWorker() {
  worker ??= new Worker(new URL("./floor-detect.worker.ts", import.meta.url), { type: "module" });
  return worker;
}
/** Start downloading the model as soon as the customer reaches for the upload button. */
export function warmDetector() {
  try {
    getWorker().postMessage({ type: "warm", model: pickModel() } satisfies DetectRequest);
  } catch {
    /* detection is optional; the manual tools still work */
  }
}

type Segmentation = Extract<DetectMessage, { type: "result" }>;

function segment(
  photo: HTMLCanvasElement,
  onProgress: (p: DetectProgress) => void,
): Promise<Segmentation> {
  // The model looks at 512×512; a 640px copy is plenty and quick to hand over.
  const k = Math.min(1, 640 / Math.max(photo.width, photo.height));
  const small = document.createElement("canvas");
  small.width = Math.max(1, Math.round(photo.width * k));
  small.height = Math.max(1, Math.round(photo.height * k));
  const ctx = small.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(photo, 0, 0, small.width, small.height);
  const rgba = ctx.getImageData(0, 0, small.width, small.height).data.buffer as ArrayBuffer;
  const w = getWorker();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    // Downloading reports real bytes; the model itself gives no progress, so the bar
    // creeps towards the end at the pace a typical run takes.
    let base = 4;
    let started = 0;
    const timer = window.setInterval(() => {
      if (!started) return;
      const t = (performance.now() - started) / 1000;
      // About 90% of the remaining bar by the time a typical run ends, then slower.
      onProgress({
        stage: "analyze",
        pct: Math.round(base + (96 - base) * (1 - Math.exp((-2.3 * t) / typicalRun))),
      });
    }, 200);
    const done = () => {
      window.clearInterval(timer);
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
    };
    const onError = () => {
      done();
      reject(new Error("worker"));
    };
    const onMessage = (e: MessageEvent<DetectMessage>) => {
      const m = e.data;
      if (m.type === "download") {
        base = Math.round(4 + 56 * (m.loaded / m.total));
        onProgress({ stage: "download", pct: base });
      } else if ("id" in m && m.id !== id) {
        return;
      } else if (m.type === "ready" || m.type === "infer") {
        if (!started) {
          base = Math.max(base, 60);
          started = performance.now();
        }
      } else if (m.type === "result") {
        if (started) typicalRun = Math.max(1, (performance.now() - started) / 1000);
        done();
        resolve(m);
      } else if (m.type === "error") {
        done();
        reject(new Error(m.message));
      }
    };
    w.addEventListener("message", onMessage);
    w.addEventListener("error", onError);
    onProgress({ stage: "download", pct: base });
    w.postMessage(
      {
        type: "analyze",
        id,
        model: pickModel(),
        width: small.width,
        height: small.height,
        rgba,
      } satisfies DetectRequest,
      [rgba],
    );
  });
}

/* ------------------------------------------------------------- mask */

const pixels = (photo: HTMLCanvasElement, w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(photo, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
};

/**
 * Floor probability at `gw`×`gh`. Each pixel averages the coarse cells around it, trusting
 * the ones whose colour in the photo is like its own: edges snap to the photo's edges.
 */
function sharpen(seg: Segmentation, photo: HTMLCanvasElement, gw: number, gh: number) {
  const guide = pixels(photo, gw, gh);
  const coarse = pixels(photo, seg.w, seg.h);
  const out = new Float32Array(gw * gh);
  const colour = 2 * 16 * 16 * 3; // 2σ² for a colour distance of about 16 per channel
  for (let y = 0; y < gh; y++) {
    const ly = ((y + 0.5) * seg.h) / gh - 0.5;
    const cy = Math.round(ly);
    for (let x = 0; x < gw; x++) {
      const lx = ((x + 0.5) * seg.w) / gw - 0.5;
      const cx = Math.round(lx);
      const g = (y * gw + x) * 4;
      let sum = 0;
      let weight = 0;
      for (let j = -2; j <= 2; j++) {
        const yy = cy + j;
        if (yy < 0 || yy >= seg.h) continue;
        for (let i = -2; i <= 2; i++) {
          const xx = cx + i;
          if (xx < 0 || xx >= seg.w) continue;
          const l = (yy * seg.w + xx) * 4;
          const dr = guide[g]! - coarse[l]!;
          const dg = guide[g + 1]! - coarse[l + 1]!;
          const db = guide[g + 2]! - coarse[l + 2]!;
          const k = Math.exp(
            -((xx - lx) ** 2 + (yy - ly) ** 2) / 2 - (dr * dr + dg * dg + db * db) / colour,
          );
          sum += k * seg.prob[yy * seg.w + xx]!;
          weight += k;
        }
      }
      out[y * gw + x] = weight ? sum / weight : 0;
    }
  }
  return out;
}

/** Drops specks: floor regions much smaller than the main one (a bright table top, a shelf). */
function dropSpecks(prob: Float32Array, w: number, h: number) {
  const label = new Int32Array(w * h);
  const areas: number[] = [0];
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (label[start] || prob[start]! <= 0.5) continue;
    const id = areas.length;
    let area = 0;
    stack.push(start);
    label[start] = id;
    while (stack.length) {
      const p = stack.pop()!;
      area++;
      const x = p % w;
      for (const q of [p - w, p + w, x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1]) {
        if (q < 0 || q >= w * h || label[q] || prob[q]! <= 0.5) continue;
        label[q] = id;
        stack.push(q);
      }
    }
    areas.push(area);
  }
  const largest = Math.max(...areas);
  let kept = 0;
  for (let i = 0; i < w * h; i++) {
    const id = label[i]!;
    if (id && areas[id]! < largest * 0.08) prob[i] = 0;
    else if (id) kept++;
  }
  return kept / (w * h);
}

/* ------------------------------------------------------------- camera */

const CAMERA_HEIGHT = 1.35; // metres: a phone held at chest height
const CEILING_HEIGHT = 2.6;
const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

/**
 * Row of the horizon on the coarse grid. In a column where one wall meets both ceiling and
 * floor, the horizon divides the wall in the ratio of the heights above and below the camera.
 */
function horizonRow(seg: Segmentation) {
  const estimates: number[] = [];
  for (let x = 0; x < seg.w; x++) {
    let ceilingEnd = -1;
    let floorStart = -1;
    for (let y = 0; y < seg.h; y++) {
      const c = seg.cls[y * seg.w + x];
      if (c === seg.ids.ceiling) ceilingEnd = y + 1;
      if (c === seg.ids.floor && floorStart < 0) floorStart = y;
    }
    if (ceilingEnd < 0 || floorStart - ceilingEnd < seg.h * 0.05) continue;
    estimates.push(
      ceilingEnd + ((floorStart - ceilingEnd) * (CEILING_HEIGHT - CAMERA_HEIGHT)) / CEILING_HEIGHT,
    );
  }
  return estimates.length >= seg.w * 0.1 ? median(estimates) : null;
}

/**
 * The longest straight stretch of the line where the floor meets a wall, in photo pixels.
 * Fitted in the image, where "straight" has a clear meaning (a couple of pixels), and only
 * trusted when it spans a good part of the photo.
 */
function wallLine(points: Pt[], minimum: number): [Pt, Pt] | null {
  if (points.length < minimum) return null;
  let seed = 12345;
  const random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let best: Pt[] = [];
  for (let n = 0; n < 200; n++) {
    const p = points[Math.floor(random() * points.length)]!;
    const q = points[Math.floor(random() * points.length)]!;
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy);
    if (len < 20) continue;
    const inliers = points.filter(
      (r) => Math.abs((r[0] - p[0]) * dy - (r[1] - p[1]) * dx) / len < 2,
    );
    if (inliers.length > best.length) best = inliers;
  }
  if (best.length < minimum) return null;
  // Least-squares line through the inliers, cut at their extent.
  const mx = best.reduce((t, p) => t + p[0], 0) / best.length;
  const my = best.reduce((t, p) => t + p[1], 0) / best.length;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of best) {
    sxx += (p[0] - mx) ** 2;
    sxy += (p[0] - mx) * (p[1] - my);
    syy += (p[1] - my) ** 2;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const ux = Math.cos(theta);
  const uy = Math.sin(theta);
  const along = best.map((p) => (p[0] - mx) * ux + (p[1] - my) * uy);
  const lo = Math.min(...along);
  const hi = Math.max(...along);
  return [
    [mx + ux * lo, my + uy * lo],
    [mx + ux * hi, my + uy * hi],
  ];
}

export async function detectFloor(
  photo: HTMLCanvasElement,
  options: { focal35?: number | undefined; onProgress: (p: DetectProgress) => void },
): Promise<Detection> {
  const seg = await segment(photo, options.onProgress);
  options.onProgress({ stage: "analyze", pct: 97 });
  const W = photo.width;
  const H = photo.height;
  const gw = Math.min(640, W);
  const gh = Math.max(1, Math.round((H * gw) / W));
  const prob = sharpen(seg, photo, gw, gh);
  if (dropSpecks(prob, gw, gh) < 0.02) throw new Error("no floor");

  // Top of the floor: the first row with more than a sliver of it.
  let top = 0;
  for (let y = 0; y < gh; y++) {
    let n = 0;
    for (let x = 0; x < gw; x++) if (prob[y * gw + x]! > 0.5) n++;
    if (n >= Math.max(3, gw * 0.03)) {
      top = y;
      break;
    }
  }
  const yFar = (top * H) / gh;
  const focal = ((options.focal35 ?? 26) / 43.27) * Math.hypot(W, H);
  const row = horizonRow(seg);
  let horizon = row === null ? yFar - 0.3 * focal : (row * H) / seg.h;
  // The floor always lies below the horizon, and never absurdly far away.
  horizon = Math.min(horizon, yFar - 0.04 * H, yFar - (focal * CAMERA_HEIGHT) / 30);
  const zFar = (focal * CAMERA_HEIGHT) / (yFar - horizon);

  // A rectangle on the floor plane, a little wider than the photo, in the shape the
  // manual tool edits: far edge at the top of the floor, near edge closer to the camera.
  const ratio = Math.max(1.04, Math.min(1.27, (1.18 * H - horizon) / (yFar - horizon)));
  const yNear = horizon + ratio * (yFar - horizon);
  const half = 0.55 * W;
  const quad: Quad = [
    [W / 2 - half, yFar],
    [W / 2 + half, yFar],
    [W / 2 + half * ratio, yNear],
    [W / 2 - half * ratio, yNear],
  ];

  // Where the floor ends at a wall. A wall seen at an angle makes that line slope in the
  // photo; put its two ends on the floor plane and the tiles can run along it. Walls seen
  // nearly head-on are left square to the camera: a few degrees would be estimation noise.
  const boundary: Pt[] = [];
  for (let x = 0; x < gw; x += 2) {
    let y = 0;
    while (y < gh && prob[y * gw + x]! <= 0.5) y++;
    if (y < 3 || y >= gh) continue;
    const above =
      seg.cls[Math.floor(((y - 3) * seg.h) / gh) * seg.w + Math.floor((x * seg.w) / gw)];
    if (above === seg.ids.wall) boundary.push([x + 0.5, y]);
  }
  let angle = 0;
  const line = wallLine(boundary, gw * 0.1); // points are two pixels apart: 20% of the width
  if (line) {
    const onFloor = ([x, y]: Pt) => {
      const z = (focal * CAMERA_HEIGHT) / Math.max((y * H) / gh - horizon, 0.01 * H);
      return { x: (((x * W) / gw - W / 2) * z) / focal, z };
    };
    const p = onFloor(line[0]);
    const q = onFloor(line[1]);
    // Texture y runs towards the camera, opposite to depth.
    const degrees = (Math.atan2(-(q.z - p.z), q.x - p.x) * 180) / Math.PI;
    const turned = ((degrees % 90) + 90) % 90;
    angle = turned < 8 || turned > 82 ? 0 : Math.round(turned);
  }

  const mask = document.createElement("canvas");
  mask.width = gw;
  mask.height = gh;
  const m = mask.getContext("2d")!;
  const image = m.createImageData(gw, gh);
  for (let i = 0; i < gw * gh; i++) {
    // Lean towards the new floor at the edge: a sliver of carpet over a chair leg is far
    // less visible than a halo of the old floor around it.
    const t = Math.min(1, Math.max(0, (prob[i]! - 0.3) / 0.2));
    image.data.set([255, 255, 255, Math.round(255 * (1 - t * t * (3 - 2 * t)))], i * 4);
  }
  m.putImageData(image, 0, 0);
  const keep = document.createElement("canvas");
  keep.width = W;
  keep.height = H;
  const k = keep.getContext("2d")!;
  k.imageSmoothingQuality = "high";
  k.drawImage(mask, 0, 0, W, H);

  return {
    quad,
    floorW: (2 * half * zFar) / focal,
    floorD: zFar * (1 - 1 / ratio),
    keep,
    angle,
  };
}

/** The photo's 35mm-equivalent focal length from its EXIF, when the camera recorded it. */
export async function readFocal35(file: File): Promise<number | undefined> {
  if (file.type !== "image/jpeg") return undefined;
  try {
    const view = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (view.getUint16(0) !== 0xffd8) return undefined;
    let offset = 2;
    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset);
      if ((marker & 0xff00) !== 0xff00) return undefined;
      if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966) {
        const tiff = offset + 10;
        const little = view.getUint16(tiff) === 0x4949;
        const u16 = (o: number) => view.getUint16(o, little);
        const u32 = (o: number) => view.getUint32(o, little);
        const entry = (ifd: number, tag: number) => {
          const count = u16(ifd);
          for (let i = 0; i < count; i++)
            if (u16(ifd + 2 + i * 12) === tag) return ifd + 2 + i * 12;
          return -1;
        };
        const exifPointer = entry(tiff + u32(tiff + 4), 0x8769);
        if (exifPointer < 0) return undefined;
        const focal = entry(tiff + u32(exifPointer + 8), 0xa405);
        const value = focal < 0 ? 0 : u16(focal + 8);
        return value > 0 ? value : undefined;
      }
      offset += 2 + view.getUint16(offset + 2);
    }
  } catch {
    /* unreadable EXIF: fall back to a typical phone lens */
  }
  return undefined;
}
