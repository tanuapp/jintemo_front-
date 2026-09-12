import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { api, json, errorMessage } from "@/lib/api";
import { ORDER_STATUS_LABELS, orderTimeline, type OrderStatus as Status } from "@/lib/orders";
import { mnt } from "@/lib/format";
import { Btn, Field, TextInput, Timeline, StatusBadge, SummaryRow } from "@/components/ui-kit";
export const Route = createFileRoute("/track")({ component: Track });
type TrackedOrder = {
  id: string;
  createdAt: string;
  status: Status;
  paymentStatus: "unpaid" | "paid" | "refunded";
  totals: { total: number };
  delivery: boolean;
  hasInstall: boolean;
};
function Track() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  return (
    <div className="container-page max-w-2xl py-12">
      <h1 className="text-3xl font-bold">Захиалга шалгах</h1>
      <p className="mt-3 text-muted-foreground">Утасны дугаар болон захиалгын кодоо оруулна уу.</p>
      <form
        className="mt-6 space-y-4 rounded-xl border border-border bg-card p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          setOrder(null);
          try {
            const r = await api<{ order: TrackedOrder }>(
              "/orders/track",
              json("POST", { phone, code }),
            );
            setOrder(r.order);
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Утасны дугаар">
          <TextInput
            required
            value={phone}
            inputMode="tel"
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <Field label="Захиалгын код">
          <TextInput
            required
            value={code}
            placeholder="JIN-…"
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>
        <Btn type="submit" disabled={busy}>
          {busy ? "Шалгаж байна…" : "Захиалга шалгах"}
        </Btn>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
      {order && (
        <div className="mt-5 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <strong>{order.id}</strong>
            <StatusBadge label={ORDER_STATUS_LABELS[order.status]} tone={order.status} />
          </div>
          <div className="my-6">
            <Timeline steps={orderTimeline(order)} />
          </div>
          <SummaryRow
            label="Төлбөрийн төлөв"
            value={
              { unpaid: "Төлөгдөөгүй", paid: "Төлөгдсөн", refunded: "Буцаалт хийгдсэн" }[
                order.paymentStatus
              ]
            }
          />
          <SummaryRow label="Захиалгын нийт дүн" value={mnt(order.totals.total)} />
        </div>
      )}
    </div>
  );
}
