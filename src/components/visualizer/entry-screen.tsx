import { ArrowLeft, Camera, ImageUp, Loader2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Room = { id: string; name: string; image: string };

/**
 * The first screen: bring your own room photo, or start from a sample room.
 * Phones get "take a photo" and "choose from library"; computers get drag & drop and a QR
 * code that opens the same page on the phone.
 */
export function EntryScreen({
  brand,
  logo,
  rooms,
  productName,
  busy,
  onBack,
  onFile,
  onRoom,
  onWarm,
}: {
  brand: string;
  logo: string;
  rooms: Room[];
  productName: string | null;
  busy: boolean;
  onBack: () => void;
  onFile: (file: File) => void;
  onRoom: (id: string) => void;
  onWarm: () => void;
}) {
  const libraryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const pick = (input: HTMLInputElement | null) => {
    onWarm();
    input?.click();
  };
  const take = (files: FileList | null) => {
    const f = files?.[0];
    if (f) onFile(f);
  };
  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto w-full max-w-[1320px] px-5 pb-12 pt-6 sm:px-8 lg:px-12 lg:pt-10">
        <header className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Буцах"
            onClick={onBack}
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-secondary"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-md bg-white">
            <img src={logo} alt="" className="h-full w-full object-contain" />
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight">{brand}</span>
        </header>

        {productName && (
          <p className="mt-6 inline-flex rounded-full bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent">
            Сонгосон хивс: {productName}
          </p>
        )}

        <div className="mt-6 grid gap-10 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12">
          <section>
            <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight sm:text-[32px]">
              Хивсээ <span className="text-accent">өөрийн өрөөндөө</span> үзээрэй
            </h1>
            <div className="mt-6 rounded-2xl bg-surface p-4 sm:p-6">
              {/* Phones */}
              <div className="space-y-3 lg:hidden">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => pick(cameraRef.current)}
                  className="flex h-44 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-foreground/20 bg-card text-lg font-semibold"
                >
                  <Camera className="h-12 w-12" strokeWidth={1.6} />
                  Зураг авах
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => pick(libraryRef.current)}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-base font-semibold text-primary-foreground"
                >
                  <Upload className="h-5 w-5" /> Цомгоос сонгох
                </button>
              </div>
              {/* Computers */}
              <div className="hidden space-y-5 lg:block">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => pick(libraryRef.current)}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    onWarm();
                    setDragOver(true);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    take(e.dataTransfer.files);
                  }}
                  className={cn(
                    "flex h-[272px] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-card transition-colors",
                    dragOver
                      ? "border-accent bg-accent/5"
                      : "border-foreground/20 hover:border-foreground/40",
                  )}
                >
                  {busy ? (
                    <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
                  ) : (
                    <ImageUp className="h-16 w-16" strokeWidth={1.4} />
                  )}
                  <span className="mt-3 text-lg font-semibold">Зургаа чирж оруулна уу</span>
                  <span className="text-sm text-muted-foreground">
                    эсвэл <span className="underline underline-offset-2">зураг сонгох</span> · JPG,
                    PNG, WEBP
                  </span>
                </button>
                <QrCard />
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                Шалаа бүхэлд нь харуулсан, гэгээтэй зураг хамгийн сайн таниглагдана. Зураг таны
                төхөөрөмж дээр боловсруулагдах ба сервер рүү илгээгдэхгүй.
              </p>
            </div>
          </section>

          <section>
            <h2 className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-muted-foreground sm:text-[32px]">
              эсвэл жишээ өрөөнөөс эхлэх
            </h2>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:gap-5">
              {rooms.map((room, i) => (
                <button
                  key={room.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onRoom(room.id)}
                  className={cn("group text-left", i === 0 && "row-span-2")}
                >
                  <span
                    className={cn(
                      "block overflow-hidden rounded-xl bg-surface",
                      i === 0 ? "aspect-[4/5]" : "aspect-[4/3]",
                    )}
                  >
                    <img
                      src={room.image}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  </span>
                  <span className="mt-2 block text-sm font-semibold text-muted-foreground group-hover:text-foreground">
                    {room.name}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
      <input
        ref={libraryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** A small QR library from the CDN, loaded only on computers that show the card. */
const QR_LIBRARY = "https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm";

/** Opens this page on a phone, to photograph the room there. */
function QrCard() {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    import(/* @vite-ignore */ QR_LIBRARY)
      .then((m: { toDataURL: (t: string, o: object) => Promise<string> }) =>
        m.toDataURL(window.location.href, { margin: 1, width: 220, color: { dark: "#2b2622" } }),
      )
      .then((url) => live && setSrc(url))
      .catch(() => live && setSrc(null));
    return () => {
      live = false;
    };
  }, []);
  if (!src) return null;
  return (
    <div className="flex h-[240px] flex-col items-center justify-center rounded-xl bg-card">
      <img src={src} alt="Утсаараа нээх QR код" className="h-[120px] w-[120px]" />
      <p className="mt-3 text-lg font-semibold">Утаснаасаа зураг оруулах</p>
      <p className="text-sm text-muted-foreground">Камераар уншуулж нээнэ үү</p>
    </div>
  );
}
