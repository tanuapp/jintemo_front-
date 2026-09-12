import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, json } from "@/lib/api";
import { useSettings, type ContentItem } from "@/lib/settings";
import { Btn } from "@/components/ui-kit";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  PageTitle,
  Panel,
  Loading,
  DataError,
  Empty,
  ConfirmButton,
  useAction,
  inputClass,
} from "@/components/admin/shared";
import { ImageField } from "@/components/admin/image-field";
export const Route = createFileRoute("/admin/content")({ component: Content });
const types = {
  banners: "Баннер",
  news: "Мэдээ",
  pages: "Мэдээллийн хуудас",
  faqs: "Түгээмэл асуулт",
};
type Draft = Omit<ContentItem, "_id"> & { _id?: string };
function Content() {
  const { refresh } = useSettings();
  const qc = useQueryClient();
  const { busy, run } = useAction();
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const q = useQuery({
    queryKey: ["admin", "content"],
    queryFn: () => api<{ content: ContentItem[] }>("/admin/content"),
  });
  const reload = async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: ["admin", "content"] }), refresh()]);
  };
  const open = () =>
    setDraft({
      type: (filter || "banners") as Draft["type"],
      title: "",
      subtitle: "",
      body: "",
      image: "",
      link: "",
      order: 0,
      active: true,
    });
  return (
    <>
      <PageTitle
        title="Контент"
        description="Баннер, мэдээ, мэдээллийн хуудас болон түгээмэл асуултууд."
        action={<Btn onClick={open}>+ Контент нэмэх</Btn>}
      />
      <Panel>
        <select
          aria-label="Контентын төрөл"
          className={`${inputClass} mb-5 max-w-xs`}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Бүх төрөл</option>
          {Object.entries(types).map(([k, n]) => (
            <option key={k} value={k}>
              {n}
            </option>
          ))}
        </select>
        {q.isLoading ? (
          <Loading />
        ) : q.error ? (
          <DataError error={q.error.message} retry={q.refetch} />
        ) : (
          <div className="divide-y divide-border">
            {q.data?.content
              .filter((c) => !filter || c.type === filter)
              .map((c) => (
                <div key={c._id} className="flex flex-wrap items-center gap-4 py-4">
                  {c.image && (
                    <img src={c.image} alt="" className="h-16 w-24 rounded-md object-cover" />
                  )}
                  <div className="min-w-40 flex-1">
                    <p className="font-semibold">{c.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {types[c.type]} · {c.active ? "Нийтэлсэн" : "Нуусан"} · Эрэмбэ {c.order}
                    </p>
                  </div>
                  <button className="text-sm text-accent" onClick={() => setDraft(c)}>
                    Засах
                  </button>
                  <ConfirmButton
                    title={`${c.title} устгах уу?`}
                    onConfirm={async () => {
                      await api(`/admin/content/${c._id}`, { method: "DELETE" });
                      await reload();
                    }}
                  />
                </div>
              ))}
            {!q.data?.content.length && <Empty>Контент нэмсний дараа вэб дээр харагдана.</Empty>}
          </div>
        )}
      </Panel>
      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft?._id ? "Контент засах" : "Контент нэмэх"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await run(async () => {
                    await api(
                      draft._id ? `/admin/content/${draft._id}` : "/admin/content",
                      json(draft._id ? "PUT" : "POST", draft),
                    );
                    await reload();
                  })
                )
                  setDraft(null);
              }}
            >
              <label className="block text-sm">
                Төрөл
                <select
                  className={`${inputClass} mt-2`}
                  value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value as Draft["type"] })}
                >
                  {Object.entries(types).map(([k, n]) => (
                    <option key={k} value={k}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              {(["title", "subtitle", "link"] as const).map((key) => (
                <label key={key} className="block text-sm">
                  {{ title: "Гарчиг", subtitle: "Товч тайлбар", link: "Холбоос (заавал биш)" }[key]}
                  <input
                    required={key === "title"}
                    className={`${inputClass} mt-2`}
                    value={draft[key]}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  />
                </label>
              ))}
              <label className="block text-sm">
                Агуулга
                <textarea
                  className={`${inputClass} mt-2 min-h-40 py-3`}
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                />
              </label>
              <ImageField value={draft.image} onChange={(image) => setDraft({ ...draft, image })} />
              <label className="block text-sm">
                Эрэмбэ
                <input
                  type="number"
                  min={0}
                  className={`${inputClass} mt-2`}
                  value={draft.order}
                  onChange={(e) => setDraft({ ...draft, order: Number(e.target.value) })}
                />
              </label>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                />
                Нийтлэх
              </label>
              <Btn type="submit" disabled={busy}>
                Хадгалах
              </Btn>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
