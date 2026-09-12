import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import defaults from "../../../shared/default-settings.json";
import { api } from "./api";
export type SiteSettings = typeof defaults;
export type ContentItem = {
  _id: string;
  type: "banners" | "news" | "pages" | "faqs";
  title: string;
  subtitle: string;
  body: string;
  image: string;
  link: string;
  active: boolean;
  order: number;
};
const SettingsContext = createContext({
  settings: defaults,
  content: [] as ContentItem[],
  refresh: async () => {},
  error: null as string | null,
});
export function SettingsProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<{ settings: SiteSettings }>("/settings"),
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    retry: 1,
  });
  const c = useQuery({
    queryKey: ["content"],
    queryFn: () => api<{ content: ContentItem[] }>("/content"),
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    retry: 1,
  });
  return (
    <SettingsContext.Provider
      value={{
        settings: q.data?.settings || defaults,
        content: c.data?.content || [],
        error: q.error?.message || c.error?.message || null,
        refresh: async () => {
          await Promise.all([
            qc.invalidateQueries({ queryKey: ["settings"] }),
            qc.invalidateQueries({ queryKey: ["content"] }),
          ]);
        },
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
export const useSettings = () => useContext(SettingsContext);
export const installationRate = (s: SiteSettings) =>
  `${s.installationMin.toLocaleString()}₮–${s.installationMax.toLocaleString()}₮/м²`;
