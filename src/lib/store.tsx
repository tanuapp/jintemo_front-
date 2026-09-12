import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, json, errorMessage } from "./api";
import { useAuth } from "./auth";
import type { OrderStatus } from "./orders";
import type { GlueProduct, Product } from "./products";
export type CarpetCartItem = {
  id: string;
  kind: "carpet";
  productSlug: string;
  colorId: string;
  pieces: number;
};
export type GlueCartItem = { id: string; kind: "glue"; glueSlug: string; quantity: number };
export type CartItem = CarpetCartItem | GlueCartItem;
export type CartItemPatch = Partial<CarpetCartItem> & Partial<GlueCartItem>;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type NewCartItem = DistributiveOmit<CartItem, "id">;
export type Snapshot = {
  name: string;
  image: string;
  unitPrice: number;
  quantity: number;
  total: number;
  area: number;
};
export type Order = {
  id: string;
  userId: string;
  createdAt: string;
  name: string;
  phone: string;
  email?: string;
  address: string;
  note?: string;
  status: OrderStatus;
  paymentStatus: "unpaid" | "paid" | "refunded";
  items: (CartItem & { snapshot: Snapshot })[];
  delivery: boolean;
  payment: string;
  totals: ReturnType<typeof computeTotals>;
  hasInstall: boolean;
};
export type OrderInput = {
  name: string;
  phone: string;
  email?: string;
  address: string;
  note?: string;
  items: CartItem[];
  delivery: boolean;
  payment: string;
  hasInstall: boolean;
};
export function itemArea(item: CarpetCartItem, products: Product[]) {
  const p = products.find((p) => p.slug === item.productSlug);
  return item.pieces * (p?.tileSize ?? 0.5) ** 2;
}
export function itemTotal(item: CartItem, products: Product[], glues: GlueProduct[] = []): number {
  if (item.kind === "carpet") {
    const p = products.find((p) => p.slug === item.productSlug);
    const variant = p?.variants.find((v) => v.id === item.colorId);
    return variant ? (variant.price ?? p!.basePrice) * item.pieces : 0;
  }
  return (glues.find((g) => g.slug === item.glueSlug)?.price ?? 0) * item.quantity;
}
export function computeTotals(
  items: CartItem[],
  products: Product[],
  delivery = false,
  glues: GlueProduct[] = [],
  deliveryPrice = 0,
) {
  const goods = items
    .filter((i) => i.kind === "carpet")
    .reduce((s, i) => s + itemTotal(i, products, glues), 0);
  const glue = items
    .filter((i) => i.kind === "glue")
    .reduce((s, i) => s + itemTotal(i, products, glues), 0);
  const shipping = delivery ? deliveryPrice : 0;
  return { goods, glue, shipping, total: goods + glue + shipping };
}
type Store = {
  items: CartItem[];
  ready: boolean;
  cartError: string | null;
  syncCart: () => Promise<void>;
  addItem: (item: NewCartItem) => string;
  updateItem: (id: string, patch: CartItemPatch) => void;
  removeItem: (id: string) => void;
  clear: () => void;
  orders: Order[];
  ordersReady: boolean;
  ordersError: string | null;
  refreshOrders: () => Promise<void>;
  placeOrder: (input: OrderInput, requestKey: string) => Promise<Order>;
};
const CartContext = createContext<Store | null>(null);
const guestKey = "cozy.guest-cart";
function readGuest(): CartItem[] {
  try {
    const a = JSON.parse(
      localStorage.getItem(guestKey) || localStorage.getItem("jintemo.cart") || "[]",
    );
    return Array.isArray(a)
      ? a
          .filter(
            (i) =>
              i &&
              ["carpet", "glue"].includes(i.kind) &&
              (i.kind === "carpet"
                ? Number.isInteger(i.pieces) && i.pieces > 0
                : Number.isInteger(i.quantity) && i.quantity > 0),
          )
          .slice(0, 100)
      : [];
  } catch {
    return [];
  }
}
export function CartProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const owner = useRef<string | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const userRef = useRef(user?.id);
  userRef.current = user?.id;
  const loadVersion = useRef(0);
  const syncChain = useRef<Promise<unknown>>(Promise.resolve());
  const revision = useRef(0);
  const ordersQuery = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: () => api<{ orders: Order[] }>("/orders"),
    enabled: !!user,
    refetchOnWindowFocus: true,
    refetchInterval: user ? 20000 : false,
    retry: 1,
  });
  const loadCart = useCallback(async () => {
    if (!authReady) return;
    const attempt = ++loadVersion.current;
    const expectedUserId = userId;
    const stale = () => attempt !== loadVersion.current || userRef.current !== expectedUserId;
    setReady(false);
    owner.current = null;
    revision.current++;
    setItems([]);
    if (!userId) {
      setItems(readGuest());
      setCartError(null);
      setReady(true);
      return;
    }
    try {
      await syncChain.current.catch(() => {});
      if (stale()) return;
      const data = await api<{ items: CartItem[]; userId: string }>("/cart");
      if (stale()) return;
      if (data.userId !== expectedUserId)
        throw new Error("Нэвтэрсэн хэрэглэгч өөрчлөгдсөн байна. Дахин нэвтэрнэ үү.");
      const guest = readGuest();
      const merged = [...data.items];
      for (const item of guest) if (!merged.some((i) => i.id === item.id)) merged.push(item);
      if (guest.length) await api("/cart", json("PUT", { items: merged, expectedUserId }));
      if (!stale()) {
        localStorage.removeItem(guestKey);
        localStorage.removeItem("jintemo.cart");
        owner.current = userId;
        setItems(merged);
        setCartError(null);
        setReady(true);
      }
    } catch (e) {
      if (!stale()) {
        setItems([]);
        setCartError(errorMessage(e));
      }
    }
  }, [userId, authReady]);
  useEffect(() => {
    const version = loadVersion;
    void loadCart();
    return () => {
      version.current++;
    };
  }, [loadCart]);
  const persist = useCallback(
    async (value: CartItem[]) => {
      if (!userId) {
        localStorage.setItem(guestKey, JSON.stringify(value));
        return;
      }
      if (owner.current !== userId) throw new Error("Сагс ачаалж байна. Түр хүлээнэ үү.");
      const current = ++revision.current;
      const expectedUserId = userId;
      syncChain.current = syncChain.current
        .catch(() => {})
        .then(() => {
          if (userRef.current !== expectedUserId || owner.current !== expectedUserId) return;
          return api("/cart", json("PUT", { items: value, expectedUserId }));
        });
      try {
        await syncChain.current;
        if (current === revision.current) setCartError(null);
      } catch (e) {
        if (current === revision.current && owner.current === expectedUserId)
          setCartError(errorMessage(e));
        throw e;
      }
    },
    [userId],
  );
  const change = (fn: (prev: CartItem[]) => CartItem[]) => {
    if (!ready) {
      toast.error(cartError || "Сагс ачаалж байна. Түр хүлээнэ үү.");
      return;
    }
    const value = fn(itemsRef.current);
    itemsRef.current = value;
    setItems(value);
    void persist(value).catch((e) => toast.error(errorMessage(e)));
  };
  const value: Store = {
    items,
    ready,
    cartError,
    syncCart: () => (ready ? persist(itemsRef.current) : loadCart()),
    addItem: (item) => {
      const id = crypto.randomUUID();
      change((prev) => [...prev, { ...item, id } as CartItem]);
      return id;
    },
    updateItem: (id, patch) =>
      change((prev) => prev.map((i) => (i.id === id ? ({ ...i, ...patch } as CartItem) : i))),
    removeItem: (id) => change((prev) => prev.filter((i) => i.id !== id)),
    clear: () => change(() => []),
    orders: user ? ordersQuery.data?.orders || [] : [],
    ordersReady: !user || ordersQuery.isSuccess,
    ordersError: ordersQuery.error?.message || null,
    refreshOrders: async () => {
      await ordersQuery.refetch();
    },
    placeOrder: async (input, requestKey) => {
      if (!user) throw new Error("Захиалга өгөхийн өмнө нэвтэрнэ үү.");
      await syncChain.current.catch(() => {});
      const r = await api<{ order: Order }>("/orders", {
        ...json("POST", input),
        headers: { "Idempotency-Key": requestKey },
      });
      itemsRef.current = [];
      setItems([]);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["orders"] }),
        qc.invalidateQueries({ queryKey: ["catalog"] }),
      ]);
      return r.order;
    },
  };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("CartProvider missing");
  return ctx;
}
