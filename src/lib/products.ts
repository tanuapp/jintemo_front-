import tileBeige from "@/assets/tile-beige.jpg";
import tileCharcoal from "@/assets/tile-charcoal.jpg";
import tileGray from "@/assets/tile-gray.jpg";
import tileSand from "@/assets/tile-sand.jpg";
import tileMoss from "@/assets/tile-moss.jpg";
import tileNavy from "@/assets/tile-navy.jpg";
import roomOffice from "@/assets/room-office.jpg";
import roomSample from "@/assets/room-sample.jpg";
import detailInstall from "@/assets/detail-install.jpg";
import heroRoom from "@/assets/hero-room.jpg";
import { mnt } from "./format";

/* ---------- Shared option sets (storefront filters + admin forms) ---------- */

export const STYLE_OPTIONS = ["Минимал загвар", "Текстуртэй", "Сонгодог"] as const;
export type ProductStyle = (typeof STYLE_OPTIONS)[number];

export const ROOM_OPTIONS = ["Зочны өрөө", "Унтлагын өрөө", "Оффис", "Хүүхдийн өрөө"] as const;

export const MATERIAL_OPTIONS = ["Найлон 100%", "Найлон / ноос холимог", "Полипропилен"] as const;

export const IMAGE_LIBRARY = [
  { id: "tile-beige", label: "Бэж", src: tileBeige },
  { id: "tile-charcoal", label: "Хар саарал", src: tileCharcoal },
  { id: "tile-gray", label: "Дулаан саарал", src: tileGray },
  { id: "tile-sand", label: "Элсэн цагаан", src: tileSand },
  { id: "tile-moss", label: "Хөвдөн ногоон", src: tileMoss },
  { id: "tile-navy", label: "Хар хөх", src: tileNavy },
] as const;

/* ---------- Product types, price units, stock locations ---------- */

/**
 * The structure behind a product type: "carpet" products have colour variants and are
 * sold in pieces; "glue" products are single items sold in their price unit.
 */
export type ProductKind = "carpet" | "glue";

export const KIND_LABELS: Record<ProductKind, string> = {
  carpet: "Өнгөний хувилбартай (хивс шиг)",
  glue: "Энгийн бараа (цавуу шиг)",
};
/** What each structure means for selling and stock, shown next to the choice. */
export const KIND_HINTS: Record<ProductKind, string> = {
  carpet:
    "Өнгө бүр тусдаа үлдэгдэлтэй, ширхэгээр зарагдана. Бараа бүрт дор хаяж нэг өнгө нэмэхгүй бол вэб дээр харагдахгүй.",
  glue: "Нэг бараа, сонгосон нэгжээр (ширхэг / м² / метр) зарагдана.",
};

/** Admin-managed product type ("Хивс", "Цавуу", "Хавтан хулдаас", …). */
export type ProductType = {
  id: string;
  name: string;
  slug: string;
  kind: ProductKind;
  image: string;
  active: boolean;
  order: number;
  /** Admin catalog only. */
  productCount?: number;
};

export type StockLocation = { id: string; name: string; order: number };

export const PRICE_UNITS = ["m2", "piece", "meter"] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];
export const PRICE_UNIT_LABELS: Record<PriceUnit, string> = {
  m2: "м²",
  piece: "ширхэг",
  meter: "метр",
};

/* ---------- Section → Product → Color variant ---------- */

export type Section = {
  id: string;
  name: string;
  order: number;
};

export type ColorVariant = {
  id: string;
  name: string;
  hex: string;
  code: string;
  image: string;
  gallery?: string[];
  stock: number;
  price?: number | undefined;
  thickness?: string | undefined;
};

export type Product = {
  slug: string;
  typeId: string;
  active?: boolean;
  updatedAt?: string;
  sectionId: string;
  name: string;
  short: string;
  description: string;
  material: string;
  /** Size of one piece in metres; optional unless the price depends on it. */
  widthM?: number | undefined;
  lengthM?: number | undefined;
  /** Legacy square tile edge, superseded by widthM/lengthM. */
  tileSize?: number | undefined;
  thickness: string; // base "Зузаан", e.g. "8 мм"
  origin: string;
  style: ProductStyle;
  rooms: string[];
  /** Price of one `priceUnit` (not necessarily of one piece). */
  basePrice: number;
  priceUnit?: PriceUnit | undefined;
  /** Optional "was" price — shown struck through on cards/detail when higher than the current price. */
  oldPrice?: number;
  variants: ColorVariant[];
  gallery: string[];
  badge?: "Шинээр ирсэн" | "Онцлох";
  popularity: number;
  createdAt: string;
};

const roomImages = [heroRoom, roomOffice, detailInstall];

/** A product is in stock if any of its variants have stock. */
export function productInStock(product: Product) {
  return product.variants.some((v) => variantInStock(v));
}

/** Effective price of a variant per price unit, falling back to the product's base price. */
export function variantPrice(product: Product, variant: ColorVariant) {
  return variant.price ?? product.basePrice;
}

type Sized = {
  priceUnit?: PriceUnit | undefined;
  widthM?: number | undefined;
  lengthM?: number | undefined;
};

export const priceUnitOf = (p: Sized): PriceUnit => p.priceUnit ?? "piece";

/** "88,000₮ / м²" */
export function formatPrice(value: number, unit: PriceUnit) {
  return `${mnt(value)} / ${PRICE_UNIT_LABELS[unit]}`;
}

/** Area of one piece in m², or 0 when the product has no size. */
export function pieceArea(p: Sized) {
  return p.widthM && p.lengthM ? p.widthM * p.lengthM : 0;
}

/**
 * How many price units one piece holds — the server uses the same rule at checkout.
 * The stored price is never rescaled; a piece of 0.5 × 0.5 m priced per m² costs 0.25 × price.
 */
export function pieceFactor(p: Sized) {
  const unit = priceUnitOf(p);
  if (unit === "m2") return pieceArea(p) || 1;
  if (unit === "meter") return p.lengthM || 1;
  return 1;
}

/** Price of one piece of a variant (what the cart charges per piece). */
export function piecePrice(product: Product, variant: ColorVariant) {
  return Math.round(variantPrice(product, variant) * pieceFactor(product));
}

const metres = (n: number) => String(Number(n.toFixed(3)));

/** "0.5 × 0.5 м", "30 м", or "" without a size. */
export function formatSize(p: Sized) {
  if (p.widthM && p.lengthM) return `${metres(p.widthM)} × ${metres(p.lengthM)} м`;
  if (p.lengthM) return `${metres(p.lengthM)} м`;
  if (p.widthM) return `${metres(p.widthM)} м өргөн`;
  return "";
}

/** A glue that can be recommended for a carpet area (has a coverage per package). */
export function isGlue(product: GlueProduct) {
  return Boolean(product.glueType && product.coverage);
}

/** Short spec line of a single-item product: package and coverage for glue, else its size. */
export function glueSpec(product: GlueProduct) {
  return [
    product.packageSize,
    product.coverage ? `${product.coverage} m² / ${product.packageSize ? "сав" : "нэгж"}` : "",
    formatSize(product),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Effective thickness of a variant, falling back to the product's base thickness. */
export function variantThickness(product: Product, variant: ColorVariant) {
  return variant.thickness ?? product.thickness;
}

export function variantInStock(variant: ColorVariant) {
  return variant.stock > 0;
}

/** Distinct effective thickness values across a product list, sorted numerically. */
export function collectThicknessOptions(list: Product[]) {
  const set = new Set<string>();
  for (const p of list) {
    for (const v of p.variants) set.add(variantThickness(p, v));
  }
  return [...set].sort((a, b) => parseFloat(a) - parseFloat(b));
}

export type GlueType = "permanent" | "removable";

/** A single-item product ("glue" kind): glue, tape, thresholds, … */
export type GlueProduct = {
  slug: string;
  typeId: string;
  active?: boolean;
  updatedAt?: string;
  sku: string;
  name: string;
  /** Empty for single items that are not glue. */
  glueType: GlueType | "";
  glueTypeLabel: "Байнгын наалттай" | "Салгаж болдог" | "";
  short: string;
  description: string;
  /** Price of one `priceUnit`; quantities are counted in the same unit. */
  price: number;
  priceUnit?: PriceUnit | undefined;
  widthM?: number | undefined;
  lengthM?: number | undefined;
  packageSize: string;
  coverage?: number | undefined; // m² per package
  usage: string[];
  surfaces: string[];
  image: string;
  inStock: boolean;
  stock: number;
  badge?: "Шинээр ирсэн" | "Онцлох";
  popularity: number;
  createdAt: string;
};

export function recommendGlueQty(areaM2: number, coverage: number | undefined) {
  if (!coverage || coverage <= 0) return 1;
  return Math.max(1, Math.ceil(areaM2 / coverage));
}

/* ---------- Unified catalog entry (carpet + glue) ---------- */

export type CatalogEntry = ({ kind: "carpet" } & Product) | ({ kind: "glue" } & GlueProduct);

export const categories = [
  { name: "Зочны өрөө", key: "Зочны өрөө", image: heroRoom },
  { name: "Унтлагын өрөө", key: "Унтлагын өрөө", image: tileSand },
  { name: "Оффис", key: "Оффис", image: roomOffice },
  { name: "Хүүхдийн өрөө", key: "Хүүхдийн өрөө", image: tileMoss },
  { name: "Минимал загвар", key: "Минимал загвар", image: tileBeige },
  { name: "Текстуртэй", key: "Текстуртэй", image: tileGray },
];

export const INSTALL_PRICE_TBD = "Үнэ тохирно";

/* ---------- Small shared helpers ---------- */

export function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function randomId() {
  return Math.random().toString(36).slice(2, 9);
}
