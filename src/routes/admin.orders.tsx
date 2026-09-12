import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, json } from "@/lib/api";
import type { Order } from "@/lib/store";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/orders";
import { mnt } from "@/lib/format";
import { Btn } from "@/components/ui-kit";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  PageTitle,
  Panel,
  Loading,
  DataError,
  Empty,
  ConfirmButton,
  useAction,
  inputClass,
} from "@/components/admin/shared";
export const Route = createFileRoute("/admin/orders")({ component: Orders });
const payLabels = { unpaid: "Төлөгдөөгүй", paid: "Төлөгдсөн", refunded: "Буцаалт хийгдсэн" };
function Orders() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Order | null>(null);
  const { busy, run } = useAction();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "orders", status, page],
    queryFn: () =>
      api<{ orders: Order[]; total: number; pages: number }>(
        `/admin/orders?page=${page}${status ? `&status=${status}` : ""}`,
      ),
    refetchInterval: 20000,
  });
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admin"] }),
      qc.invalidateQueries({ queryKey: ["catalog"] }),
      qc.invalidateQueries({ queryKey: ["orders"] }),
    ]);
  };
  const update = async (o: Order, patch: Partial<Order>) => {
    const r = await api<{ order: Order }>(`/admin/orders/${o.id}`, json("PATCH", patch));
    setSelected(r.order);
    await refresh();
  };
  return (
    <>
      <PageTitle
        title="Захиалгууд"
        description="Хүргэлт, төлбөрийн төлөв болон цуцлалтыг удирдана."
      />
      <Panel>
        <div className="mb-5 flex items-center justify-between gap-3">
          <select
            aria-label="Захиалгын төлөвөөр шүүх"
            className={`${inputClass} max-w-xs`}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Бүх төлөв</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([k, n]) => (
              <option key={k} value={k}>
                {n}
              </option>
            ))}
          </select>
          <span className="text-sm text-muted-foreground">{q.data?.total || 0} захиалга</span>
        </div>
        {q.isLoading ? (
          <Loading />
        ) : q.error ? (
          <DataError error={q.error.message} retry={q.refetch} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] text-left text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="pb-3">Код / Огноо</th>
                    <th>Захиалагч</th>
                    <th>Хүргэлт</th>
                    <th>Төлбөр</th>
                    <th>Нийт дүн</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {q.data?.orders.map((o) => (
                    <tr className="border-t border-border" key={o.id}>
                      <td className="py-4 font-medium">
                        {o.id}
                        <p className="mt-1 text-xs font-normal text-muted-foreground">
                          {new Date(o.createdAt).toLocaleString()}
                        </p>
                      </td>
                      <td>
                        {o.name}
                        <p className="text-xs text-muted-foreground">{o.phone}</p>
                      </td>
                      <td>{ORDER_STATUS_LABELS[o.status]}</td>
                      <td>{payLabels[o.paymentStatus]}</td>
                      <td className="font-semibold">{mnt(o.totals.total)}</td>
                      <td>
                        <button className="text-accent" onClick={() => setSelected(o)}>
                          Дэлгэрэнгүй
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!q.data?.orders.length && <Empty />}
            <div className="mt-5 flex items-center justify-end gap-3">
              <Btn variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Өмнөх
              </Btn>
              <span className="text-sm">
                {page} / {q.data?.pages || 1}
              </span>
              <Btn
                variant="secondary"
                disabled={page >= (q.data?.pages || 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                Дараах
              </Btn>
            </div>
          </>
        )}
      </Panel>
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Захиалга {selected?.id}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              <div className="grid gap-4 rounded-lg bg-surface p-4 sm:grid-cols-2">
                <div>
                  <p className="font-semibold">{selected.name}</p>
                  <p className="mt-1 text-sm">{selected.phone}</p>
                  <p className="text-sm">{selected.email}</p>
                </div>
                <div>
                  <p className="text-sm">{selected.address || "Өөрөө ирж авна"}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{selected.note}</p>
                </div>
              </div>
              <div className="divide-y divide-border">
                {selected.items.map((i) => (
                  <div className="flex items-center gap-3 py-3" key={i.id}>
                    {i.snapshot.image && (
                      <img
                        src={i.snapshot.image}
                        alt=""
                        className="h-14 w-14 rounded object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{i.snapshot.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {i.snapshot.quantity} × {mnt(i.snapshot.unitPrice)}
                      </p>
                    </div>
                    <span className="font-semibold">{mnt(i.snapshot.total)}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm">
                Хүргэлт: {mnt(selected.totals.shipping)} ·{" "}
                {selected.hasInstall
                  ? "Суурилуулалттай — үнийг тусад нь тохирно"
                  : "Суурилуулалтгүй"}
              </p>
              <p className="text-xl font-bold">Нийт: {mnt(selected.totals.total)}</p>
              <p className="text-sm">Төлбөрийн арга: {selected.payment}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium">
                  Хүргэлтийн төлөв
                  <select
                    className={`${inputClass} mt-2`}
                    value={selected.status}
                    disabled={busy}
                    onChange={(e) =>
                      run(() => update(selected, { status: e.target.value as OrderStatus }))
                    }
                  >
                    {Object.entries(ORDER_STATUS_LABELS).map(([k, n]) => (
                      <option
                        key={k}
                        value={k}
                        disabled={
                          !{
                            confirmed: ["confirmed", "shipped", "cancelled"],
                            shipped: ["shipped", "done"],
                            done: ["done"],
                            cancelled: ["cancelled"],
                          }[selected.status].includes(k)
                        }
                      >
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium">
                  Төлбөрийн төлөв
                  <select
                    className={`${inputClass} mt-2`}
                    value={selected.paymentStatus}
                    disabled={busy}
                    onChange={(e) =>
                      run(() =>
                        update(selected, {
                          paymentStatus: e.target.value as Order["paymentStatus"],
                        }),
                      )
                    }
                  >
                    {Object.entries(payLabels).map(([k, n]) => (
                      <option
                        key={k}
                        value={k}
                        disabled={
                          !{
                            unpaid: ["unpaid", "paid"],
                            paid: ["paid", "refunded"],
                            refunded: ["refunded"],
                          }[selected.paymentStatus].includes(k) ||
                          (k === "paid" &&
                            selected.status === "cancelled" &&
                            selected.paymentStatus !== "paid")
                        }
                      >
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="text-sm text-muted-foreground">
                Банкны шилжүүлэг эсвэл хүлээн авах үеийн төлбөрийг шалгасны дараа “Төлөгдсөн”
                болгоно.
              </p>
              {selected.status === "cancelled" && selected.paymentStatus !== "paid" && (
                <ConfirmButton
                  title="Цуцлагдсан захиалгыг устгах уу?"
                  onConfirm={async () => {
                    await api(`/admin/orders/${selected.id}`, { method: "DELETE" });
                    setSelected(null);
                    await refresh();
                  }}
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
