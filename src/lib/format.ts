export function mnt(value: number) {
  return `${Math.round(value)
    .toLocaleString("mn-MN")
    .replace(/\u00a0/g, ",")}₮`;
}

export function m2(value: number) {
  return `${value.toFixed(2).replace(/\.00$/, "")} m²`;
}

const UNIT_LABELS = { m2: "м²", piece: "ширхэг", meter: "метр" } as const;

/**
 * One order line as charged, e.g. "8 ширхэг · 2 м² × 88,000₮/м²" for tiles priced per m²
 * or "3 метр × 18,000₮/метр" for a single item. Orders placed before price units existed
 * have no `priceUnit` and were charged per piece.
 */
export function orderLineLabel(
  s: {
    quantity: number;
    unitPrice: number;
    priceUnit?: keyof typeof UNIT_LABELS;
    unitQuantity?: number;
    area: number;
  },
  kind: "carpet" | "glue",
) {
  const unit = s.priceUnit ?? "piece";
  const label = UNIT_LABELS[unit];
  const price = `${mnt(s.unitPrice)}/${label}`;
  if (kind === "glue") return `${s.quantity} ${label} × ${price}`;
  const parts = [`${s.quantity} ширхэг`];
  if (unit !== "piece" && s.unitQuantity !== undefined)
    parts.push(`${String(Number(s.unitQuantity.toFixed(3)))} ${label}`);
  if (unit !== "m2" && s.area > 0) parts.push(m2(s.area));
  return `${parts.join(" · ")} × ${price}`;
}
