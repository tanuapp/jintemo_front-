import { Link, useLocation } from "@tanstack/react-router";
import { Menu, Search, ShoppingBag, User } from "lucide-react";
import { useEffect, useState } from "react";
import { MobileDrawer } from "@/components/mobile-drawer";
import { AuthPanel, ProfileMenu } from "@/components/profile-drawer";
import { SearchOverlay } from "@/components/search-overlay";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar } from "@/components/ui-kit";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import jintemoLogo from "../../jintemo-logo.jpg";

const nav = [
  { to: "/", label: "Нүүр" },
  { to: "/products", label: "Бүтээгдэхүүн" },
  { to: "/visualizer", label: "Өрөөндөө үзэх" },
] as const;

/**
 * The supplied logo is a square lockup with a small tagline. Crop only the
 * original emblem here, then pair it with a readable live wordmark.
 */
function BrandLockup({ large = false, className }: { large?: boolean; className?: string }) {
  const { settings } = useSettings();
  return (
    <Link to="/" className={cn("flex w-fit items-center", large ? "gap-3" : "gap-2.5", className)}>
      <span
        className={cn(
          "relative block shrink-0 overflow-hidden",
          large ? "h-10 w-10" : "h-[36px] w-[36px]",
        )}
      >
        <img
          src={settings.logo}
          alt=""
          aria-hidden="true"
          className={cn(
            "absolute max-w-none",
            large ? "-left-5 -top-0.5 h-20 w-20" : "-left-[18px] -top-0.5 h-[72px] w-[72px]",
          )}
        />
      </span>
      <span
        className={cn(
          "font-display font-extrabold leading-none tracking-tight",
          large ? "text-xl" : "text-[19px]",
        )}
      >
        {settings.brandName}
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const { settings } = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { pathname } = useLocation();
  const { items } = useCart();
  const { user } = useAuth();
  const { openCart, openProfile } = useUi();
  const count = items.length;
  const isHome = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openProfileFromMenu = () => {
    setMenuOpen(false);
    window.setTimeout(openProfile, 240);
  };

  return (
    <header
      className={cn(
        isHome
          ? "pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-5"
          : "sticky top-0 z-40 border-b bg-background/90 backdrop-blur transition-colors",
        !isHome && (scrolled ? "border-border" : "border-border/50"),
      )}
    >
      {settings.announcement && (
        <p className="pointer-events-auto mx-auto mb-2 max-w-[1080px] rounded-lg bg-primary px-4 py-2 text-center text-xs text-primary-foreground sm:text-sm">
          {settings.announcement}
        </p>
      )}
      {/* Mobile: a compact floating bar on the homepage; standard sticky bar elsewhere. */}
      <div
        className={cn(
          "flex h-16 items-center justify-between gap-2 md:hidden",
          isHome
            ? "pointer-events-auto mx-auto max-w-[1080px] rounded-full border border-border/70 bg-card/96 px-3 shadow-soft backdrop-blur-xl"
            : "container-page",
        )}
      >
        <BrandLockup className="min-w-0" />

        <div className="flex shrink-0 items-center">
          <button
            type="button"
            aria-label="Хайх"
            onClick={() => setSearch(true)}
            className="grid h-11 w-10 place-items-center rounded-md text-foreground transition-colors hover:text-accent sm:w-11"
          >
            <Search className="h-5 w-5" />
          </button>
          {!isHome && (
            <button
              type="button"
              aria-label="Профайл"
              onClick={openProfile}
              className="grid h-11 w-10 place-items-center rounded-md text-foreground transition-colors hover:text-accent sm:w-11"
            >
              {user ? (
                <Avatar name={user.name} className="h-7 w-7 bg-accent/10 text-accent" />
              ) : (
                <User className="h-5 w-5" />
              )}
            </button>
          )}
          <button
            type="button"
            aria-label="Сагс"
            onClick={openCart}
            className="relative grid h-11 w-10 place-items-center rounded-md text-foreground transition-colors hover:text-accent sm:w-11"
          >
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute right-0.5 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground sm:right-1">
                {count}
              </span>
            )}
          </button>
          <button
            type="button"
            aria-label="Цэс"
            onClick={() => setMenuOpen(true)}
            className="grid h-11 w-10 place-items-center rounded-md text-foreground transition-colors hover:text-accent sm:w-11"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Desktop: logo, navigation and actions share one balanced capsule. */}
      <div
        className={cn(
          "hidden h-16 grid-cols-[1fr_auto_1fr] items-center md:grid",
          isHome
            ? "pointer-events-auto mx-auto max-w-[1080px] rounded-full border border-border/70 bg-card/96 px-6 shadow-soft backdrop-blur-xl"
            : "container-page",
        )}
      >
        <BrandLockup />

        <nav className="flex items-center gap-7 lg:gap-8">
          {nav.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="whitespace-nowrap text-[15px] font-medium text-foreground/78 transition-colors hover:text-accent data-[status=active]:font-semibold data-[status=active]:text-accent"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            aria-label="Хайх"
            onClick={() => setSearch(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground/90 transition-colors hover:text-accent"
          >
            <Search className="h-[21px] w-[21px]" strokeWidth={1.75} />
          </button>

          <Popover open={profileOpen} onOpenChange={setProfileOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Профайл"
                className="inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground/90 transition-colors hover:text-accent data-[state=open]:text-accent"
              >
                {user ? (
                  <Avatar
                    name={user.name}
                    className="h-7 w-7 bg-accent/10 text-[11px] text-accent"
                  />
                ) : (
                  <User className="h-[21px] w-[21px]" strokeWidth={1.75} />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={8}
              collisionPadding={12}
              className="w-[360px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border-border/80 bg-card p-0 shadow-lift"
            >
              {user ? (
                <ProfileMenu onNavigate={() => setProfileOpen(false)} />
              ) : (
                <div className="p-4">
                  <AuthPanel embedded onDone={() => setProfileOpen(false)} />
                </div>
              )}
            </PopoverContent>
          </Popover>

          <button
            type="button"
            aria-label="Сагс"
            onClick={openCart}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground/90 transition-colors hover:text-accent"
          >
            <ShoppingBag className="h-[21px] w-[21px]" strokeWidth={1.75} />
            {count > 0 && (
              <span className="absolute right-1 top-1 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-foreground">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>

      <MobileDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onOpenProfile={openProfileFromMenu}
      />
      <SearchOverlay open={search} onClose={() => setSearch(false)} />
    </header>
  );
}

export function SiteFooter() {
  const { settings, content } = useSettings();
  return (
    <footer className="border-t border-border bg-surface">
      <div className="container-page py-12">
        <div className="grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_1.05fr]">
          <div>
            <BrandLockup large />
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
              {settings.footerDescription}
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-foreground">Бүтээгдэхүүн</h2>
            <nav className="mt-4 flex flex-col items-start gap-3 text-sm text-muted-foreground">
              <Link to="/products" search={{ category: "all" }} className="hover:text-accent">
                Бүх бүтээгдэхүүн
              </Link>
              <Link to="/products" search={{ category: "carpet" }} className="hover:text-accent">
                Хивс
              </Link>
              <Link to="/products" search={{ category: "glue" }} className="hover:text-accent">
                Цавуу
              </Link>
              <Link to="/visualizer" className="hover:text-accent">
                Өрөөндөө үзэх
              </Link>
            </nav>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-foreground">Хэрэглэгчид</h2>
            <nav className="mt-4 flex flex-col items-start gap-3 text-sm text-muted-foreground">
              <Link to="/profile/orders" className="hover:text-accent">
                Миний захиалгууд
              </Link>
              <Link to="/track" className="hover:text-accent">
                Захиалга шалгах
              </Link>
              {content
                .filter((c) => c.type === "pages")
                .map((c) => (
                  <Link
                    key={c._id}
                    to="/info/$id"
                    params={{ id: c._id }}
                    className="hover:text-accent"
                  >
                    {c.title}
                  </Link>
                ))}
              <a href="/#installation" className="hover:text-accent">
                Хүргэлт ба суурилуулалт
              </a>
            </nav>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-foreground">Холбоо барих</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
              <a
                href={`tel:${settings.phone.replace(/[^+\d]/g, "")}`}
                className="block font-medium text-foreground hover:text-accent"
              >
                {settings.phone}
              </a>
              <p>{settings.address}</p>
              <p>{settings.hours}</p>
              <Link to="/contact" className="inline-block text-accent">
                Зурвас илгээх
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-5 text-xs text-muted-foreground">
          <span>
            © {new Date().getFullYear()} {settings.copyright}
          </span>
        </div>
      </div>
    </footer>
  );
}
