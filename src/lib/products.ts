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
  active?: boolean;
  updatedAt?: string;
  sectionId: string;
  name: string;
  short: string;
  description: string;
  material: string;
  tileSize: number; // meters (square tile edge)
  thickness: string; // base "Зузаан", e.g. "8 мм"
  origin: string;
  style: ProductStyle;
  rooms: string[];
  basePrice: number;
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

/** Effective price of a variant, falling back to the product's base price. */
export function variantPrice(product: Product, variant: ColorVariant) {
  return variant.price ?? product.basePrice;
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

export type GlueProduct = {
  slug: string;
  active?: boolean;
  updatedAt?: string;
  sku: string;
  name: string;
  glueType: GlueType;
  glueTypeLabel: "Байнгын наалттай" | "Салгаж болдог";
  short: string;
  description: string;
  price: number;
  packageSize: string;
  coverage: number; // m² per package
  usage: string[];
  surfaces: string[];
  image: string;
  inStock: boolean;
  stock: number;
  badge?: "Шинээр ирсэн" | "Онцлох";
  popularity: number;
  createdAt: string;
};

export function recommendGlueQty(areaM2: number, coverage: number) {
  if (coverage <= 0) return 1;
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
