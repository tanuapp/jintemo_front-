import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, ChevronRight, LogOut, MapPin, Package, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, Btn, Field, StatusBadge, TextInput } from "@/components/ui-kit";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { mnt } from "@/lib/format";
import { ORDER_STATUS_LABELS, orderStatus } from "@/lib/orders";
import { useCart } from "@/lib/store";
import { useUi } from "@/lib/ui-store";

type ProfileRoute = "/admin" | "/profile" | "/profile/orders" | "/profile/addresses";

function formatOrderDate(value: string) {
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}.${month}.${day}`;
}

/** Login / register form — shared by the mobile drawer and the desktop popover. */
export function AuthPanel({
  onDone,
  embedded = false,
}: {
  onDone: () => void;
  embedded?: boolean;
}) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result =
      mode === "login"
        ? await login(phone, password)
        : await register({ name, phone, password, ...(email ? { email } : {}) });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success(mode === "login" ? "Тавтай морил" : "Бүртгэл амжилттай үүслээ");
    onDone();
    await navigate({ to: result.user?.role === "admin" ? "/admin" : "/" });
  };

  return (
    <div className={embedded ? "" : "rounded-lg border border-border bg-card p-4"}>
      <div className="flex gap-2">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
              mode === m
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {m === "login" ? "Нэвтрэх" : "Бүртгүүлэх"}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {mode === "register" && (
          <Field label="Нэр">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Нэрээ оруулна уу"
            />
          </Field>
        )}
        <Field label={mode === "login" ? "Утас / имэйл / нэвтрэх нэр" : "Утасны дугаар"}>
          <TextInput
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="99001122"
            autoComplete="username"
            inputMode={mode === "register" ? "tel" : "text"}
          />
        </Field>
        {mode === "register" && (
          <Field label="Имэйл (заавал биш)">
            <TextInput
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@mail.com"
              type="email"
            />
          </Field>
        )}
        <Field label="Нууц үг">
          <TextInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            placeholder="••••••"
          />
        </Field>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Btn className="w-full" onClick={submit} disabled={busy}>
          {mode === "login" ? "Нэвтрэх" : "Бүртгүүлэх"}
        </Btn>
      </div>
    </div>
  );
}

/** Logged-in account menu — shared by the mobile drawer and the desktop popover. */
export function ProfileMenu({ onNavigate }: { onNavigate: () => void }) {
  const { user, logout } = useAuth();
  const { orders } = useCart();
  const navigate = useNavigate();
  if (!user) return null;

  const go = (to: ProfileRoute) => {
    onNavigate();
    navigate({ to });
  };

  const recentOrders = orders.filter((o) => o.userId === user.id).slice(0, 2);

  const shortcuts: { to: ProfileRoute; label: string; icon: typeof Package }[] = [
    ...(user.role === "admin"
      ? [{ to: "/admin" as const, label: "Удирдлагын самбар", icon: Package }]
      : []),
    { to: "/profile", label: "Профайл", icon: UserRound },
    { to: "/profile/orders", label: "Миний захиалгууд", icon: Package },
    { to: "/profile/addresses", label: "Хаягууд", icon: MapPin },
  ];

  return (
    <div className="min-w-0 overflow-hidden">
      <div className="flex items-center gap-3 bg-accent/[0.06] p-4">
        <Avatar name={user.name} className="h-11 w-11 bg-accent/12 text-sm text-accent" />
        <div className="min-w-0">
          <p className="font-display font-bold [overflow-wrap:anywhere]">{user.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums [overflow-wrap:anywhere]">
            {user.phone}
          </p>
          {user.email && (
            <p className="mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">
              {user.email}
            </p>
          )}
        </div>
      </div>

      <nav className="p-2">
        {shortcuts.map((s) => (
          <button
            key={s.to}
            onClick={() => go(s.to)}
            className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium outline-none transition-colors hover:bg-secondary/70 focus-visible:bg-accent/[0.08] focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <s.icon className="h-[18px] w-[18px] text-muted-foreground" />
            <span className="flex-1 text-left">{s.label}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </nav>

      <section className="border-t border-border px-4 py-4">
        <p className="text-xs font-semibold text-foreground">Сүүлийн захиалгууд</p>
        {recentOrders.length > 0 ? (
          <div className="mt-2 divide-y divide-border/70">
            {recentOrders.map((order) => {
              const status = orderStatus(order);
              return (
                <button
                  key={order.id}
                  onClick={() => {
                    onNavigate();
                    navigate({ to: "/order/$id", params: { id: order.id } });
                  }}
                  className="block w-full rounded-md px-1 py-3 text-left text-sm outline-none transition-colors hover:bg-secondary/60 focus-visible:bg-accent/[0.08] focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold tabular-nums">#{order.id}</span>
                    <span className="font-display font-bold tabular-nums">
                      {mnt(order.totals.total)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatOrderDate(order.createdAt)}
                    </span>
                    <StatusBadge label={ORDER_STATUS_LABELS[status]} tone={status} />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-muted-foreground">Одоогоор захиалга алга байна.</p>
            <button
              type="button"
              onClick={() => {
                onNavigate();
                navigate({ to: "/products", search: { category: "all" } });
              }}
              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              Бүтээгдэхүүн үзэх <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {recentOrders.length > 0 && (
          <button
            type="button"
            onClick={() => go("/profile/orders")}
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            Бүх захиалга харах <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </section>

      <div className="border-t border-border p-2">
        <button
          onClick={async () => {
            try {
              await logout();
              onNavigate();
              await navigate({ to: "/" });
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }}
          className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-destructive outline-none transition-colors hover:bg-destructive/5 focus-visible:ring-2 focus-visible:ring-destructive/25"
        >
          <LogOut className="h-4 w-4" /> Гарах
        </button>
      </div>
    </div>
  );
}

/** Mobile profile — right-side drawer. On desktop the header uses a popover instead. */
export function ProfileDrawer() {
  const { profileOpen, closeProfile } = useUi();
  const { user } = useAuth();

  return (
    <Sheet open={profileOpen} onOpenChange={(open) => !open && closeProfile()}>
      <SheetContent
        side="right"
        className="flex w-[92%] flex-col gap-0 overflow-y-auto p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="font-display">Профайл</SheetTitle>
        </SheetHeader>

        <div className={user ? "flex-1" : "flex-1 p-5"}>
          {user ? <ProfileMenu onNavigate={closeProfile} /> : <AuthPanel onDone={closeProfile} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
