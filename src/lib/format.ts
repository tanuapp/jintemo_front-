export function mnt(value: number) {
  return `${Math.round(value)
    .toLocaleString("mn-MN")
    .replace(/\u00a0/g, ",")}₮`;
}

export function m2(value: number) {
  return `${value.toFixed(2).replace(/\.00$/, "")} m²`;
}
