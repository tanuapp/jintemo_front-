import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Package, UserRound } from "lucide-react";
import { Btn, EmptyState, StatusBadge } from "@/components/ui-kit";
import { Loading, DataError } from "@/components/admin/shared";
import { useAuth } from "@/lib/auth";
import { mnt } from "@/lib/format";
import { ORDER_STATUS_LABELS, orderStatus } from "@/lib/orders";
import { useCart } from "@/lib/store";
import { useUi } from "@/lib/ui-store";

export const Route = createFileRoute("/profile/orders")({
  head: () => ({
    meta: [{ title: "Миний захиалгууд | JINTEMO" }],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const { user, ready: authReady } = useAuth();
  const { orders, ordersReady: cartReady, ordersError, refreshOrders } = useCart();
  const { openProfile } = useUi();

  if (ordersError) return <DataError error={ordersError} retry={refreshOrders} />;
  if (!authReady || !cartReady) return <Loading />;

  if (!user) {
    return (
      <div className="container-page py-20">
        <EmptyState
          icon={UserRound}
          title="Та нэвтрээгүй байна"
          description="Захиалгуудаа харахын тулд эхлээд нэвтэрнэ үү."
          action={<Btn onClick={openProfile}>Нэвтрэх</Btn>}
        />
      </div>
    );
  }

  const myOrders = orders.filter((o) => o.userId === user.id);

  return (
    <div className="container-page max-w-3xl py-8 pb-16">
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Миний захиалгууд</h1>

      {myOrders.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={Package}
            title="Захиалга алга байна"
            description="Одоогоор та захиалга хийгээгүй байна."
            action={
              <Link
                to="/products"
                className="inline-flex h-13 items-center justify-center rounded-md bg-primary px-7 text-base font-medium text-primary-foreground"
              >
                Бүтээгдэхүүн үзэх
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {myOrders.map((order) => {
            const status = orderStatus(order);
            return (
              <Link
                key={order.id}
                to="/order/$id"
                params={{ id: order.id }}
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-secondary/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-display font-bold tabular-nums">#{order.id}</span>
                    <StatusBadge label={ORDER_STATUS_LABELS[status]} tone={status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                    {new Date(order.createdAt).toLocaleDateString("mn-MN")}
                  </p>
                </div>
                <span className="shrink-0 text-right">
                  <span className="block font-display font-bold tabular-nums">
                    {mnt(order.totals.total)}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
