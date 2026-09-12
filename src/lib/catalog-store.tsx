import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { api, json } from "./api";
import { useAuth } from "./auth";
import type { CatalogEntry, ColorVariant, GlueProduct, Product, Section } from "./products";
export type NewProductInput = Omit<
  Product,
  "slug" | "variants" | "gallery" | "createdAt" | "updatedAt" | "popularity"
>;
export type NewVariantInput = Omit<ColorVariant, "id">;
export type CatalogData = { products: Product[]; glues: GlueProduct[]; sections: Section[] };
type Store = CatalogData & {
  ready: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  catalog: CatalogEntry[];
  getProduct: (slug: string) => Product | undefined;
  getAnyProduct: (slug: string) => CatalogEntry | undefined;
  getGlueProduct: (slug: string) => GlueProduct | undefined;
  getVariant: (product: Product, id: string) => ColorVariant | undefined;
  addSection: (name: string) => Promise<void>;
  renameSection: (id: string, name: string) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;
  moveSection: (id: string, direction: "up" | "down") => Promise<void>;
  addProduct: (input: NewProductInput) => Promise<string>;
  updateProduct: (slug: string, patch: Partial<Product>) => Promise<void>;
  deleteProduct: (slug: string) => Promise<void>;
};
const CatalogContext = createContext<Store | null>(null);
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
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["catalog"] });
  };
  const mutate = async (path: string, method: string, body?: unknown) => {
    await api(path, body === undefined ? { method } : json(method, body));
    await refresh();
  };
  const catalog: CatalogEntry[] = [
    ...products.map((p) => ({ ...p, kind: "carpet" as const })),
    ...glues.map((g) => ({ ...g, kind: "glue" as const })),
  ];
  const value: Store = {
    products,
    glues,
    sections,
    catalog,
    ready: query.isSuccess,
    loading: query.isLoading,
    error: query.error?.message || null,
    refresh,
    getProduct: (slug) => products.find((p) => p.slug === slug),
    getAnyProduct: (slug) => catalog.find((p) => p.slug === slug),
    getGlueProduct: (slug) => glues.find((p) => p.slug === slug),
    getVariant: (p, id) => p.variants.find((v) => v.id === id),
    addSection: (name) => mutate("/admin/sections", "POST", { name }),
    renameSection: (id, name) => mutate(`/admin/sections/${id}`, "PATCH", { name }),
    deleteSection: (id) => mutate(`/admin/sections/${id}`, "DELETE"),
    moveSection: async (id, direction) => {
      const ids = [...sections].sort((a, b) => a.order - b.order).map((s) => s.id);
      const i = ids.indexOf(id);
      const j = i + (direction === "up" ? -1 : 1);
      if (i < 0 || j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j]!, ids[i]!];
      await mutate("/admin/sections/order", "PUT", { ids });
    },
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
