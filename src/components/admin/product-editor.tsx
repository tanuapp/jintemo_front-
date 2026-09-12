import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { api, json } from "@/lib/api";
import { useCatalog } from "@/lib/catalog-store";
import type { Product, GlueProduct, ColorVariant } from "@/lib/products";
import { Btn } from "@/components/ui-kit";
import { PageTitle, Panel, Loading, DataError, useAction, inputClass } from "./shared";
import { ImageField, ImageList } from "./image-field";
type Draft = Partial<Product & GlueProduct> & {
  kind: "carpet" | "glue";
  name: string;
  variants: ColorVariant[];
};
export function ProductEditorPage({
  slug,
  section,
  kind,
}: {
  slug?: string | undefined;
  section?: string | undefined;
  kind?: "carpet" | "glue";
}) {
  const c = useCatalog();
  if (c.error) return <DataError error={c.error} retry={c.refresh} />;
  if (!c.ready) return <Loading />;
  const original = slug ? c.catalog.find((p) => p.slug === slug) : undefined;
  if (slug && !original) return <DataError error="Бүтээгдэхүүн олдсонгүй." />;
  return (
    <Editor
      key={slug || "new"}
      initial={
        original
          ? { ...original, variants: original.kind === "carpet" ? original.variants : [] }
          : {
              kind: kind || "carpet",
              name: "",
              short: "",
              description: "",
              sectionId: section || c.sections[0]?.id || "",
              tileSize: 0.5,
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
              glueType: "permanent",
              price: 0,
              stock: 0,
              coverage: 10,
              packageSize: "3.5 кг сав",
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
  const { busy, run } = useAction();
  const c = useCatalog();
  const navigate = useNavigate();
  const patch = (p: Partial<Draft>) => setD((d) => ({ ...d, ...p }));
  const field = (key: keyof Draft, label: string, type = "text", required = false) => (
    <label key={key} className="block text-sm font-medium">
      {label}
      <input
        className={`${inputClass} mt-2`}
        required={required}
        type={type}
        min={type === "number" ? 0 : undefined}
        step={key === "tileSize" || key === "coverage" ? "0.01" : type === "number" ? 1 : undefined}
        value={String(d[key] ?? "")}
        onChange={(e) =>
          patch({ [key]: type === "number" ? Number(e.target.value) : e.target.value })
        }
      />
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
  const save = async () => {
    await run(async () => {
      const body = {
        ...d,
        rooms: d.rooms?.filter(Boolean),
        usage: d.usage?.filter(Boolean),
        surfaces: d.surfaces?.filter(Boolean),
        gallery: d.gallery?.filter(Boolean),
        oldPrice: d.oldPrice || null,
        expectedUpdatedAt: d.updatedAt,
      };
      const result = await api<{ product: Product & GlueProduct & { kind: "carpet" | "glue" } }>(
        existing ? `/admin/products/${encodeURIComponent(d.slug!)}` : "/admin/products",
        json(existing ? "PATCH" : "POST", body),
      );
      setD({ ...result.product, variants: result.product.variants || [] });
      await c.refresh();
      if (!existing)
        await navigate({ to: "/admin/products/$slug", params: { slug: result.product.slug } });
    });
  };
  return (
    <form
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
            {!existing && (
              <label className="block text-sm font-medium">
                Бүтээгдэхүүний төрөл
                <select
                  className={`${inputClass} mt-2`}
                  value={d.kind}
                  onChange={(e) => patch({ kind: e.target.value as Draft["kind"] })}
                >
                  <option value="carpet">Хивс</option>
                  <option value="glue">Цавуу</option>
                </select>
              </label>
            )}
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
            {d.kind === "carpet" ? (
              <>
                <label className="block text-sm font-medium">
                  Ангилал
                  <select
                    className={`${inputClass} mt-2`}
                    value={d.sectionId}
                    onChange={(e) => patch({ sectionId: e.target.value })}
                    required
                  >
                    <option value="">Сонгох</option>
                    {c.sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  {field("basePrice", "Суурь үнэ (₮/ширхэг)", "number", true)}
                  {field("oldPrice", "Хуучин үнэ (заавал биш)", "number")}
                  {field("tileSize", "Хавтангийн талын урт (метр)", "number", true)}
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
                  {field("price", "Үнэ (₮)", "number", true)}
                  {field("stock", "Үлдэгдэл (ширхэг)", "number", true)}
                  {field("sku", "Барааны код")}
                  {field("packageSize", "Савлагаа", "text", true)}
                  {field("coverage", "Хамрах талбай (м²)", "number", true)}
                </div>
                <label className="block text-sm font-medium">
                  Цавууны төрөл
                  <select
                    className={`${inputClass} mt-2`}
                    value={d.glueType}
                    onChange={(e) =>
                      patch({ glueType: e.target.value as "permanent" | "removable" })
                    }
                  >
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
            <p className="text-sm text-muted-foreground">
              Худалдан авах боломжтой болгохын тулд дор хаяж нэг өнгө нэмнэ үү.
            </p>
          )}
          <div className="grid gap-5 lg:grid-cols-2">
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
                      ["stock", "Үлдэгдэл (ширхэг)", "number"],
                      ["price", "Тусдаа үнэ (заавал биш)", "number"],
                      ["thickness", "Тусдаа зузаан", "text"],
                    ] as const
                  ).map(([key, label, type]) => (
                    <label className="block text-sm" key={key}>
                      {label}
                      <input
                        required={key === "name" || key === "stock"}
                        type={type}
                        min={0}
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
