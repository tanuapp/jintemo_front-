import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Btn } from "@/components/ui-kit";
import { useCatalog } from "@/lib/catalog-store";
import { KIND_HINTS, KIND_LABELS, type ProductKind, type ProductType } from "@/lib/products";
import { ImageField } from "./image-field";
import { Panel, inputClass, useAction } from "./shared";

/** Same rule as the server: names may not differ only by case or spacing. */
const normalize = (name: string) =>
  name.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

function nameError(types: ProductType[], name: string, id?: string) {
  const key = normalize(name);
  if (!key) return "Төрлийн нэр хоосон байж болохгүй.";
  if (key.length > 80) return "Төрлийн нэр 80 тэмдэгтээс ихгүй байна.";
  if (types.some((t) => t.id !== id && normalize(t.name) === key))
    return "Ийм нэртэй төрөл аль хэдийн байна.";
  return null;
}

export function ProductTypesPanel() {
  const c = useCatalog();
  const { busy, run } = useAction();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ProductKind>("carpet");
  const [addError, setAddError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", image: "" });
  const [editError, setEditError] = useState<string | null>(null);

  const add = async () => {
    const error = nameError(c.types, name);
    setAddError(error);
    if (error) return;
    if (await run(() => c.addType({ name: name.trim(), kind }), "Төрөл нэмэгдлээ")) setName("");
  };
  const save = async (type: ProductType) => {
    const error = nameError(c.types, draft.name, type.id);
    setEditError(error);
    if (error) return;
    if (await run(() => c.updateType(type.id, { name: draft.name.trim(), image: draft.image })))
      setEditing(null);
  };

  return (
    <Panel className="mb-6">
      <div className="mb-4">
        <h2 className="text-lg font-bold">Бүтээгдэхүүний төрөл</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Энд нэмсэн төрөл бүтээгдэхүүний формын сонголт болон вэбийн нүүр хуудсанд шууд харагдана.
          Идэвхгүй төрлийн бараа вэб дээр харагдахгүй.
        </p>
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {c.types.map((type, i) => (
          <li key={type.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-3">
            {editing === type.id ? (
              <div className="w-full space-y-3">
                <label className="block text-sm font-medium">
                  Төрлийн нэр
                  <input
                    className={`${inputClass} mt-2 max-w-md`}
                    value={draft.name}
                    aria-invalid={!!editError}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  />
                </label>
                {editError && <p className="text-sm text-destructive">{editError}</p>}
                <div className="max-w-xl">
                  <ImageField
                    label="Нүүр хуудасны картын зураг"
                    value={draft.image}
                    onChange={(image) => setDraft((d) => ({ ...d, image }))}
                  />
                </div>
                <div className="flex gap-2">
                  <Btn type="button" disabled={busy} onClick={() => void save(type)}>
                    {busy ? "Хадгалж байна…" : "Хадгалах"}
                  </Btn>
                  <Btn type="button" variant="secondary" onClick={() => setEditing(null)}>
                    Болих
                  </Btn>
                </div>
              </div>
            ) : (
              <>
                {type.image ? (
                  <img
                    src={type.image}
                    alt=""
                    className="h-10 w-14 shrink-0 rounded bg-surface object-cover"
                  />
                ) : (
                  <span className="h-10 w-14 shrink-0 rounded bg-surface" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {type.name}
                    {!type.active && (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                        Идэвхгүй
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {KIND_LABELS[type.kind]} · {type.productCount ?? 0} бүтээгдэхүүн
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={type.active}
                    disabled={busy}
                    onChange={(e) =>
                      void run(
                        () => c.updateType(type.id, { active: e.target.checked }),
                        e.target.checked ? "Төрөл идэвхжлээ" : "Төрөл идэвхгүй боллоо",
                      )
                    }
                  />
                  Вэбд харуулах
                </label>
                <div className="flex items-center">
                  <button
                    type="button"
                    aria-label="Дээш"
                    disabled={busy || i === 0}
                    onClick={() => run(() => c.moveType(type.id, "up"), "")}
                    className="p-2 disabled:opacity-30"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="Доош"
                    disabled={busy || i === c.types.length - 1}
                    onClick={() => run(() => c.moveType(type.id, "down"), "")}
                    className="p-2 disabled:opacity-30"
                  >
                    <ChevronDown size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="Төрөл засах"
                    onClick={() => {
                      setEditing(type.id);
                      setEditError(null);
                      setDraft({ name: type.name, image: type.image });
                    }}
                    className="p-2"
                  >
                    <Pencil size={15} />
                  </button>
                  <DeleteTypeButton type={type} />
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
        className="mt-4 grid max-w-3xl gap-2 sm:grid-cols-[1fr_minmax(0,1fr)_auto]"
      >
        <input
          aria-label="Шинэ төрлийн нэр"
          aria-invalid={!!addError}
          className={inputClass}
          placeholder="Шинэ төрөл, жишээ нь: Ам дарагч"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setAddError(null);
          }}
        />
        <select
          aria-label="Барааны бүтэц"
          className={inputClass}
          value={kind}
          onChange={(e) => setKind(e.target.value as ProductKind)}
        >
          {(Object.keys(KIND_LABELS) as ProductKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <Btn type="submit" disabled={busy}>
          Нэмэх
        </Btn>
      </form>
      {addError ? (
        <p className="mt-2 text-sm text-destructive">{addError}</p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">{KIND_HINTS[kind]}</p>
      )}
    </Panel>
  );
}

/**
 * A type with products is never deleted on its own: the admin picks a type of the
 * same structure to move them to, or the dialog explains why it cannot proceed.
 */
function DeleteTypeButton({ type }: { type: ProductType }) {
  const c = useCatalog();
  const [open, setOpen] = useState(false);
  const { busy, run } = useAction();
  const count = type.productCount ?? 0;
  const targets = c.types.filter((t) => t.id !== type.id && t.kind === type.kind);
  const [moveTo, setMoveTo] = useState("");
  const target = targets.find((t) => t.id === moveTo) ?? targets[0];
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/5"
        >
          Устгах
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>«{type.name}» төрлийг устгах уу?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {!count ? (
                <p>Энэ төрөлд бүтээгдэхүүн байхгүй. Устгасныг буцаах боломжгүй.</p>
              ) : targets.length ? (
                <>
                  <p>
                    Энэ төрөлд {count} бүтээгдэхүүн байна. Бүтээгдэхүүнүүдийг алдахгүйн тулд
                    шилжүүлэх төрлөө сонгоно уу.
                  </p>
                  <select
                    aria-label="Шилжүүлэх төрөл"
                    className={`${inputClass} text-foreground`}
                    value={target?.id}
                    onChange={(e) => setMoveTo(e.target.value)}
                  >
                    {targets.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <p className="text-destructive">
                  Энэ төрөлд {count} бүтээгдэхүүн байна. Шилжүүлэх ижил бүтэцтэй өөр төрөл алга.
                  Эхлээд шинэ төрөл нэмэх эсвэл бүтээгдэхүүнүүдийг устгана уу.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Болих</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy || (count > 0 && !target)}
            onClick={async (e) => {
              e.preventDefault();
              if (
                await run(() => c.deleteType(type.id, count ? target?.id : undefined), "Устгалаа")
              )
                setOpen(false);
            }}
          >
            {busy ? "Түр хүлээнэ үү…" : count ? "Шилжүүлээд устгах" : "Устгах"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
