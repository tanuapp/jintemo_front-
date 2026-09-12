import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Images, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api, uploadImage } from "@/lib/api";
import { useAction, inputClass, Loading, DataError } from "./shared";
export type MediaItem = { _id: string; name: string; url: string; size: number };
export function ImageField({
  value,
  onChange,
  label = "Зураг",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const { busy, run } = useAction();
  const q = useQuery({
    queryKey: ["admin", "media"],
    queryFn: () => api<{ media: MediaItem[] }>("/admin/media"),
    enabled: open,
  });
  const seed = [
    "hero-room",
    "room-office",
    "room-sample",
    "detail-install",
    "tile-beige",
    "tile-charcoal",
    "tile-gray",
    "tile-sand",
    "tile-moss",
    "tile-navy",
    "jintemo-logo",
  ].map((name) => ({ _id: name, name, url: `/media/${name}.jpg`, size: 0 }));
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">
        {label}
        <input
          className={`${inputClass} mt-2`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… эсвэл /uploads/…"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        {value && (
          <img
            src={value}
            alt={label}
            className="h-20 w-24 rounded-md border border-border object-cover"
          />
        )}
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
          <Upload size={16} />
          {busy ? "Хуулж байна…" : "Зураг оруулах"}
          <input
            type="file"
            className="sr-only"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file)
                await run(async () => {
                  onChange(await uploadImage(file));
                  await q.refetch();
                }, "Зураг орлоо");
              e.target.value = "";
            }}
          />
        </label>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <Images size={16} />
              Сангаас сонгох
            </button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Зураг сонгох</DialogTitle>
            </DialogHeader>
            {q.isLoading && <Loading />}
            {q.error && <DataError error={q.error.message} retry={q.refetch} />}
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {[...(q.data?.media || []), ...seed].map((m) => (
                <button
                  type="button"
                  key={m._id}
                  className="overflow-hidden rounded-md border border-border text-left"
                  onClick={() => {
                    onChange(m.url);
                    setOpen(false);
                  }}
                >
                  <img src={m.url} alt={m.name} className="aspect-square w-full object-cover" />
                  <span className="block truncate p-2 text-xs">{m.name}</span>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
export function ImageList({
  value,
  onChange,
  label = "Зургийн цомог",
}: {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
}) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{label}</h3>
      {value.map((src, i) => (
        <div key={i} className="rounded-lg border border-border p-3">
          <ImageField
            value={src}
            label={`Зураг ${i + 1}`}
            onChange={(s) => onChange(value.map((v, j) => (i === j ? s : v)))}
          />
          <button
            type="button"
            className="mt-2 text-sm text-destructive"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            Зургийг хасах
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-sm font-medium text-accent"
        onClick={() => onChange([...value, ""])}
      >
        + Зураг нэмэх
      </button>
    </div>
  );
}
