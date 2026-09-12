import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, json } from "@/lib/api";
import { useSettings, type SiteSettings } from "@/lib/settings";
import { Btn } from "@/components/ui-kit";
import {
  PageTitle,
  Panel,
  Loading,
  DataError,
  useAction,
  inputClass,
} from "@/components/admin/shared";
import { ImageField } from "@/components/admin/image-field";
export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });
const labels: Record<string, string> = {
  brandName: "Брэндийн нэр",
  footerDescription: "Footer тайлбар",
  copyright: "Байгууллагын нэр",
  phone: "Утас",
  email: "Имэйл",
  address: "Хаяг",
  hours: "Ажиллах цаг",
  logo: "Лого",
  announcement: "Мэдэгдэл (хоосон бол харагдахгүй)",
  heroEyebrow: "Нүүр зургийн дээрх жижиг гарчиг",
  heroTitle: "Нүүр хуудасны гол гарчиг",
  heroDescription: "Гол тайлбар",
  heroImage: "Нүүрийн зураг",
  heroButton: "Бүтээгдэхүүн үзэх товч",
  heroSecondaryButton: "Өрөөндөө үзэх товч",
  categoryTitle: "Бүтээгдэхүүний төрлийн гарчиг",
  carpetImage: "Хивсний ангиллын зураг",
  glueImage: "Цавууны ангиллын зураг",
  carpetLabel: "Хивсний төрлийн нэр",
  glueLabel: "Цавууны төрлийн нэр",
  collectionsTitle: "Цуглуулгын гарчиг",
  featuredTitle: "Онцлох хэсгийн гарчиг",
  previewEyebrow: "Өрөөний хэсгийн жижиг гарчиг",
  previewTitle: "Өрөөний хэсгийн гарчиг",
  previewDescription: "Өрөөний хэсгийн тайлбар",
  previewButton: "Өрөөний хэсгийн товч",
  previewImage: "Өрөөний хэсгийн зураг",
  installationTitle: "Суурилуулалтын гарчиг",
  installationBody: "Суурилуулалтын тайлбар",
  installationNote: "Үнийн тайлбар",
  installationSeparateTitle: "Тусдаа үйлчилгээний гарчиг",
  installationDisclaimer: "Нийт төлбөрийн тайлбар",
  installationMin: "Суурилуулалтын доод үнэ (₮/м²)",
  installationMax: "Суурилуулалтын дээд үнэ (₮/м²)",
  deliveryPrice: "Хүргэлтийн төлбөр (₮)",
  showCollections: "Цуглуулгуудыг харуулах",
  showFeatured: "Онцлох бүтээгдэхүүнийг харуулах",
  showPreview: "Өрөөндөө үзэх хэсгийг харуулах",
  showInstallation: "Суурилуулалтын хэсгийг харуулах",
  bankName: "Банкны нэр",
  bankAccount: "Данс / IBAN",
  bankOwner: "Данс эзэмшигч",
};
const groups: [string, (keyof SiteSettings)[]][] = [
  [
    "Байгууллага, холбоо барих",
    [
      "brandName",
      "logo",
      "phone",
      "email",
      "address",
      "hours",
      "footerDescription",
      "copyright",
      "announcement",
    ],
  ],
  [
    "Нүүр хуудас",
    [
      "heroEyebrow",
      "heroTitle",
      "heroDescription",
      "heroImage",
      "heroButton",
      "heroSecondaryButton",
      "categoryTitle",
      "carpetLabel",
      "carpetImage",
      "glueLabel",
      "glueImage",
      "collectionsTitle",
      "featuredTitle",
    ],
  ],
  [
    "Өрөөндөө үзэх хэсэг",
    ["previewEyebrow", "previewTitle", "previewDescription", "previewButton", "previewImage"],
  ],
  [
    "Суурилуулалт, хүргэлт",
    [
      "installationTitle",
      "installationBody",
      "installationNote",
      "installationSeparateTitle",
      "installationDisclaimer",
      "installationMin",
      "installationMax",
      "deliveryPrice",
    ],
  ],
  ["Хэсгүүдийг харуулах", ["showCollections", "showFeatured", "showPreview", "showInstallation"]],
  ["Банкны шилжүүлэг", ["bankName", "bankAccount", "bankOwner"]],
];
function SettingsPage() {
  const q = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<{ settings: SiteSettings }>("/settings"),
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <DataError error={q.error.message} retry={q.refetch} />;
  return <Editor initial={q.data!.settings} />;
}
function Editor({ initial }: { initial: SiteSettings }) {
  const [draft, setDraft] = useState(initial);
  const { refresh } = useSettings();
  const { busy, run } = useAction();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          const r = await api<{ settings: SiteSettings }>("/admin/settings", json("PUT", draft));
          setDraft(r.settings);
          await refresh();
        });
      }}
    >
      <PageTitle
        title="Вэбийн тохиргоо"
        description="Энд хадгалсан өөрчлөлт үндсэн вэб дээр харагдана."
        action={
          <Btn disabled={busy} type="submit">
            {busy ? "Хадгалж байна…" : "Хадгалах"}
          </Btn>
        }
      />
      <div className="grid gap-6 xl:grid-cols-2">
        {groups.map(([title, keys]) => (
          <Panel key={title}>
            <h2 className="mb-5 text-lg font-bold">{title}</h2>
            <div className="space-y-4">
              {keys.map((key) => {
                const value = draft[key];
                const label = labels[key] || key;
                const set = (v: string | number | boolean) => setDraft((d) => ({ ...d, [key]: v }));
                if (typeof value === "boolean")
                  return (
                    <label key={key} className="flex items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="h-5 w-5"
                        checked={value}
                        onChange={(e) => set(e.target.checked)}
                      />
                      {label}
                    </label>
                  );
                if (key.toLowerCase().includes("image") || key === "logo")
                  return (
                    <ImageField key={key} label={label} value={String(value)} onChange={set} />
                  );
                const multiline = /title|description|body|note|disclaimer/i.test(key);
                return (
                  <label key={key} className="block text-sm font-medium">
                    {label}
                    {multiline ? (
                      <textarea
                        className={`${inputClass} mt-2 min-h-24 py-3`}
                        value={String(value)}
                        onChange={(e) => set(e.target.value)}
                      />
                    ) : (
                      <input
                        className={`${inputClass} mt-2`}
                        type={typeof value === "number" ? "number" : "text"}
                        min={0}
                        value={value}
                        onChange={(e) =>
                          set(typeof value === "number" ? Number(e.target.value) : e.target.value)
                        }
                      />
                    )}
                  </label>
                );
              })}
            </div>
          </Panel>
        ))}
      </div>
      <div className="mt-6 text-right">
        <Btn type="submit" disabled={busy}>
          Өөрчлөлтийг хадгалах
        </Btn>
      </div>
    </form>
  );
}
