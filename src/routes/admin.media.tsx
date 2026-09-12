import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, uploadImage } from "@/lib/api";
import type { MediaItem } from "@/components/admin/image-field";
import {
  PageTitle,
  Panel,
  Loading,
  DataError,
  Empty,
  ConfirmButton,
  useAction,
} from "@/components/admin/shared";
export const Route = createFileRoute("/admin/media")({ component: Media });
function Media() {
  const { busy, run } = useAction();
  const q = useQuery({
    queryKey: ["admin", "media"],
    queryFn: () => api<{ media: MediaItem[] }>("/admin/media"),
  });
  return (
    <>
      <PageTitle
        title="Зургийн сан"
        description="JPG, PNG, WEBP, GIF · Нэг зураг хамгийн ихдээ 5MB."
        action={
          <label className="cursor-pointer rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground">
            {busy ? "Зураг оруулж байна…" : "+ Зураг оруулах"}
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              disabled={busy}
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                await run(async () => {
                  for (const f of files) await uploadImage(f);
                  await q.refetch();
                });
                e.target.value = "";
              }}
            />
          </label>
        }
      />
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <DataError error={q.error.message} retry={q.refetch} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {q.data?.media.map((m) => (
            <Panel key={m._id} className="!p-3">
              <img
                src={m.url}
                alt={m.name}
                className="aspect-square w-full rounded-lg bg-surface object-contain"
              />
              <p className="mt-3 truncate text-sm font-semibold">{m.name}</p>
              <p className="text-xs text-muted-foreground">{Math.ceil(m.size / 1024)} KB</p>
              <div className="mt-3 flex items-center justify-between">
                <button
                  className="text-sm text-accent"
                  onClick={() =>
                    run(() => navigator.clipboard.writeText(m.url), "Зургийн холбоос хууллаа")
                  }
                >
                  Холбоос хуулах
                </button>
                <ConfirmButton
                  onConfirm={async () => {
                    await api(`/admin/media/${m._id}`, { method: "DELETE" });
                    await q.refetch();
                  }}
                />
              </div>
            </Panel>
          ))}
        </div>
      )}
      {q.data?.media.length === 0 && (
        <Panel>
          <Empty>Бүтээгдэхүүн болон контентод ашиглах зургаа оруулна уу.</Empty>
        </Panel>
      )}
    </>
  );
}
