import { useNavigate } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { CartLine } from "@/components/cart-lines";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Btn, EmptyState, SummaryRow } from "@/components/ui-kit";
import { useCatalog } from "@/lib/catalog-store";
import { mnt } from "@/lib/format";
import { computeTotals, useCart } from "@/lib/store";
import { useUi } from "@/lib/ui-store";

export function CartDrawer() {
  const { cartOpen, closeCart } = useUi();
  const { items, removeItem } = useCart();
  const { products, glues, getGlueProduct } = useCatalog();
  const totals = computeTotals(items, products, false, glues);
  const navigate = useNavigate();

  return (
    <Sheet open={cartOpen} onOpenChange={(open) => !open && closeCart()}>
      <SheetContent side="right" className="flex w-[92%] flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="font-display">Сагс</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 overflow-y-auto p-5">
            <EmptyState
              icon={ShoppingBag}
              title="Таны сагс хоосон байна"
              description="Бүтээгдэхүүн сонгоод хэрэгцээт хэмжээгээ тооцоолоорой."
              action={
                <Btn
                  onClick={() => {
                    closeCart();
                    navigate({ to: "/products" });
                  }}
                >
                  Бүтээгдэхүүн үзэх
                </Btn>
              }
            />
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div className="space-y-3">
                {items.map((item) => (
                  <CartLine key={item.id} item={item} onRemove={() => removeItem(item.id)} />
                ))}
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="font-display text-sm font-bold">Захиалгын дүн</h3>
                <div className="mt-2">
                  <SummaryRow label="Бүтээгдэхүүн" value={mnt(totals.goods)} />
                  <SummaryRow label="Цавуу" value={mnt(totals.glue)} />
                  <SummaryRow label="Хүргэлт" value="Дараагийн алхамд" muted />
                  <SummaryRow label="Нийт" value={mnt(totals.total)} strong />
                </div>
              </div>
            </div>

            <div className="shrink-0 space-y-2 border-t border-border bg-card p-4">
              <Btn
                size="lg"
                className="w-full"
                onClick={() => {
                  closeCart();
                  navigate({ to: "/checkout" });
                }}
              >
                Төлбөр үргэлжлүүлэх
              </Btn>
              <Btn
                variant="secondary"
                className="w-full"
                onClick={() => {
                  closeCart();
                  navigate({ to: "/cart" });
                }}
              >
                Сагс харах
              </Btn>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
