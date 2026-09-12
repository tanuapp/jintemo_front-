import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth";
import { api, json, errorMessage } from "./api";

const COMPARE_KEY = "jintemo.compare";
const COMPARE_LIMIT = 4;
const EMPTY_IDS: string[] = [];
const WISHLIST_KEY = "jintemo.wishlist";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

type Store = {
  cartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  profileOpen: boolean;
  openProfile: () => void;
  closeProfile: () => void;
  compareIds: string[];
  toggleCompare: (slug: string) => void;
  removeFromCompare: (slug: string) => void;
  clearCompare: () => void;
  compareOpen: boolean;
  openCompareView: () => void;
  closeCompareView: () => void;
  wishlistIds: string[];
  toggleWishlist: (slug: string) => void;
};

const UiContext = createContext<Store | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  const saving = useRef(false);
  const {
    data: savedProducts,
    isSuccess: savedReady,
    error: savedError,
    refetch: reloadSaved,
  } = useQuery({
    queryKey: ["wishlist", userId],
    queryFn: () => api<{ ids: string[] }>("/wishlist"),
    enabled: !!userId,
    retry: 1,
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [guestWishlist, setGuestWishlist] = useState<string[]>([]);
  const wishlistIds = userId ? savedProducts?.ids || EMPTY_IDS : guestWishlist;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setCompareIds(read<string[]>(COMPARE_KEY, []));
    const saved = read<unknown>(WISHLIST_KEY, []);
    setGuestWishlist(
      Array.isArray(saved) ? saved.filter((s) => typeof s === "string").slice(0, 100) : [],
    );
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(COMPARE_KEY, JSON.stringify(compareIds));
  }, [compareIds, ready]);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(guestWishlist));
  }, [guestWishlist, ready]);

  const toggleCompare = useCallback((slug: string) => {
    setCompareIds((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= COMPARE_LIMIT) {
        toast.error("Хамгийн ихдээ 4 бүтээгдэхүүн харьцуулах боломжтой");
        return prev;
      }
      return [...prev, slug];
    });
  }, []);

  const removeFromCompare = useCallback((slug: string) => {
    setCompareIds((prev) => prev.filter((s) => s !== slug));
  }, []);

  const clearCompare = useCallback(() => setCompareIds([]), []);

  const toggleWishlist = useCallback(
    (slug: string) => {
      if (!authReady) return;
      if (!userId) {
        setGuestWishlist((prev) =>
          prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug].slice(0, 100),
        );
        return;
      }
      if (saving.current) return;
      if (!savedReady) {
        toast.error(savedError?.message || "Хадгалсан барааг ачаалж байна. Түр хүлээнэ үү.");
        void reloadSaved();
        return;
      }
      saving.current = true;
      void api<{ ids: string[] }>(
        `/wishlist/${encodeURIComponent(slug)}`,
        json("PUT", { saved: !savedProducts!.ids.includes(slug), expectedUserId: userId }),
      )
        .then((data) => qc.setQueryData(["wishlist", userId], data))
        .catch((e) => toast.error(errorMessage(e)))
        .finally(() => {
          saving.current = false;
        });
    },
    [authReady, userId, savedReady, savedError, savedProducts, reloadSaved, qc],
  );

  const value = useMemo<Store>(
    () => ({
      cartOpen,
      openCart: () => setCartOpen(true),
      closeCart: () => setCartOpen(false),
      profileOpen,
      openProfile: () => setProfileOpen(true),
      closeProfile: () => setProfileOpen(false),
      compareIds,
      toggleCompare,
      removeFromCompare,
      clearCompare,
      compareOpen,
      openCompareView: () => setCompareOpen(true),
      closeCompareView: () => setCompareOpen(false),
      wishlistIds,
      toggleWishlist,
    }),
    [
      cartOpen,
      profileOpen,
      compareIds,
      toggleCompare,
      removeFromCompare,
      clearCompare,
      compareOpen,
      wishlistIds,
      toggleWishlist,
    ],
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi must be used inside UiProvider");
  return ctx;
}
