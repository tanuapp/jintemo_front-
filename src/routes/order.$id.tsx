import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { m2, mnt } from "@/lib/format";
import { ORDER_STATUS_LABELS, orderTimeline } from "@/lib/orders";
import type { Order } from "@/lib/store";
import { useSettings, installationRate } from "@/lib/settings";
import { StatusBadge, SummaryRow, Timeline } from "@/components/ui-kit";
import { Loading, DataError, ConfirmButton } from "@/components/admin/shared";
export const Route = createFileRoute("/order/$id")({
  head: () => ({
    meta: [{ title: "Захиалгын дэлгэрэнгүй | JINTEMO" }, { name: "robots", content: "noindex" }],
  }),
  component: OrderDetail,
});
function OrderDetail() {
  const { id } = Route.useParams();
  const { user, ready } = useAuth();
  const { settings } = useSettings();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["orders", user?.id, id],
    queryFn: () => api<{ order: Order }>(`/orders/${id}`),
    enabled: !!user,
    refetchInterval: 15000,
    retry: 1,
  });
  if (!ready) return <Loading />;
  if (!user)
    return (
      <div className="container-page py-16 text-center">
        <h1 className="mb-5 text-2xl font-bold">Захиалгаа харахын тулд нэвтэрнэ үү</h1>
        <Link to="/login" className="text-accent underline">
          Нэвтрэх
        </Link>
      </div>
    );
  if (q.error) return <DataError error={q.error.message} retry={q.refetch} />;
  if (!q.data) return <Loading />;
  const o = q.data.order;
  return (
    <div className="mx-auto max-w-[800px] px-4 py-10">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Захиалгын дэлгэрэнгүй</h1>
          <StatusBadge label={ORDER_STATUS_LABELS[o.status]} tone={o.status} />
        </div>
        <p className="mt-4 break-all text-lg font-semibold">{o.id}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date(o.createdAt).toLocaleString()}
        </p>
        <div className="my-6 rounded-xl bg-secondary/50 p-4">
          <Timeline steps={orderTimeline(o)} />
        </div>
        <div className="divide-y divide-border">
          {o.items.map((i) => (
            <div key={i.id} className="flex items-center gap-4 py-4">
              {i.snapshot.image && (
                <img src={i.snapshot.image} alt="" className="h-16 w-16 rounded-lg object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{i.snapshot.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {i.snapshot.quantity} ширхэг × {mnt(i.snapshot.unitPrice)}
                  {i.snapshot.area > 0 ? ` · ${m2(i.snapshot.area)}` : ""}
                </p>
              </div>
              <strong className="shrink-0 text-sm">{mnt(i.snapshot.total)}</strong>
            </div>
          ))}
        </div>
        <div className="mt-5 space-y-2 border-t border-border pt-5">
          <SummaryRow label="Захиалагч" value={`${o.name} · ${o.phone}`} />
          <SummaryRow label="Хаяг" value={o.address || "Өөрөө ирж авна"} />
          <SummaryRow label="Хүргэлт" value={mnt(o.totals.shipping)} />
          {o.hasInstall && (
            <SummaryRow
              label="Суурилуулалт"
              value={`Үнэ тусад нь тохирно · ${installationRate(settings)}`}
            />
          )}
          <SummaryRow label="Төлбөрийн арга" value={o.payment} />
          <SummaryRow
            label="Төлбөрийн төлөв"
            value={
              { unpaid: "Төлөгдөөгүй", paid: "Төлөгдсөн", refunded: "Буцаалт хийгдсэн" }[
                o.paymentStatus
              ]
            }
          />
          <SummaryRow label="Захиалгын нийт дүн" value={mnt(o.totals.total)} strong />
          {o.note && <p className="pt-3 text-sm text-muted-foreground">Тайлбар: {o.note}</p>}
        </div>
        {o.hasInstall && (
          <p className="mt-4 rounded-lg bg-surface p-3 text-sm">
            {settings.installationDisclaimer}
          </p>
        )}
        {o.payment === "Банкны шилжүүлэг" &&
          o.paymentStatus === "unpaid" &&
          o.status !== "cancelled" && (
            <div className="mt-5 rounded-xl bg-accent/10 p-5">
              <h2 className="font-semibold">Шилжүүлгийн мэдээлэл</h2>
              <p className="mt-3 text-sm">
                {settings.bankName} · {settings.bankAccount}
              </p>
              <p className="mt-1 text-sm">{settings.bankOwner}</p>
              <p className="mt-3 text-sm">
                Гүйлгээний утга: <strong>{o.id}</strong>
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Шилжүүлгийг шалгасны дараа төлбөрийн төлөв шинэчлэгдэнэ.
              </p>
            </div>
          )}
        <div className="mt-7 flex flex-wrap items-center gap-5 border-t border-border pt-5">
          <Link
            to={user.role === "admin" ? "/admin/orders" : "/profile/orders"}
            className="font-medium text-accent"
          >
            Захиалгууд руу буцах
          </Link>
          <Link to="/products" className="font-medium">
            Дэлгүүр рүү буцах
          </Link>
          {o.status === "confirmed" && o.userId === user.id && (
            <ConfirmButton
              label="Захиалга цуцлах"
              title="Захиалгыг цуцлах уу?"
              description="Захиалсан барааны үлдэгдэл буцаан нэмэгдэнэ. Төлсөн бол буцаалтын талаар бидэнтэй холбогдоно уу."
              onConfirm={async () => {
                await api(`/orders/${o.id}/cancel`, { method: "POST" });
                await Promise.all([
                  qc.invalidateQueries({ queryKey: ["orders"] }),
                  qc.invalidateQueries({ queryKey: ["catalog"] }),
                ]);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
