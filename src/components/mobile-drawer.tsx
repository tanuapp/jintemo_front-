import { Link } from "@tanstack/react-router";
import { Eye, Home, LayoutGrid, LogOut, MapPin, Package, UserRound } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";

const primary = [
  { to: "/" as const, label: "Нүүр", icon: Home, exact: true },
  { to: "/products" as const, label: "Бүтээгдэхүүн", icon: LayoutGrid, exact: false },
  { to: "/visualizer" as const, label: "Өрөөндөө үзэх", icon: Eye, exact: false },
];

const account = [
  { to: "/profile/orders" as const, label: "Миний захиалгууд", icon: Package },
  { to: "/profile/addresses" as const, label: "Хаягууд", icon: MapPin },
];

const itemClass =
  "flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-base font-medium text-foreground transition-colors hover:bg-secondary data-[status=active]:text-accent";

export function MobileDrawer({
  open,
  onClose,
  onOpenProfile,
}: {
  open: boolean;
  onClose: () => void;
  onOpenProfile: () => void;
}) {
  const { user, logout } = useAuth();

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      {/* Opens from the RIGHT — the same side as the burger icon */}
      <SheetContent side="right" className="flex w-[80%] flex-col gap-0 p-0 sm:max-w-xs">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="font-display">Цэс</SheetTitle>
        </SheetHeader>
        <nav className="flex-1 overflow-y-auto p-2">
          {primary.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={onClose}
              activeOptions={{ exact: l.exact }}
              className={itemClass}
            >
              <l.icon className="h-5 w-5 text-muted-foreground" />
              {l.label}
            </Link>
          ))}

          <div className="my-2 border-t border-border" />

          <button type="button" onClick={onOpenProfile} className={itemClass}>
            <UserRound className="h-5 w-5 text-muted-foreground" />
            Профайл
          </button>

          {account.map((l) => (
            <Link key={l.to} to={l.to} onClick={onClose} className={itemClass}>
              <l.icon className="h-5 w-5 text-muted-foreground" />
              {l.label}
            </Link>
          ))}

          {user && (
            <button
              type="button"
              onClick={() => {
                logout();
                onClose();
              }}
              className={`${itemClass} text-destructive`}
            >
              <LogOut className="h-5 w-5" />
              Гарах
            </button>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
