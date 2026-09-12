import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Banknote, Package, ShoppingBag, Users } from "lucide-react";
import { api } from "@/lib/api";
import { mnt } from "@/lib/format";
import type { Order } from "@/lib/store";
import type { Product } from "@/lib/products";
import { ORDER_STATUS_LABELS } from "@/lib/orders";
import { PageTitle, Panel, Loading, DataError, Empty } from "@/components/admin/shared";
export const Route = createFileRoute("/admin/")({
  component: Dashboard,
  head: () => ({
    meta: [{ title: "Удирдлагын самбар | JINTEMO" }, { name: "robots", content: "noindex" }],
  }),
});
type Overview = {
  products: number;
  users: number;
  openOrders: number;
  newContacts: number;
  revenue: number;
  recentOrders: Order[];
  lowStock: (Product & { kind: string; stock: number })[];
};
function Dashboard() {
  const q = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => api<Overview>("/admin/overview"),
    refetchInterval: 20000,
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <DataError error={q.error.message} retry={q.refetch} />;
  const d = q.data!;
  return (
    <>
      <PageTitle
        title="Өнөөдрийн тойм"
        description="Борлуулалт, захиалга болон барааны үлдэгдэл."
        action={
          <Link
            to="/admin/products/new"
            className="rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground"
          >
            + Бүтээгдэхүүн нэмэх
          </Link>
        }
      />
      <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [Banknote, "Төлөгдсөн борлуулалт", mnt(d.revenue)],
          [ShoppingBag, "Идэвхтэй захиалга", d.openOrders],
          [Package, "Бүтээгдэхүүн", d.products],
          [Users, "Хэрэглэгч", d.users],
        ].map(([Icon, label, value]) => {
          const I = Icon as typeof Package;
          return (
            <Panel key={String(label)}>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{String(label)}</span>
                <I size={18} />
              </div>
              <p className="mt-4 font-display text-3xl font-bold tabular-nums">{String(value)}</p>
            </Panel>
          );
        })}
      </div>
      {d.newContacts > 0 && (
        <Link to="/admin/contacts" className="mb-6 block rounded-lg bg-accent/10 p-4 text-accent">
          {d.newContacts} шинэ зурвас ирсэн байна →
        </Link>
      )}
      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <Panel>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Сүүлийн захиалгууд</h2>
            <Link to="/admin/orders" className="text-sm text-accent">
              Бүгдийг үзэх
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-3">Захиалга</th>
                  <th>Хэрэглэгч</th>
                  <th>Төлөв</th>
                  <th className="text-right">Нийт дүн</th>
                </tr>
              </thead>
              <tbody>
                {d.recentOrders.map((o) => (
                  <tr key={o.id} className="border-t border-border">
                    <td className="py-4">
                      <Link to="/order/$id" params={{ id: o.id }} className="font-medium">
                        {o.id}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(o.createdAt).toLocaleDateString()}
                      </p>
                    </td>
                    <td>{o.name}</td>
                    <td>{ORDER_STATUS_LABELS[o.status]}</td>
                    <td className="text-right font-semibold">{mnt(o.totals.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!d.recentOrders.length && <Empty>Эхний захиалга энд харагдана.</Empty>}
        </Panel>
        <Panel>
          <h2 className="text-lg font-bold">Үлдэгдэл багатай бараа</h2>
          <div className="mt-4 divide-y divide-border">
            {d.lowStock.map((p) => (
              <Link
                key={p.slug}
                to="/admin/products/$slug"
                params={{ slug: p.slug }}
                className="block py-3"
              >
                <p className="font-medium">{p.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {p.kind === "glue"
                    ? `${p.stock} ширхэг`
                    : p.variants
                        .filter((v) => v.stock < 10)
                        .map((v) => `${v.name}: ${v.stock}`)
                        .join(" · ")}
                </p>
              </Link>
            ))}
          </div>
          {!d.lowStock.length && <Empty>Үлдэгдэл хэвийн байна.</Empty>}
        </Panel>
      </div>
    </>
  );
}
