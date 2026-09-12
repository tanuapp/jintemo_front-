import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronUp, ChevronDown, Pencil } from "lucide-react";
import { useCatalog } from "@/lib/catalog-store";
import { mnt } from "@/lib/format";
import { Btn } from "@/components/ui-kit";
import {
  PageTitle,
  Panel,
  Loading,
  DataError,
  ConfirmButton,
  useAction,
  inputClass,
  Empty,
} from "@/components/admin/shared";
export const Route = createFileRoute("/admin/catalog")({ component: Catalog });
function Catalog() {
  const c = useCatalog();
  const { busy, run } = useAction();
  const [name, setName] = useState("");
  const [edit, setEdit] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [search, setSearch] = useState("");
  if (c.error) return <DataError error={c.error} retry={c.refresh} />;
  if (!c.ready) return <Loading />;
  const all = c.catalog.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <>
      <PageTitle
        title="Бүтээгдэхүүн"
        description="Хивс, цавуу, ангилал болон өнгөний үлдэгдлийг удирдана."
        action={
          <Link
            to="/admin/products/new"
            className="rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground"
          >
            + Бүтээгдэхүүн нэмэх
          </Link>
        }
      />
      <Panel className="mb-6">
        <h2 className="mb-4 text-lg font-bold">Хивсний ангиллууд</h2>
        <div className="flex flex-wrap gap-2">
          {c.sections.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1 rounded-lg border border-border p-2">
              {edit === s.id ? (
                <>
                  <input
                    aria-label="Ангиллын шинэ нэр"
                    className={`${inputClass} max-w-44`}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                  <Btn
                    disabled={busy}
                    onClick={async () => {
                      if (await run(() => c.renameSection(s.id, editName))) setEdit(null);
                    }}
                  >
                    Хадгалах
                  </Btn>
                  <button onClick={() => setEdit(null)}>Болих</button>
                </>
              ) : (
                <>
                  <span className="px-2 text-sm font-medium">{s.name}</span>
                  <button
                    aria-label="Ангилал засах"
                    onClick={() => {
                      setEdit(s.id);
                      setEditName(s.name);
                    }}
                    className="p-2"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    aria-label="Дээш"
                    disabled={busy || i === 0}
                    onClick={() => run(() => c.moveSection(s.id, "up"), "")}
                    className="p-1 disabled:opacity-30"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    aria-label="Доош"
                    disabled={busy || i === c.sections.length - 1}
                    onClick={() => run(() => c.moveSection(s.id, "down"), "")}
                    className="p-1 disabled:opacity-30"
                  >
                    <ChevronDown size={16} />
                  </button>
                  <ConfirmButton
                    title={`${s.name} ангиллыг устгах уу?`}
                    onConfirm={() => c.deleteSection(s.id)}
                  />
                </>
              )}
            </div>
          ))}
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => c.addSection(name))) setName("");
          }}
          className="mt-4 flex max-w-lg gap-2"
        >
          <input
            aria-label="Шинэ ангиллын нэр"
            required
            className={inputClass}
            placeholder="Шинэ ангиллын нэр"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Btn type="submit" disabled={busy}>
            Нэмэх
          </Btn>
        </form>
      </Panel>
      <Panel>
        <input
          aria-label="Бүтээгдэхүүн хайх"
          className={`${inputClass} mb-5 max-w-sm`}
          placeholder="Бүтээгдэхүүн хайх…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="pb-3">Бүтээгдэхүүн</th>
                <th>Төрөл</th>
                <th>Үнэ</th>
                <th>Үлдэгдэл</th>
                <th>Төлөв</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {all.map((p) => (
                <tr key={p.slug} className="border-t border-border">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      {(p.kind === "glue" ? p.image : p.variants[0]?.image) && (
                        <img
                          src={p.kind === "glue" ? p.image : p.variants[0]?.image}
                          alt=""
                          className="h-12 w-12 rounded bg-surface object-cover"
                        />
                      )}
                      <div>
                        <p className="font-semibold">{p.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {p.kind === "carpet"
                            ? c.sections.find((s) => s.id === p.sectionId)?.name
                            : p.packageSize}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>{p.kind === "carpet" ? "Хивс" : "Цавуу"}</td>
                  <td>{mnt(p.kind === "carpet" ? p.basePrice : p.price)}</td>
                  <td>
                    {p.kind === "carpet"
                      ? p.variants.reduce((s, v) => s + v.stock, 0)
                      : (p.stock ?? 0)}
                  </td>
                  <td>
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${p.active === false ? "bg-muted" : "bg-success/10 text-success"}`}
                    >
                      {p.active === false ? "Нуусан" : "Нийтэлсэн"}
                    </span>
                  </td>
                  <td className="text-right">
                    <Link
                      to="/admin/products/$slug"
                      params={{ slug: p.slug }}
                      className="px-2 py-2 font-medium text-accent"
                    >
                      Засах
                    </Link>
                    <ConfirmButton
                      title={`${p.name} устгах уу?`}
                      onConfirm={() => c.deleteProduct(p.slug)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!all.length && <Empty />}
      </Panel>
    </>
  );
}
