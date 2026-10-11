/**
 * Room visualizer engine: lays a product's tiles on the floor of a room photo with
 * correct perspective, keeps the photo's light and shadows, and keeps furniture in front.
 *
 * The floor is a plane. The user marks four points on it — the two far corners where the
 * back wall meets the floor, and one point down each side wall — and gives the real width
 * and depth of that rectangle. A homography maps floor metres to photo pixels; the floor is
 * extended towards the camera until it leaves the photo. The tile pattern is filled in
 * small triangles, each with the affine transform of its patch (projective texture mapping
 * on a 2D canvas).
 */

export type Pt = [number, number];
/** Far-left, far-right, near-right, near-left — clockwise from the back wall. */
export type Quad = [Pt, Pt, Pt, Pt];
export type Layout = "straight" | "quarter" | "brick";

type Homography = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  g: number;
  h: number;
};

/** Unit square (u across, v towards the camera) → photo pixels. */
export function homography(q: Quad): Homography {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  let g = 0;
  let h = 0;
  const den = dx1 * dy2 - dx2 * dy1;
  if ((Math.abs(sx) > 1e-9 || Math.abs(sy) > 1e-9) && Math.abs(den) > 1e-12) {
    g = (sx * dy2 - dx2 * sy) / den;
    h = (dx1 * sy - sx * dy1) / den;
  }
  return {
    a: x1 - x0 + g * x1,
    b: x3 - x0 + h * x3,
    c: x0,
    d: y1 - y0 + g * y1,
    e: y3 - y0 + h * y3,
    f: y0,
    g,
    h,
  };
}

export function project(H: Homography, u: number, v: number): [number, number, number] {
  const w = H.g * u + H.h * v + 1;
  return [(H.a * u + H.b * v + H.c) / w, (H.d * u + H.e * v + H.f) / w, w];
}

/**
 * How far (in units of the marked depth) the floor continues towards the camera before it
 * leaves the photo. Stops early if the user's points would bend the plane past the horizon.
 */
export function floorExtent(H: Homography, height: number) {
  let v = 1;
  while (v < 8) {
    const left = project(H, 0, v);
    const right = project(H, 1, v);
    if (left[2] < 0.05 || right[2] < 0.05) return Math.max(1, v - 0.25);
    if (left[1] > height + 4 && right[1] > height + 4) return v;
    v += 0.25;
  }
  return v;
}

/** The painted floor area in photo pixels (lines stay lines under a homography). */
export function floorOutline(q: Quad, height: number): Pt[] {
  const H = homography(q);
  const vmax = floorExtent(H, height);
  return [project(H, 0, 0), project(H, 1, 0), project(H, 1, vmax), project(H, 0, vmax)].map(
    ([x, y]) => [x, y] as Pt,
  );
}

/* ---------------------------------------------------------------- textures */

export type Crop = { sx: number; sy: number; sw: number; sh: number };

/**
 * Product photos show one tile on a white background with fluffy edges. Find the tile and
 * cut a little inside it so the edges do not repeat as stripes. Photos that fill the frame,
 * or that cannot be read (cross-origin), are used whole.
 */
export function findTile(img: HTMLImageElement): Crop {
  const whole = { sx: 0, sy: 0, sw: img.naturalWidth, sh: img.naturalHeight };
  try {
    const size = 160;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const at = (x: number, y: number) => {
      const i = (y * size + x) * 4;
      return [data[i]!, data[i + 1]!, data[i + 2]!] as const;
    };
    const corners = [at(1, 1), at(size - 2, 1), at(1, size - 2), at(size - 2, size - 2)];
    const bg = [0, 1, 2].map((k) => corners.reduce((s, c) => s + c[k]!, 0) / 4);
    if (bg.some((v) => v < 215)) return whole;
    let x0 = size;
    let y0 = size;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const p = at(x, y);
        if (Math.abs(p[0] - bg[0]!) + Math.abs(p[1] - bg[1]!) + Math.abs(p[2] - bg[2]!) > 60) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
      }
    if (x1 - x0 < size * 0.3 || y1 - y0 < size * 0.3) return whole;
    // Step inside the fringe: 6% of the tile on every side.
    const ix = (x1 - x0) * 0.06;
    const iy = (y1 - y0) * 0.06;
    const k = img.naturalWidth / size;
    const l = img.naturalHeight / size;
    return {
      sx: (x0 + ix) * k,
      sy: (y0 + iy) * l,
      sw: (x1 - x0 - 2 * ix) * k,
      sh: (y1 - y0 - 2 * iy) * l,
    };
  } catch {
    return whole;
  }
}

/**
 * Product photos are often shot in sunlight: a shadow across one tile would repeat as
 * stripes over the whole floor. Divide out the slow brightness changes (a blurred copy)
 * and keep the weave. The room's own light is added back later.
 */
function flattenLight(tile: HTMLCanvasElement) {
  const { width: w, height: h } = tile;
  const t = tile.getContext("2d", { willReadFrequently: true })!;
  let pixels: ImageData;
  try {
    pixels = t.getImageData(0, 0, w, h);
  } catch {
    return; // cross-origin photo without CORS: use as is
  }
  const small = document.createElement("canvas");
  small.width = 12;
  small.height = 12;
  const s = small.getContext("2d")!;
  s.imageSmoothingQuality = "high";
  // Halve step by step so the 12×12 average is a true average, not a sample.
  let src: HTMLCanvasElement = tile;
  while (src.width > 48) {
    const next = document.createElement("canvas");
    next.width = Math.max(12, Math.round(src.width / 2));
    next.height = Math.max(12, Math.round(src.height / 2));
    next.getContext("2d")!.drawImage(src, 0, 0, next.width, next.height);
    src = next;
  }
  s.drawImage(src, 0, 0, 12, 12);
  const blur = document.createElement("canvas");
  blur.width = w;
  blur.height = h;
  const b = blur.getContext("2d", { willReadFrequently: true })!;
  b.imageSmoothingEnabled = true;
  b.imageSmoothingQuality = "high";
  b.drawImage(small, 0, 0, w, h);
  const low = b.getImageData(0, 0, w, h).data;
  const d = pixels.data;
  // Per colour channel, so a bluish shadow tint goes as well as the darkness.
  const mean = [0, 0, 0];
  for (let i = 0; i < d.length; i += 4) for (let ch = 0; ch < 3; ch++) mean[ch]! += low[i + ch]!;
  for (let ch = 0; ch < 3; ch++) mean[ch] = mean[ch]! / (d.length / 4);
  for (let i = 0; i < d.length; i += 4)
    for (let ch = 0; ch < 3; ch++)
      d[i + ch] = d[i + ch]! * Math.min(2.2, mean[ch]! / Math.max(8, low[i + ch]!));
  t.putImageData(pixels, 0, 0);
}

export type Texture = {
  /** One repeat of the layout. */
  block: HTMLCanvasElement;
  /** Pattern pixels per metre on the floor. */
  pxPerM: number;
  /** The quarter-turn layout only works for square tiles. */
  quarterPossible: boolean;
};

/**
 * One repeat of the floor pattern. Rolls (much longer than wide) repeat their swatch every
 * width along the length and only show the seams between rolls.
 */
export function buildTexture(
  img: HTMLImageElement,
  crop: Crop,
  tileW: number,
  tileL: number,
  layout: Layout,
  seams: boolean,
): Texture {
  const roll = tileL / tileW > 3;
  const repL = roll ? tileW : tileL;
  const pxPerM = 256 / Math.max(tileW, repL);
  const tw = Math.max(8, Math.round(tileW * pxPerM));
  const tl = Math.max(8, Math.round(repL * pxPerM));
  const tile = document.createElement("canvas");
  tile.width = tw;
  tile.height = tl;
  const t = tile.getContext("2d")!;
  t.imageSmoothingQuality = "high";
  t.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, tw, tl);
  flattenLight(tile);
  if (seams) {
    const line = Math.max(1, Math.round(tw / 140));
    t.fillStyle = "rgba(0,0,0,0.30)";
    t.fillRect(0, 0, line, tl);
    if (!roll) t.fillRect(0, 0, tw, line);
    t.fillStyle = "rgba(255,255,255,0.10)";
    t.fillRect(line, 0, line, tl);
    if (!roll) t.fillRect(0, line, tw, line);
  }
  const quarterPossible = !roll && Math.abs(tw - tl) <= 1;
  const mode = layout === "quarter" && !quarterPossible ? "straight" : layout;
  const block = document.createElement("canvas");
  const b = block.getContext("2d")!;
  if (mode === "quarter") {
    block.width = tw * 2;
    block.height = tl * 2;
    const turned = (x: number, y: number) => {
      b.save();
      b.translate(x + tw / 2, y + tl / 2);
      b.rotate(Math.PI / 2);
      b.drawImage(tile, -tw / 2, -tl / 2);
      b.restore();
    };
    b.drawImage(tile, 0, 0);
    turned(tw, 0);
    turned(0, tl);
    b.drawImage(tile, tw, tl);
  } else if (mode === "brick") {
    block.width = tw;
    block.height = tl * 2;
    b.drawImage(tile, 0, 0);
    b.drawImage(tile, -tw / 2, tl);
    b.drawImage(tile, tw / 2, tl);
  } else {
    block.width = tw;
    block.height = tl;
    b.drawImage(tile, 0, 0);
  }
  return { block, pxPerM, quarterPossible };
}

/* ---------------------------------------------------------------- lighting */

export type Light = { lum: Float32Array; w: number; h: number };

/** A heavily blurred brightness map of the photo: soft light and shadow, no texture. */
export function measureLight(photo: HTMLCanvasElement): Light {
  let src: HTMLCanvasElement = photo;
  while (src.width > 96) {
    const next = document.createElement("canvas");
    next.width = Math.max(1, Math.round(src.width / 2));
    next.height = Math.max(1, Math.round(src.height / 2));
    const n = next.getContext("2d")!;
    n.imageSmoothingQuality = "high";
    n.drawImage(src, 0, 0, next.width, next.height);
    src = next;
  }
  const w = 48;
  const h = Math.max(1, Math.round((photo.height / photo.width) * 48));
  const small = document.createElement("canvas");
  small.width = w;
  small.height = h;
  const s = small.getContext("2d", { willReadFrequently: true })!;
  s.filter = "blur(1.5px)";
  s.drawImage(src, 0, 0, w, h);
  const { data } = s.getImageData(0, 0, w, h);
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++)
    lum[i] = 0.2126 * data[i * 4]! + 0.7152 * data[i * 4 + 1]! + 0.0722 * data[i * 4 + 2]!;
  return { lum, w, h };
}

const inside = (p: Pt, poly: Pt[]) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

export type Shading = { shadow: HTMLCanvasElement; light: HTMLCanvasElement };

/**
 * Relative brightness of the floor: shadows darken the new floor (multiply) and sunlit
 * patches brighten it (screen). `strength` 0 ignores the photo's light, 1 keeps it fully.
 */
export function shadeFloor(light: Light, outline: Pt[], photoW: number, strength: number): Shading {
  const { lum, w, h } = light;
  const k = w / photoW;
  const region = outline.map(([x, y]) => [x * k, y * k] as Pt);
  const values: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (inside([x + 0.5, y + 0.5], region)) values.push(lum[y * w + x]!);
  values.sort((a, b) => a - b);
  const ref = values.length ? values[Math.floor(values.length * 0.6)]! : 160;
  const make = () => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  };
  const shadow = make();
  const lightC = make();
  const sd = shadow.getContext("2d")!.createImageData(w, h);
  const ld = lightC.getContext("2d")!.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const s = 1 + (lum[i]! / Math.max(ref, 1) - 1) * strength;
    const dark = Math.round(255 * Math.min(1, Math.max(0.15, s)));
    const bright = Math.round(255 * Math.min(0.6, Math.max(0, (s - 1) * 0.8)));
    sd.data.set([dark, dark, dark, 255], i * 4);
    ld.data.set([bright, bright, bright, 255], i * 4);
  }
  shadow.getContext("2d")!.putImageData(sd, 0, 0);
  lightC.getContext("2d")!.putImageData(ld, 0, 0);
  return { shadow, light: lightC };
}

/* ---------------------------------------------------------------- render */

export type Scene = {
  photo: HTMLCanvasElement;
  quad: Quad;
  /** Real width (far edge) and depth of the marked rectangle, in metres. */
  floorW: number;
  floorD: number;
  texture: Texture | null;
  /** Laying angle of the tiles, degrees. */
  angle: number;
  shading: Shading | null;
  /** Painted where furniture stands: the original photo shows through. */
  keep: HTMLCanvasElement | null;
  /** Before/after divider in photo pixels; the right side shows the original. */
  compareX: number | null;
  draft?: boolean;
};

let scratch: HTMLCanvasElement | null = null;

export function renderScene(ctx: CanvasRenderingContext2D, s: Scene) {
  const W = s.photo.width;
  const H0 = s.photo.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.drawImage(s.photo, 0, 0);
  if (s.texture) {
    const H = homography(s.quad);
    const vmax = floorExtent(H, H0);
    const outline = floorOutline(s.quad, H0);
    ctx.save();
    ctx.beginPath();
    outline.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.clip();
    const pattern = ctx.createPattern(s.texture.block, "repeat")!;
    // Underlay in the floor's own colours: any hairline between triangles shows tile, not photo.
    pattern.setTransform(new DOMMatrix().scale(0.25));
    ctx.fillStyle = pattern;
    ctx.fill();
    pattern.setTransform(new DOMMatrix().rotate(s.angle));
    ctx.fillStyle = pattern;
    ctx.imageSmoothingQuality = "high";
    const P = s.texture.pxPerM;
    const cols = s.draft ? 10 : 22;
    const rows = Math.min(s.draft ? 24 : 64, Math.ceil(cols * vmax * 1.2));
    const grid: { s: [number, number]; t: [number, number] }[][] = [];
    for (let j = 0; j <= rows; j++) {
      const row: { s: [number, number]; t: [number, number] }[] = [];
      // Denser rows near the back, where perspective changes fastest.
      const v = vmax * (j / rows) ** 1.35;
      for (let i = 0; i <= cols; i++) {
        const u = i / cols;
        const [x, y] = project(H, u, v);
        row.push({ s: [x, y], t: [u * s.floorW * P, v * s.floorD * P] });
      }
      grid.push(row);
    }
    const tri = (
      p0: { s: [number, number]; t: [number, number] },
      p1: { s: [number, number]; t: [number, number] },
      p2: { s: [number, number]; t: [number, number] },
    ) => {
      const [tx0, ty0] = p0.t;
      const [tx1, ty1] = p1.t;
      const [tx2, ty2] = p2.t;
      const [sx0, sy0] = p0.s;
      const [sx1, sy1] = p1.s;
      const [sx2, sy2] = p2.s;
      const det = (tx1 - tx0) * (ty2 - ty0) - (tx2 - tx0) * (ty1 - ty0);
      if (Math.abs(det) < 1e-9) return;
      const a = ((sx1 - sx0) * (ty2 - ty0) - (sx2 - sx0) * (ty1 - ty0)) / det;
      const c = ((sx2 - sx0) * (tx1 - tx0) - (sx1 - sx0) * (tx2 - tx0)) / det;
      const b = ((sy1 - sy0) * (ty2 - ty0) - (sy2 - sy0) * (ty1 - ty0)) / det;
      const d = ((sy2 - sy0) * (tx1 - tx0) - (sy1 - sy0) * (tx2 - tx0)) / det;
      const e = sx0 - a * tx0 - c * ty0;
      const f = sy0 - b * tx0 - d * ty0;
      const m = a * d - b * c;
      if (Math.abs(m) < 1e-12) return;
      // Grow each triangle by ~1.2px on screen so neighbours overlap without hairlines.
      const cx = (sx0 + sx1 + sx2) / 3;
      const cy = (sy0 + sy1 + sy2) / 3;
      const back = (x: number, y: number): [number, number] => {
        const dx = x - cx;
        const dy = y - cy;
        const len = Math.hypot(dx, dy) || 1;
        const X = x + (dx / len) * 1.2 - e;
        const Y = y + (dy / len) * 1.2 - f;
        return [(d * X - c * Y) / m, (-b * X + a * Y) / m];
      };
      ctx.setTransform(a, b, c, d, e, f);
      ctx.beginPath();
      ctx.moveTo(...back(sx0, sy0));
      ctx.lineTo(...back(sx1, sy1));
      ctx.lineTo(...back(sx2, sy2));
      ctx.closePath();
      ctx.fill();
    };
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const p00 = grid[j]![i]!;
        const p10 = grid[j]![i + 1]!;
        const p01 = grid[j + 1]![i]!;
        const p11 = grid[j + 1]![i + 1]!;
        tri(p00, p10, p11);
        tri(p00, p11, p01);
      }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (s.shading) {
      ctx.imageSmoothingEnabled = true;
      ctx.globalCompositeOperation = "multiply";
      ctx.drawImage(s.shading.shadow, 0, 0, W, H0);
      ctx.globalCompositeOperation = "screen";
      ctx.drawImage(s.shading.light, 0, 0, W, H0);
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.restore();
    if (s.keep) {
      scratch ??= document.createElement("canvas");
      if (scratch.width !== W || scratch.height !== H0) {
        scratch.width = W;
        scratch.height = H0;
      }
      const k = scratch.getContext("2d")!;
      k.globalCompositeOperation = "source-over";
      k.clearRect(0, 0, W, H0);
      k.drawImage(s.keep, 0, 0);
      k.globalCompositeOperation = "source-in";
      k.drawImage(s.photo, 0, 0);
      ctx.drawImage(scratch, 0, 0);
    }
  }
  if (s.compareX !== null) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(s.compareX, 0, W - s.compareX, H0);
    ctx.clip();
    ctx.drawImage(s.photo, 0, 0);
    ctx.restore();
  }
}

/* ---------------------------------------------------------------- sample rooms */

export type RoomPreset = {
  id: string;
  name: string;
  w: number;
  h: number;
  quad: Quad;
  floorW: number;
  floorD: number;
  /** Furniture outlines kept in front of the new floor. */
  keep: Pt[][];
};

export const ROOM_PRESETS: RoomPreset[] = [
  {
    id: "living",
    name: "Зочны өрөө",
    w: 1600,
    h: 1104,
    quad: [
      [490, 552],
      [1201, 552],
      [1849, 1000],
      [-297, 1000],
    ],
    floorW: 4.3,
    floorD: 6.5,
    keep: [
      // TV cabinet and the basket beside it
      [
        [0, 480],
        [487, 480],
        [487, 566],
        [486, 694],
        [456, 700],
        [214, 898],
        [172, 898],
        [170, 882],
        [82, 882],
        [82, 990],
        [0, 992],
      ],
      // Coffee table: top, apron and the two visible legs; the floor under it stays new
      [
        [765, 598],
        [973, 598],
        [1007, 690],
        [1007, 722],
        [737, 722],
        [737, 690],
      ],
      [
        [737, 720],
        [757, 720],
        [757, 836],
        [737, 836],
      ],
      [
        [986, 720],
        [1006, 720],
        [1006, 746],
        [986, 746],
      ],
      // Plant on the table, in front of the far floor
      [
        [822, 536],
        [942, 536],
        [942, 600],
        [822, 600],
      ],
      // Pouf
      [
        [850, 732],
        [925, 730],
        [1000, 732],
        [1050, 740],
        [1080, 760],
        [1105, 790],
        [1120, 825],
        [1122, 865],
        [1117, 905],
        [1100, 940],
        [1070, 967],
        [1020, 987],
        [950, 992],
        [885, 987],
        [835, 972],
        [807, 950],
        [792, 915],
        [789, 870],
        [792, 830],
        [805, 790],
        [825, 760],
      ],
      // Sofa: seat, back, rail and front leg; the floor under the rail stays new
      [
        [1090, 512],
        [1150, 462],
        [1265, 445],
        [1400, 470],
        [1600, 480],
        [1600, 835],
        [1272, 826],
        [1272, 935],
        [1242, 935],
        [1242, 830],
        [1225, 812],
        [1090, 650],
        [1089, 684],
        [1075, 684],
        [1074, 640],
        [1054, 622],
        [1054, 565],
        [1090, 560],
      ],
    ],
  },
  {
    id: "office",
    name: "Оффис",
    w: 1200,
    h: 900,
    quad: [
      [280, 590],
      [1010, 590],
      [1440, 760],
      [-152, 760],
    ],
    floorW: 5,
    floorD: 4.5,
    keep: [
      // Desk top and the two pedestals; the floor between them stays new
      [
        [500, 494],
        [1119, 494],
        [1119, 508],
        [500, 508],
      ],
      [
        [518, 506],
        [610, 506],
        [610, 642],
        [518, 642],
      ],
      [
        [928, 505],
        [1016, 505],
        [1016, 642],
        [1004, 642],
        [1004, 632],
        [940, 622],
        [928, 622],
      ],
      // Office chair: seat and back, column, and the three spokes seen from the front
      [
        [770, 470],
        [806, 470],
        [812, 532],
        [902, 538],
        [904, 562],
        [846, 574],
        [782, 566],
        [772, 546],
      ],
      [
        [828, 560],
        [846, 560],
        [846, 612],
        [828, 612],
      ],
      [
        [832, 600],
        [838, 606],
        [772, 628],
        [758, 633],
        [755, 618],
        [768, 615],
      ],
      [
        [828, 606],
        [844, 606],
        [839, 632],
        [837, 646],
        [821, 646],
        [823, 628],
      ],
      [
        [840, 601],
        [853, 603],
        [905, 623],
        [919, 627],
        [917, 639],
        [900, 639],
        [892, 631],
        [842, 613],
      ],
      // Plants
      [
        [195, 560],
        [265, 560],
        [262, 610],
        [255, 636],
        [240, 643],
        [215, 643],
        [202, 636],
        [197, 610],
      ],
      [
        [290, 520],
        [350, 520],
        [346, 590],
        [340, 601],
        [300, 601],
        [294, 590],
      ],
      [
        [1047, 596],
        [1116, 596],
        [1112, 640],
        [1100, 653],
        [1060, 653],
        [1050, 640],
      ],
      [
        [1025, 470],
        [1135, 470],
        [1135, 598],
        [1025, 598],
      ],
      // Radiator
      [
        [0, 520],
        [176, 520],
        [176, 612],
        [0, 668],
      ],
    ],
  },
  {
    id: "bedroom",
    name: "Унтлагын өрөө",
    w: 1200,
    h: 900,
    quad: [
      [155, 598],
      [1010, 598],
      [1440, 737],
      [-169, 737],
    ],
    floorW: 5.9,
    floorD: 4.3,
    keep: [
      [
        [486, 476],
        [760, 476],
        [762, 538],
        [802, 544],
        [852, 628],
        [836, 664],
        [832, 700],
        [810, 700],
        [804, 664],
        [462, 664],
        [454, 700],
        [434, 700],
        [418, 648],
        [468, 544],
        [486, 538],
      ],
      [
        [352, 542],
        [472, 542],
        [472, 614],
        [352, 614],
      ],
      [
        [790, 542],
        [912, 542],
        [912, 616],
        [790, 616],
      ],
      [
        [930, 548],
        [986, 548],
        [986, 612],
        [930, 612],
      ],
      // Curtains
      [
        [148, 480],
        [224, 480],
        [224, 598],
        [205, 604],
        [178, 610],
        [150, 606],
      ],
      [
        [0, 480],
        [88, 480],
        [88, 628],
        [60, 640],
        [20, 650],
        [0, 656],
      ],
    ],
  },
];

/** A reasonable first guess for a photo the customer uploads. */
export const uploadQuad = (w: number, h: number): Quad => [
  [w * 0.28, h * 0.58],
  [w * 0.72, h * 0.58],
  [w * 1.05, h * 0.92],
  [w * -0.05, h * 0.92],
];
