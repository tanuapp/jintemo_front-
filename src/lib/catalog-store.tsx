import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { api, json } from "./api";
import { useAuth } from "./auth";
import type {
  CatalogEntry,
  ColorVariant,
  GlueProduct,
  Product,
  ProductKind,
  ProductType,
  Section,
  StockLocation,
} from "./products";
export type NewProductInput = Omit<
  Product,
  "slug" | "variants" | "gallery" | "createdAt" | "updatedAt" | "popularity"
>;
export type NewVariantInput = Omit<ColorVariant, "id">;
export type CatalogData = {
  products: Product[];
  glues: GlueProduct[];
  sections: Section[];
  /** Active types on the storefront; every type (with product counts) in the admin. */
  types: ProductType[];
  /** Admin catalog only. */
  locations?: StockLocation[];
};
export type ProductTypeInput = { name: string; kind: ProductKind };
export type ProductTypePatch = Partial<Pick<ProductType, "name" | "image" | "active">>;
type Store = Omit<CatalogData, "locations"> & {
  locations: StockLocation[];
  ready: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  catalog: CatalogEntry[];
  getProduct: (slug: string) => Product | undefined;
  getAnyProduct: (slug: string) => CatalogEntry | undefined;
  getGlueProduct: (slug: string) => GlueProduct | undefined;
  getVariant: (product: Product, id: string) => ColorVariant | undefined;
  getType: (id: string | undefined) => ProductType | undefined;
  addSection: (name: string) => Promise<void>;
  renameSection: (id: string, name: string) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;
  moveSection: (id: string, direction: "up" | "down") => Promise<void>;
  addType: (input: ProductTypeInput) => Promise<void>;
  updateType: (id: string, patch: ProductTypePatch) => Promise<void>;
  /** Products of a type in use must be moved to `moveTo`, a type of the same kind. */
  deleteType: (id: string, moveTo?: string) => Promise<void>;
  moveType: (id: string, direction: "up" | "down") => Promise<void>;
  addProduct: (input: NewProductInput) => Promise<string>;
  updateProduct: (slug: string, patch: Partial<Product>) => Promise<void>;
  deleteProduct: (slug: string) => Promise<void>;
};
const CatalogContext = createContext<Store | null>(null);
const byOrder = <T extends { order: number }>(list: T[]) =>
  [...list].sort((a, b) => a.order - b.order);
export function CatalogProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady } = useAuth();
  const { pathname } = useLocation();
  const qc = useQueryClient();
  const isAdmin = user?.role === "admin" && pathname.startsWith("/admin");
  const query = useQuery({
    queryKey: ["catalog", isAdmin ? "admin" : "public"],
    queryFn: () => api<CatalogData>(isAdmin ? "/admin/catalog" : "/catalog"),
    enabled: !pathname.startsWith("/admin") || (authReady && isAdmin),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    retry: 1,
  });
  const products = query.data?.products || [];
  const glues = query.data?.glues || [];
  const sections = query.data?.sections || [];
  const types = byOrder(query.data?.types || []);
  const locations = byOrder(query.data?.locations || []);
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["catalog"] });
  };
  const mutate = async (path: string, method: string, body?: unknown) => {
    await api(path, body === undefined ? { method } : json(method, body));
    await refresh();
  };
  const reorder = async (path: string, list: { id: string }[], id: string, up: boolean) => {
    const ids = list.map((s) => s.id);
    const i = ids.indexOf(id);
    const j = i + (up ? -1 : 1);
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    await mutate(path, "PUT", { ids });
  };
  const catalog: CatalogEntry[] = [
    ...products.map((p) => ({ ...p, kind: "carpet" as const })),
    ...glues.map((g) => ({ ...g, kind: "glue" as const })),
  ];
  const value: Store = {
    products,
    glues,
    sections,
    types,
    locations,
    catalog,
    ready: query.isSuccess,
    loading: query.isLoading,
    error: query.error?.message || null,
    refresh,
    getProduct: (slug) => products.find((p) => p.slug === slug),
    getAnyProduct: (slug) => catalog.find((p) => p.slug === slug),
    getGlueProduct: (slug) => glues.find((p) => p.slug === slug),
    getVariant: (p, id) => p.variants.find((v) => v.id === id),
    getType: (id) => types.find((t) => t.id === id),
    addSection: (name) => mutate("/admin/sections", "POST", { name }),
    renameSection: (id, name) => mutate(`/admin/sections/${id}`, "PATCH", { name }),
    deleteSection: (id) => mutate(`/admin/sections/${id}`, "DELETE"),
    moveSection: (id, direction) =>
      reorder("/admin/sections/order", byOrder(sections), id, direction === "up"),
    addType: (input) => mutate("/admin/product-types", "POST", input),
    updateType: (id, patch) =>
      mutate(`/admin/product-types/${encodeURIComponent(id)}`, "PATCH", patch),
    deleteType: (id, moveTo) =>
      mutate(
        `/admin/product-types/${encodeURIComponent(id)}${
          moveTo ? `?moveTo=${encodeURIComponent(moveTo)}` : ""
        }`,
        "DELETE",
      ),
    moveType: (id, direction) =>
      reorder("/admin/product-types/order", types, id, direction === "up"),
    addProduct: async (input) => {
      const r = await api<{ product: Product }>(
        "/admin/products",
        json("POST", { ...input, kind: "carpet", variants: [], gallery: [] }),
      );
      await refresh();
      return r.product.slug;
    },
    updateProduct: (slug, patch) =>
      mutate(`/admin/products/${encodeURIComponent(slug)}`, "PATCH", patch),
    deleteProduct: (slug) => mutate(`/admin/products/${encodeURIComponent(slug)}`, "DELETE"),
  };
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}
export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("CatalogProvider missing");
  return ctx;
}
