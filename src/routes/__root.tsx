import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useLocation,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { CartDrawer } from "@/components/cart-drawer";
import { CompareBar } from "@/components/compare-bar";
import { CompareView } from "@/components/compare-view";
import { ProfileDrawer } from "@/components/profile-drawer";
import { CartProvider } from "@/lib/store";
import { AuthProvider } from "@/lib/auth";
import { UiProvider } from "@/lib/ui-store";
import { CatalogProvider } from "@/lib/catalog-store";
import { SettingsProvider, useSettings } from "@/lib/settings";
import { AdminShell, DataError } from "@/components/admin/shared";
import { useCatalog } from "@/lib/catalog-store";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "JINTEMO — Японы модуль хивс" },
      {
        name: "description",
        content:
          "Японоос импортолсон модуль хивс, тооцоолуур, өрөөндөө урьдчилж үзэх, хүргэлт, суурилуулалт.",
      },
      { name: "author", content: "JINTEMO" },
      { property: "og:title", content: "JINTEMO — Японы модуль хивс" },
      { property: "og:description", content: "Өрөөгөө өөрийн хэв маягаар бүтээ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&family=Noto+Sans:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="mn">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SettingsProvider>
          <CatalogProvider>
            <CartProvider>
              <UiProvider>
                <AppLayout />
                <Toaster position="top-center" richColors />
              </UiProvider>
            </CartProvider>
          </CatalogProvider>
        </SettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
function AppLayout() {
  const { pathname } = useLocation();
  const { error, refresh } = useCatalog();
  const config = useSettings();
  if (pathname.startsWith("/admin"))
    return (
      <AdminShell>
        <Outlet />
      </AdminShell>
    );
  return (
    <>
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">
          {error && (
            <div className={pathname === "/" ? "pt-24" : ""}>
              <DataError error={error} retry={refresh} />
            </div>
          )}
          {config.error && !error && <DataError error={config.error} retry={config.refresh} />}
          <Outlet />
        </main>
        <SiteFooter />
      </div>
      <CartDrawer />
      <ProfileDrawer />
      <CompareBar />
      <CompareView />
    </>
  );
}
