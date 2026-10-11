/**
 * Runs a semantic-segmentation model (SegFormer, ADE20K classes) on a room photo, inside a
 * worker so the page stays responsive. The photo never leaves the device: only the model
 * and its runtime are downloaded, once, from the CDN, and the browser caches them.
 *
 * The library is loaded from the CDN at run time instead of being bundled: its npm package
 * pulls in Node-only native dependencies that have no place in this site's build.
 */
const CDN = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1";

export type DetectRequest =
  | { type: "warm"; model: string }
  | {
      type: "analyze";
      id: number;
      model: string;
      width: number;
      height: number;
      rgba: ArrayBuffer;
    };
export type DetectMessage =
  | { type: "download"; loaded: number; total: number }
  | { type: "ready"; id: number }
  | { type: "infer"; id: number }
  | {
      type: "result";
      id: number;
      w: number;
      h: number;
      /** Probability that a cell is floor (or a rug lying on it). */
      prob: Float32Array;
      /** Most likely class of each cell. */
      cls: Uint8Array;
      ids: { wall: number; floor: number; ceiling: number };
    }
  | { type: "error"; id: number; message: string };

/* eslint-disable @typescript-eslint/no-explicit-any -- the library is loaded untyped from the CDN */
type Loaded = { T: any; processor: any; model: any };
let loading: Promise<Loaded> | null = null;
let loadingName = "";

const post = (message: DetectMessage, transfer: Transferable[] = []) =>
  (self as unknown as { postMessage(m: unknown, t: Transferable[]): void }).postMessage(
    message,
    transfer,
  );

function load(name: string): Promise<Loaded> {
  if (loading && loadingName === name) return loading;
  loadingName = name;
  // Progress of the weights file, by far the largest download.
  let biggest = 0;
  const progress = (p: any) => {
    if (p.status !== "progress" || !p.total || p.total < biggest) return;
    biggest = p.total;
    post({ type: "download", loaded: p.loaded, total: p.total });
  };
  const attempt = (async () => {
    const T = await import(/* @vite-ignore */ CDN);
    const processor = await T.AutoProcessor.from_pretrained(name, { progress_callback: progress });
    const model = await T.AutoModelForSemanticSegmentation.from_pretrained(name, {
      dtype: "q8",
      progress_callback: progress,
    });
    return { T, processor, model };
  })();
  loading = attempt;
  // A failed download must not poison later attempts.
  attempt.catch(() => {
    if (loading === attempt) loading = null;
  });
  return attempt;
}

self.onmessage = async (e: MessageEvent<DetectRequest>) => {
  const req = e.data;
  const id = req.type === "analyze" ? req.id : -1;
  try {
    const { T, processor, model } = await load(req.model);
    if (req.type === "warm") return;
    post({ type: "ready", id });
    const image = new T.RawImage(new Uint8ClampedArray(req.rgba), req.width, req.height, 4);
    const inputs = await processor(image);
    post({ type: "infer", id });
    const { logits } = await model(inputs);
    const [, classes, h, w] = logits.dims as number[];
    const data = logits.data as Float32Array;
    const labels: Record<string, number> = model.config.label2id ?? {};
    const ids = {
      wall: labels["wall"] ?? 0,
      floor: labels["floor"] ?? 3,
      ceiling: labels["ceiling"] ?? 5,
    };
    const rug = labels["rug"] ?? 28;
    const size = h! * w!;
    const prob = new Float32Array(size);
    const cls = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      let max = -Infinity;
      let arg = 0;
      for (let c = 0; c < classes!; c++) {
        const v = data[c * size + i]!;
        if (v > max) {
          max = v;
          arg = c;
        }
      }
      let sum = 0;
      for (let c = 0; c < classes!; c++) sum += Math.exp(data[c * size + i]! - max);
      prob[i] =
        (Math.exp(data[ids.floor * size + i]! - max) + Math.exp(data[rug * size + i]! - max)) / sum;
      // A rug counts as floor for everything the page does with the classes.
      cls[i] = arg === rug ? ids.floor : arg;
    }
    post({ type: "result", id, w: w!, h: h!, prob, cls, ids }, [prob.buffer, cls.buffer]);
  } catch (err) {
    post({ type: "error", id, message: err instanceof Error ? err.message : String(err) });
  }
};
