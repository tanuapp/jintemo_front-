/**
 * Simplified order status model.
 *
 * Status comes from the backend. Only three main states are shown
 * in the timeline; "cancelled" is a separate terminal state.
 */
export type OrderStatus = "confirmed" | "shipped" | "done" | "cancelled";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  confirmed: "Захиалга баталгаажсан",
  shipped: "Хүргэлтэд гарсан",
  done: "Дууссан",
  cancelled: "Цуцлагдсан",
};

/** The three main statuses, in order, that make up the visible timeline. */
export const ORDER_FLOW: Exclude<OrderStatus, "cancelled">[] = ["confirmed", "shipped", "done"];

type OrderLike = { createdAt: string; status?: OrderStatus | undefined };

export function orderStatus(order: OrderLike): OrderStatus {
  if (order.status) return order.status;
  return "confirmed";
}

export type TimelineNode = {
  label: string;
  state: "done" | "current" | "todo" | "cancelled";
};

/** Simple 3-step timeline (or a single cancelled node). */
export function orderTimeline(order: OrderLike): TimelineNode[] {
  const status = orderStatus(order);
  if (status === "cancelled") {
    return [{ label: ORDER_STATUS_LABELS.cancelled, state: "cancelled" }];
  }
  const activeIndex = ORDER_FLOW.indexOf(status);
  return ORDER_FLOW.map((key, i) => ({
    label: ORDER_STATUS_LABELS[key],
    state: i < activeIndex ? "done" : i === activeIndex ? "current" : "todo",
  }));
}
