import { Link, Navigate, useLocation } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  Images,
  Newspaper,
  Settings,
  MessageSquare,
  LogOut,
  ExternalLink,
  History,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Btn } from "@/components/ui-kit";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/api";
import { useSettings } from "@/lib/settings";
const links = [
  ["/admin", "Ерөнхий", LayoutDashboard],
  ["/admin/catalog", "Бүтээгдэхүүн", Package],
  ["/admin/orders", "Захиалгууд", ShoppingBag],
  ["/admin/users", "Хэрэглэгчид", Users],
  ["/admin/content", "Контент", Newspaper],
  ["/admin/media", "Зургийн сан", Images],
  ["/admin/contacts", "Зурвасууд", MessageSquare],
  ["/admin/settings", "Вэбийн тохиргоо", Settings],
  ["/admin/audit", "Үйлдлийн түүх", History],
] as const;
export function AdminShell({ children }: { children: ReactNode }) {
  const { user, ready, error, refresh, logout } = useAuth();
  const { pathname } = useLocation();
  const { settings } = useSettings();
  if (!ready) return <Loading />;
  if (error) return <DataError error={error} retry={refresh} />;
  if (!user) return <Navigate to="/login" />;
  if (user.role !== "admin") return <Navigate to="/" />;
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="border-b border-border bg-primary text-primary-foreground lg:sticky lg:top-0 lg:h-screen lg:border-b-0">
        <div className="px-6 py-6">
          <Link to="/admin" className="font-display text-2xl font-extrabold tracking-tight">
            {settings.brandName}
          </Link>
          <p className="mt-1 text-sm opacity-60">Удирдлагын самбар</p>
        </div>
        <nav aria-label="Админ цэс" className="flex gap-1 overflow-x-auto px-3 pb-4 lg:flex-col">
          {links.map(([to, title, Icon]) => (
            <Link
              key={to}
              to={to}
              className={`flex shrink-0 items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${pathname.replace(/\/$/, "") === to || (to === "/admin/catalog" && pathname.startsWith("/admin/products")) ? "bg-accent text-accent-foreground" : "hover:bg-primary-foreground/10"}`}
            >
              <Icon size={18} />
              {title}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-4 border-t border-primary-foreground/15 px-6 py-5 lg:absolute lg:inset-x-0 lg:bottom-0 lg:block lg:space-y-3">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <Link to="/" className="flex items-center gap-2 text-sm opacity-80">
            <ExternalLink size={16} />
            Вэб үзэх
          </Link>
          <button
            onClick={async () => {
              try {
                await logout();
              } catch (e) {
                toast.error(errorMessage(e));
              }
            }}
            className="flex items-center gap-2 text-sm opacity-80"
          >
            <LogOut size={16} />
            Гарах
          </button>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-5 lg:px-9">
          <p className="text-sm text-muted-foreground">{settings.brandName} / Админ</p>
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium">
            <ExternalLink size={16} />
            Вэб үзэх
          </Link>
        </header>
        <main className="mx-auto max-w-[1500px] p-5 pb-16 lg:p-9">{children}</main>
      </div>
    </div>
  );
}
export function PageTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div
      role="status"
      className="flex min-h-48 items-center justify-center gap-3 text-muted-foreground"
    >
      <Loader2 className="animate-spin" size={20} />
      Ачаалж байна…
    </div>
  );
}
export function DataError({ error, retry }: { error: string; retry?: () => unknown }) {
  return (
    <div role="alert" className="m-5 rounded-xl border border-destructive/30 bg-card p-6">
      <p className="text-destructive">{error}</p>
      {retry && (
        <Btn variant="secondary" className="mt-4" onClick={() => void retry()}>
          Дахин оролдох
        </Btn>
      )}
    </div>
  );
}
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-card p-5 sm:p-6 ${className}`}>
      {children}
    </section>
  );
}
export function Empty({ children = "Мэдээлэл байхгүй байна." }: { children?: ReactNode }) {
  return <p className="py-12 text-center text-muted-foreground">{children}</p>;
}
export function useAction() {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, message = "Хадгалагдлаа") => {
    if (busy) return false;
    setBusy(true);
    try {
      await fn();
      if (message) toast.success(message);
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}
export function ConfirmButton({
  title = "Устгах уу?",
  description = "Энэ өөрчлөлтийг буцаах боломжгүй.",
  label = "Устгах",
  onConfirm,
  disabled = false,
}: {
  title?: string;
  description?: string;
  label?: string;
  onConfirm: () => Promise<unknown>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { busy, run } = useAction();
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          disabled={disabled}
          className="rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/5 disabled:opacity-40"
        >
          {label}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Болих</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault();
              if (await run(onConfirm, "Амжилттай")) setOpen(false);
            }}
          >
            {busy ? "Түр хүлээнэ үү…" : label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
export const inputClass =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-base outline-none focus:ring-2 focus:ring-ring/30";
