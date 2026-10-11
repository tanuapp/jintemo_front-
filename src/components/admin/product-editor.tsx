import { useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { api, json } from "@/lib/api";
import { useCatalog } from "@/lib/catalog-store";
import { mnt } from "@/lib/format";
import {
  PRICE_UNITS,
  PRICE_UNIT_LABELS,
  pieceFactor,
  type ColorVariant,
  type GlueProduct,
  type PriceUnit,
  type Product,
  type ProductKind,
} from "@/lib/products";
import { Btn } from "@/components/ui-kit";
import { PageTitle, Panel, Loading, DataError, useAction, inputClass } from "./shared";
import { ImageField, ImageList } from "./image-field";
type Draft = Partial<Product & GlueProduct> & {
  kind: ProductKind;
  typeId: string;
  name: string;
  variants: ColorVariant[];
};
/** Width and length are edited as text so "0.5", "0,25" and an empty field all work. */
type Dims = { width: string; length: string };
type Errors = Record<string, string>;
const dimsOf = (p: { widthM?: number | undefined; lengthM?: number | undefined }): Dims => ({
  width: p.widthM ? String(p.widthM) : "",
  length: p.lengthM ? String(p.lengthM) : "",
});
const parseDim = (s: string) => (s.trim() ? Number(s.trim().replace(",", ".")) : undefined);
const MAX_PRICE = 100000000;
const isPrice = (v: unknown) =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= MAX_PRICE;
const isStock = (v: unknown) =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= 10000000;
export function ProductEditorPage({
  slug,
  section,
  kind,
}: {
  slug?: string | undefined;
  section?: string | undefined;
  kind?: ProductKind;
}) {
  const c = useCatalog();
  if (c.error) return <DataError error={c.error} retry={c.refresh} />;
  if (!c.ready) return <Loading />;
  const original = slug ? c.catalog.find((p) => p.slug === slug) : undefined;
  if (slug && !original) return <DataError error="Бүтээгдэхүүн олдсонгүй." />;
  const active = c.types.filter((t) => t.active);
  const type = active.find((t) => t.kind === (kind || "carpet")) ?? active[0];
  if (!original && !type)
    return (
      <DataError error="Идэвхтэй бүтээгдэхүүний төрөл алга. «Бүтээгдэхүүн» хуудаснаас төрөл нэмнэ үү." />
    );
  const newKind = type?.kind ?? "carpet";
  return (
    <Editor
      key={slug || "new"}
      initial={
        original
          ? { ...original, variants: original.kind === "carpet" ? original.variants : [] }
          : {
              kind: newKind,
              typeId: type?.id ?? newKind,
              name: "",
              short: "",
              description: "",
              sectionId: section || "",
              priceUnit: newKind === "carpet" ? "m2" : "piece",
              widthM: newKind === "carpet" ? 0.5 : undefined,
              lengthM: newKind === "carpet" ? 0.5 : undefined,
              thickness: "6.5 мм",
              material: "Найлон 100%",
              origin: "Япон",
              style: "Минимал загвар",
              rooms: [],
              basePrice: 0,
              variants: [],
              gallery: [],
              active: true,
              popularity: 0,
              glueType: newKind === "glue" && type?.id === "glue" ? "permanent" : "",
              price: 0,
              stock: 0,
              packageSize: "",
              usage: [],
              surfaces: [],
              image: "",
              sku: "",
            }
      }
      existing={!!slug}
    />
  );
}
function Editor({ initial, existing }: { initial: Draft; existing: boolean }) {
  const [d, setD] = useState<Draft>(() => structuredClone(initial));
  const [dims, setDims] = useState<Dims>(() => dimsOf(initial));
  const [errors, setErrors] = useState<Errors>({});
  const { busy, run } = useAction();
  const c = useCatalog();
  const navigate = useNavigate();
  const patch = (p: Partial<Draft>) => setD((d) => ({ ...d, ...p }));
  const unit: PriceUnit = d.priceUnit ?? "piece";
  const unitLabel = PRICE_UNIT_LABELS[unit];
  // A saved product keeps its structure; it can move between types of that structure.
  const typeOptions = c.types.filter(
    (t) => (t.active || t.id === d.typeId) && (!existing || t.kind === initial.kind),
  );
  const fieldError = (key: string) =>
    errors[key] && <span className="mt-1 block text-xs text-destructive">{errors[key]}</span>;
  const field = (key: keyof Draft, label: string, type = "text", required = false) => (
    <label key={key} className="block text-sm font-medium">
      {label}
      <input
        className={`${inputClass} mt-2`}
        required={required}
        type={type}
        min={type === "number" ? 0 : undefined}
        step={key === "coverage" ? "0.01" : type === "number" ? 1 : undefined}
        aria-invalid={!!errors[key]}
        value={String(d[key] ?? "")}
        onChange={(e) =>
          patch({
            [key]:
              type === "number"
                ? e.target.value === "" && key === "oldPrice"
                  ? undefined
                  : Number(e.target.value)
                : e.target.value,
          })
        }
      />
      {fieldError(key)}
    </label>
  );
  const lines = (key: "rooms" | "usage" | "surfaces", label: string) => (
    <label className="block text-sm font-medium">
      {label}
      <textarea
        className={`${inputClass} mt-2 min-h-24 py-3`}
        value={(d[key] || []).join("\n")}
        onChange={(e) => patch({ [key]: e.target.value.split("\n") })}
      />
    </label>
  );
  const changeVariant = (i: number, p: Partial<ColorVariant>) =>
    patch({ variants: d.variants.map((v, j) => (i === j ? { ...v, ...p } : v)) });

  const width = parseDim(dims.width);
  const length = parseDim(dims.length);
  const price = d.kind === "carpet" ? d.basePrice : d.price;
  const validate = () => {
    const e: Errors = {};
    if (!d.name.trim()) e["name"] = "Нэр оруулна уу.";
    if (!d.typeId) e["typeId"] = "Бүтээгдэхүүний төрөл сонгоно уу.";
    if (!isPrice(price)) e["price"] = "Үнэ 0 эсвэл түүнээс их бүхэл тоо байна.";
    if (d.oldPrice !== undefined && d.oldPrice !== null && !isPrice(d.oldPrice))
      e["oldPrice"] = "Хуучин үнэ 0 эсвэл түүнээс их бүхэл тоо байна.";
    if (width !== undefined && !(Number.isFinite(width) && width > 0))
      e["widthM"] = "Өргөн 0-ээс их тоо байна.";
    if (length !== undefined && !(Number.isFinite(length) && length > 0))
      e["lengthM"] = "Урт 0-ээс их тоо байна.";
    if (d.kind === "carpet" && unit === "m2") {
      if (width === undefined) e["widthM"] ??= "м² үнэтэй бараанд өргөнийг заавал оруулна.";
      if (length === undefined) e["lengthM"] ??= "м² үнэтэй бараанд уртыг заавал оруулна.";
    }
    if (d.kind === "carpet" && unit === "meter" && length === undefined)
      e["lengthM"] ??= "Метрийн үнэтэй бараанд уртыг заавал оруулна.";
    if (d.kind === "glue" && !isStock(d.stock))
      e["stock"] = "Үлдэгдэл 0 эсвэл түүнээс их бүхэл тоо байна.";
    if (d.kind === "glue" && d.coverage !== undefined && d.coverage !== 0 && !(d.coverage > 0))
      e["coverage"] = "Хамрах талбай 0-ээс их тоо байна.";
    // A variant product is sold by colour; without one it cannot appear on the website.
    if (d.kind === "carpet" && d.active !== false && !d.variants.length)
      e["variants"] =
        "Вэб дээр харуулахын тулд дор хаяж нэг өнгө нэмнэ үү. Өнгөгүй бараа бол төрлийн бүтцийг «Энгийн бараа» болгоно уу.";
    d.variants.forEach((v, i) => {
      if (!v.name.trim()) e[`variant.${i}.name`] = "Өнгөний нэр оруулна уу.";
      if (!isStock(v.stock)) e[`variant.${i}.stock`] = "Үлдэгдэл 0 эсвэл түүнээс их бүхэл тоо.";
      if (v.price !== undefined && !isPrice(v.price))
        e[`variant.${i}.price`] = "Үнэ 0 эсвэл түүнээс их бүхэл тоо.";
    });
    return e;
  };
  const save = async () => {
    await run(async () => {
      const found = validate();
      setErrors(found);
      const first = Object.values(found)[0];
      if (first) throw new Error(`Формын алдааг засна уу: ${first}`);
      // The legacy square tile size is superseded by width and length.
      const { tileSize: _legacy, ...rest } = d;
      const body = {
        ...rest,
        widthM: width ?? null,
        lengthM: length ?? null,
        // null clears a value the admin emptied; an omitted field would keep the old one.
        coverage: d.coverage || null,
        rooms: d.rooms?.filter(Boolean),
        usage: d.usage?.filter(Boolean),
        surfaces: d.surfaces?.filter(Boolean),
        gallery: d.gallery?.filter(Boolean),
        oldPrice: d.oldPrice || null,
        expectedUpdatedAt: d.updatedAt,
      };
      const result = await api<{ product: Product & GlueProduct & { kind: ProductKind } }>(
        existing ? `/admin/products/${encodeURIComponent(d.slug!)}` : "/admin/products",
        json(existing ? "PATCH" : "POST", body),
      );
      setD({ ...result.product, variants: result.product.variants || [] });
      setDims(dimsOf(result.product));
      await c.refresh();
      if (!existing)
        await navigate({ to: "/admin/products/$slug", params: { slug: result.product.slug } });
    });
  };
  // What one piece costs at the entered unit price, so the admin can check the number.
  const piecePreview =
    d.kind === "carpet" && unit !== "piece" && isPrice(price) && price
      ? (unit === "m2" ? width && length : length)
        ? `1 ширхэг (${unit === "m2" ? `${width} × ${length} м` : `${length} м`}) = ${mnt(
            (price ?? 0) * pieceFactor({ priceUnit: unit, widthM: width, lengthM: length }),
          )}`
        : ""
      : "";
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <PageTitle
        title={existing ? d.name || "Бүтээгдэхүүн засах" : "Бүтээгдэхүүн нэмэх"}
        action={
          <div className="flex gap-2">
            <Btn
              variant="secondary"
              type="button"
              onClick={() => navigate({ to: "/admin/catalog" })}
            >
              Буцах
            </Btn>
            <Btn type="submit" disabled={busy}>
              {busy ? "Хадгалж байна…" : "Хадгалах"}
            </Btn>
          </div>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Panel>
          <h2 className="mb-5 text-lg font-bold">Үндсэн мэдээлэл</h2>
          <div className="space-y-4">
            <label className="block text-sm font-medium">
              Бүтээгдэхүүний төрөл
              <select
                className={`${inputClass} mt-2`}
                value={d.typeId}
                aria-invalid={!!errors["typeId"]}
                onChange={(e) => {
                  const type = c.types.find((t) => t.id === e.target.value);
                  if (type) patch({ typeId: type.id, kind: type.kind });
                }}
              >
                {typeOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.active ? "" : " (идэвхгүй)"}
                  </option>
                ))}
              </select>
              {fieldError("typeId")}
            </label>
            {field("name", "Нэр", "text", true)}
            {field("short", "Товч тайлбар")}
            <label className="block text-sm font-medium">
              Дэлгэрэнгүй тайлбар
              <textarea
                className={`${inputClass} mt-2 min-h-36 py-3`}
                value={d.description || ""}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Үнэ (₮)
                <input
                  className={`${inputClass} mt-2`}
                  type="number"
                  min={0}
                  step={1}
                  required
                  aria-invalid={!!errors["price"]}
                  value={String(price ?? "")}
                  onChange={(e) =>
                    patch(
                      d.kind === "carpet"
                        ? { basePrice: Number(e.target.value) }
                        : { price: Number(e.target.value) },
                    )
                  }
                />
                {fieldError("price")}
              </label>
              <label className="block text-sm font-medium">
                Үнийн нэгж
                <select
                  className={`${inputClass} mt-2`}
                  value={unit}
                  onChange={(e) => patch({ priceUnit: e.target.value as PriceUnit })}
                >
                  {PRICE_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {PRICE_UNIT_LABELS[u]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Hint>
              Оруулсан үнэ нь нэг {unitLabel}-ийн үнэ ({mnt(isPrice(price) ? price! : 0)} /{" "}
              {unitLabel}). Систем үнийг автоматаар хувааж, үржүүлэхгүй.
              {piecePreview && ` Сагсанд: ${piecePreview}.`}
            </Hint>

            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["width", "widthM", "Өргөн (м)"],
                  ["length", "lengthM", "Урт (м)"],
                ] as const
              ).map(([key, error, label]) => (
                <label key={key} className="block text-sm font-medium">
                  {label}
                  <input
                    className={`${inputClass} mt-2`}
                    inputMode="decimal"
                    placeholder={key === "width" ? "жишээ нь 0.5" : "жишээ нь 1.82"}
                    aria-invalid={!!errors[error]}
                    value={dims[key]}
                    onChange={(e) =>
                      setDims((v) => ({ ...v, [key]: e.target.value.replace(",", ".") }))
                    }
                  />
                  {fieldError(error)}
                </label>
              ))}
            </div>
            <Hint>
              {d.kind === "carpet"
                ? "Нэг ширхэгийн хэмжээ. м² үнэтэй бол өргөн, урт хоёулаа; метрийн үнэтэй бол урт заавал. Шаардлагагүй бол хоосон үлдээнэ."
                : "Шаардлагагүй бол хоосон үлдээнэ."}
            </Hint>

            {d.kind === "carpet" ? (
              <>
                <label className="block text-sm font-medium">
                  Ангилал (цуглуулга)
                  <select
                    className={`${inputClass} mt-2`}
                    value={d.sectionId}
                    onChange={(e) => patch({ sectionId: e.target.value })}
                  >
                    <option value="">Сонгохгүй</option>
                    {c.sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  {field("oldPrice", `Хуучин үнэ (₮/${unitLabel}, заавал биш)`, "number")}
                  {field("thickness", "Зузаан")}
                  {field("material", "Материал")}
                  {field("origin", "Гарал")}
                  {field("style", "Загвар")}
                </div>
                {lines("rooms", "Тохирох өрөөнүүд (мөр бүрд нэг)")}
              </>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    {field("stock", `Нийт үлдэгдэл (${unitLabel})`, "number", true)}
                    <Hint>
                      Салбар бүрийн үлдэгдлийг «Үлдэгдэл» хуудаснаас засна. Энд өөрчилсөн зөрүү
                      Агуулахад бүртгэгдэнэ.
                    </Hint>
                  </div>
                  {field("sku", "Барааны код")}
                  {field("packageSize", "Савлагаа (заавал биш)")}
                  {field("coverage", "Хамрах талбай (м², заавал биш)", "number")}
                </div>
                <label className="block text-sm font-medium">
                  Цавууны төрөл
                  <select
                    className={`${inputClass} mt-2`}
                    value={d.glueType ?? ""}
                    onChange={(e) => patch({ glueType: e.target.value as GlueProduct["glueType"] })}
                  >
                    <option value="">Хамааралгүй (цавуу биш)</option>
                    <option value="permanent">Байнгын наалттай</option>
                    <option value="removable">Салгаж болдог</option>
                  </select>
                </label>
                {lines("usage", "Хэрэглэх заавар (мөр бүрд нэг)")}
                {lines("surfaces", "Тохирох гадаргуу (мөр бүрд нэг)")}
                <ImageField value={d.image || ""} onChange={(image) => patch({ image })} />
              </>
            )}
          </div>
        </Panel>
        <div className="space-y-6">
          <Panel>
            <h2 className="mb-5 text-lg font-bold">Нийтлэх тохиргоо</h2>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={d.active !== false}
                onChange={(e) => patch({ active: e.target.checked })}
              />
              Вэб дээр харуулах
            </label>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium">
                Тэмдэглэгээ
                <select
                  className={`${inputClass} mt-2`}
                  value={d.badge || ""}
                  onChange={(e) => patch({ badge: e.target.value as NonNullable<Draft["badge"]> })}
                >
                  <option value="">Байхгүй</option>
                  <option>Онцлох</option>
                  <option>Шинээр ирсэн</option>
                </select>
              </label>
              {field("popularity", "Онцлох эрэмбэ (их тоо эхэнд)", "number")}
            </div>
          </Panel>
          <Panel>
            <ImageList value={d.gallery || []} onChange={(gallery) => patch({ gallery })} />
          </Panel>
        </div>
      </div>
      {d.kind === "carpet" && (
        <Panel className="mt-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold">Өнгөний хувилбарууд ({d.variants.length})</h2>
            <Btn
              type="button"
              variant="secondary"
              onClick={() =>
                patch({
                  variants: [
                    ...d.variants,
                    {
                      id: crypto.randomUUID(),
                      name: "",
                      hex: "#d8c3a5",
                      code: "",
                      image: "/media/tile-beige.jpg",
                      stock: 0,
                    },
                  ],
                })
              }
            >
              + Өнгө нэмэх
            </Btn>
          </div>
          {!d.variants.length && (
            <p
              className={`text-sm ${errors["variants"] ? "text-destructive" : "text-muted-foreground"}`}
            >
              {errors["variants"] ??
                "Худалдан авах боломжтой болгохын тулд дор хаяж нэг өнгө нэмнэ үү."}
            </p>
          )}
          {d.variants.length > 0 && (
            <Hint>
              «Нийт үлдэгдэл» нь бүх салбарын нийлбэр. Салбар бүрээр засахдаа «Үлдэгдэл» хуудсыг
              ашиглана; энд өөрчилсөн зөрүү Агуулахад бүртгэгдэнэ.
            </Hint>
          )}
          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            {d.variants.map((variant, i) => (
              <div
                key={variant.id}
                className="space-y-4 rounded-lg border border-border bg-background p-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Өнгө {i + 1}</h3>
                  <button
                    type="button"
                    className="text-sm text-destructive"
                    onClick={() => patch({ variants: d.variants.filter((_, j) => i !== j) })}
                  >
                    Хасах
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ["name", "Өнгөний нэр", "text"],
                      ["hex", "Өнгөний HEX", "color"],
                      ["code", "Барааны код", "text"],
                      ["stock", "Нийт үлдэгдэл (ширхэг)", "number"],
                      ["price", `Тусдаа үнэ (₮/${unitLabel}, заавал биш)`, "number"],
                      ["thickness", "Тусдаа зузаан", "text"],
                    ] as const
                  ).map(([key, label, type]) => (
                    <label className="block text-sm" key={key}>
                      {label}
                      <input
                        required={key === "name" || key === "stock"}
                        type={type}
                        min={0}
                        step={type === "number" ? 1 : undefined}
                        aria-invalid={!!errors[`variant.${i}.${key}`]}
                        className={`${inputClass} mt-2`}
                        value={variant[key] ?? ""}
                        onChange={(e) =>
                          changeVariant(i, {
                            [key]:
                              type === "number"
                                ? e.target.value === "" && key === "price"
                                  ? undefined
                                  : Number(e.target.value)
                                : e.target.value,
                          })
                        }
                      />
                      {fieldError(`variant.${i}.${key}`)}
                    </label>
                  ))}
                </div>
                <ImageField
                  value={variant.image}
                  onChange={(image) => changeVariant(i, { image })}
                />
                <ImageList
                  label="Энэ өнгөний нэмэлт зургууд"
                  value={variant.gallery || []}
                  onChange={(gallery) => changeVariant(i, { gallery })}
                />
              </div>
            ))}
          </div>
        </Panel>
      )}
      <div className="mt-6 flex justify-end">
        <Btn disabled={busy} type="submit">
          {busy ? "Хадгалж байна…" : "Өөрчлөлтийг хадгалах"}
        </Btn>
      </div>
    </form>
  );
}
function Hint({ children }: { children: ReactNode }) {
  return <p className="-mt-1 text-xs leading-relaxed text-muted-foreground">{children}</p>;
}
