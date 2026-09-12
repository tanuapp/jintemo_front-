import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Plus, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, Btn, EmptyState, Field, TextInput } from "@/components/ui-kit";
import { errorMessage } from "@/lib/api";
import { ConfirmButton } from "@/components/admin/shared";
import { useAuth } from "@/lib/auth";
import { useUi } from "@/lib/ui-store";

export const Route = createFileRoute("/profile/addresses")({
  head: () => ({
    meta: [{ title: "Хаягууд | JINTEMO" }],
  }),
  component: AddressesPage,
});

const districts = ["Баянзүрх", "Сүхбаатар", "Чингэлтэй", "Хан-Уул", "Баянгол", "Сонгинохайрхан"];

function AddressesPage() {
  const { user, ready, addAddress, removeAddress, setDefaultAddress } = useAuth();
  const { openProfile } = useUi();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("Гэр");
  const [district, setDistrict] = useState(districts[0]!);
  const [khoroo, setKhoroo] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");

  if (!ready) return null;

  if (!user) {
    return (
      <div className="container-page py-20">
        <EmptyState
          icon={UserRound}
          title="Та нэвтрээгүй байна"
          description="Хаягуудаа удирдахын тулд эхлээд нэвтэрнэ үү."
          action={<Btn onClick={openProfile}>Нэвтрэх</Btn>}
        />
      </div>
    );
  }

  const reset = () => {
    setLabel("Гэр");
    setDistrict(districts[0]!);
    setKhoroo("");
    setAddress("");
    setNote("");
    setAdding(false);
  };

  return (
    <div className="container-page max-w-2xl py-8 pb-16">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Хаягууд</h1>
        {!adding && (
          <Btn variant="secondary" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Шинэ хаяг
          </Btn>
        )}
      </div>

      {adding && (
        <div className="mt-6 space-y-3 rounded-lg border border-border bg-card p-5">
          <Field label="Нэршил">
            <TextInput
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Гэр, Ажил г.м"
            />
          </Field>
          <Field label="Дүүрэг">
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="h-12 w-full rounded-md border border-input bg-card px-3 text-base"
            >
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Хороо">
            <TextInput
              value={khoroo}
              onChange={(e) => setKhoroo(e.target.value)}
              placeholder="1-р хороо"
            />
          </Field>
          <Field label="Дэлгэрэнгүй хаяг">
            <TextInput
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Байр, орц, тоот"
            />
          </Field>
          <Field label="Тэмдэглэл (заавал биш)">
            <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Btn
              onClick={async () => {
                if (!khoroo.trim() || !address.trim()) {
                  toast.error("Хороо болон хаягаа бүрэн бөглөнө үү.");
                  return;
                }
                try {
                  await addAddress({ label, district, khoroo, address, note });
                  toast.success("Хаяг нэмэгдлээ");
                  reset();
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            >
              Хадгалах
            </Btn>
            <Btn variant="secondary" onClick={reset}>
              Цуцлах
            </Btn>
          </div>
        </div>
      )}

      {user.addresses.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={MapPin}
            title="Хаяг бүртгэгдээгүй байна"
            description="Хүргэлтэд ашиглах хаягаа нэмнэ үү."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {user.addresses.map((a) => (
            <div key={a.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{a.label}</p>
                    {a.isDefault && <Badge tone="success">Үндсэн</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {a.district}, {a.khoroo}, {a.address}
                  </p>
                  {a.note && <p className="text-sm text-muted-foreground">{a.note}</p>}
                </div>
                <button
                  aria-label="Устгах"
                  onClick={() => removeAddress(a.id).catch((e) => toast.error(errorMessage(e)))}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {!a.isDefault && (
                <Btn
                  variant="secondary"
                  className="mt-3"
                  onClick={() => setDefaultAddress(a.id).catch((e) => toast.error(errorMessage(e)))}
                >
                  Үндсэн болгох
                </Btn>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
