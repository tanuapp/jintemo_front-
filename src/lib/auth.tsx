import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, json, errorMessage, ApiError } from "./api";
export type Address = {
  id: string;
  label: string;
  district: string;
  khoroo: string;
  address: string;
  note: string;
  isDefault: boolean;
};
export type PublicUser = {
  id: string;
  username: string;
  name: string;
  phone: string;
  email?: string;
  role: "admin" | "user";
  active: boolean;
  addresses: Address[];
  createdAt: string;
};
export type User = PublicUser;
type Result = { ok: true; user?: PublicUser } | { ok: false; error: string };
type ProfileInput = { name: string; phone: string; email?: string };
type Store = {
  user: PublicUser | null;
  ready: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  register: (input: ProfileInput & { password: string }) => Promise<Result>;
  login: (identifier: string, password: string) => Promise<Result>;
  logout: () => Promise<void>;
  updateProfile: (patch: ProfileInput) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<Result>;
  addAddress: (input: Omit<Address, "id" | "isDefault">) => Promise<void>;
  updateAddress: (id: string, patch: Partial<Omit<Address, "id">>) => Promise<void>;
  removeAddress: (id: string) => Promise<void>;
  setDefaultAddress: (id: string) => Promise<void>;
};
const AuthContext = createContext<Store | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const refresh = useCallback(async () => {
    try {
      const r = await api<{ user: PublicUser }>("/auth/me");
      setUser(r.user);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setUser(null);
        setError(null);
      } else setError(errorMessage(e));
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => {
    // Retire the prototype's plain-text passwords and fabricated sessions.
    for (const key of [
      "jintemo.users",
      "jintemo.session",
      "jintemo.orders",
      "jintemo.catalog.products",
      "jintemo.catalog.sections",
    ])
      localStorage.removeItem(key);
    void refresh();
    const expired = () => {
      setUser(null);
      qc.removeQueries({ queryKey: ["orders"] });
      qc.removeQueries({ queryKey: ["wishlist"] });
      qc.removeQueries({ queryKey: ["admin"] });
    };
    window.addEventListener("cozy:unauthorized", expired);
    return () => window.removeEventListener("cozy:unauthorized", expired);
  }, [refresh, qc]);
  const authenticate = async (path: string, input: unknown): Promise<Result> => {
    try {
      const r = await api<{ user: PublicUser }>(path, json("POST", input));
      setUser(r.user);
      setError(null);
      await qc.invalidateQueries();
      return { ok: true, user: r.user };
    } catch (e) {
      return { ok: false, error: errorMessage(e) };
    }
  };
  const updateUser = async (path: string, options: RequestInit) => {
    const r = await api<{ user: PublicUser }>(path, options);
    setUser(r.user);
  };
  const value: Store = {
    user,
    ready,
    error,
    refresh,
    register: (input) => authenticate("/auth/register", input),
    login: (identifier, password) => authenticate("/auth/login", { identifier, password }),
    logout: async () => {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
      qc.removeQueries({ queryKey: ["orders"] });
      qc.removeQueries({ queryKey: ["wishlist"] });
      qc.removeQueries({ queryKey: ["admin"] });
      await qc.invalidateQueries({ queryKey: ["catalog"] });
    },
    updateProfile: (patch) =>
      updateUser("/auth/me", json("PATCH", { ...patch, email: patch.email || "" })),
    changePassword: async (current, next) => {
      try {
        await api("/auth/password", json("PUT", { currentPassword: current, newPassword: next }));
        return { ok: true };
      } catch (e) {
        return { ok: false, error: errorMessage(e) };
      }
    },
    addAddress: (input) => updateUser("/auth/addresses", json("POST", input)),
    updateAddress: (id, patch) => updateUser(`/auth/addresses/${id}`, json("PATCH", patch)),
    removeAddress: (id) => updateUser(`/auth/addresses/${id}`, { method: "DELETE" }),
    setDefaultAddress: (id) =>
      updateUser(`/auth/addresses/${id}`, json("PATCH", { isDefault: true })),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider missing");
  return ctx;
}
