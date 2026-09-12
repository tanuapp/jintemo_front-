import { createFileRoute, Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { CartLine } from "@/components/cart-lines";
import { Btn, EmptyState, SummaryRow } from "@/components/ui-kit";
import { useCatalog } from "@/lib/catalog-store";
import { mnt } from "@/lib/format";
import { computeTotals, useCart } from "@/lib/store";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Сагс — захиалгаа шалгах | JINTEMO" },
      {
        name: "description",
        content:
          "Сонгосон хивс, цавуу, суурилуулалтын үйлчилгээгээ шалгаад захиалгаа үргэлжлүүлнэ үү.",
      },
      { property: "og:title", content: "Сагс | JINTEMO" },
      { property: "og:description", content: "Таны сонгосон бүтээгдэхүүн, нэмэлт үйлчилгээ." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { items, ready, removeItem } = useCart();
  const { products, glues, getGlueProduct } = useCatalog();
  const totals = computeTotals(items, products, false, glues);

  if (!ready) {
    return (
      <div className="container-page py-16">
        <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-6 space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container-page py-20">
        <EmptyState
          icon={ShoppingBag}
          title="Таны сагс хоосон байна"
          description="Бүтээгдэхүүн сонгоод хэрэгцээт хэмжээгээ тооцоолоорой."
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
    );
  }

  return (
    <div className="container-page py-8 pb-28 lg:pb-16">
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Сагс</h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {items.map((item) => (
            <CartLine key={item.id} item={item} onRemove={() => removeItem(item.id)} />
          ))}
        </div>

        <aside className="h-fit rounded-lg border border-border bg-card p-5 lg:sticky lg:top-24">
          <h2 className="font-display text-lg font-bold">Захиалгын дүн</h2>
          <div className="mt-3">
            <SummaryRow label="Бүтээгдэхүүн" value={mnt(totals.goods)} />
            <SummaryRow label="Цавуу" value={mnt(totals.glue)} />
            <SummaryRow label="Хүргэлт" value="Дараагийн алхамд" muted />
            <SummaryRow label="Нийт" value={mnt(totals.total)} strong />
          </div>
          <Link
            to="/checkout"
            className="mt-5 hidden h-13 w-full items-center justify-center rounded-md bg-primary text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90 lg:inline-flex"
          >
            Захиалга үргэлжлүүлэх
          </Link>
          <Link
            to="/products"
            className="mt-3 block text-center text-sm text-accent hover:underline"
          >
            Бүтээгдэхүүн үргэлжлүүлэн үзэх
          </Link>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 p-3 backdrop-blur lg:hidden">
        <div className="container-page grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-0">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Нийт</p>
            <p className="truncate font-display text-lg font-bold">{mnt(totals.total)}</p>
          </div>
          <Link to="/checkout">
            <Btn size="lg">Захиалга үргэлжлүүлэх</Btn>
          </Link>
        </div>
      </div>
    </div>
  );
}
