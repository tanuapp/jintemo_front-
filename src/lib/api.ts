export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Requested-With", "cozy-web");
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers,
      credentials: "include",
      signal: options.signal || AbortSignal.timeout(25000),
    });
  } catch {
    throw new ApiError(0, "Сервертэй холбогдож чадсангүй. Холболтоо шалгаад дахин оролдоно уу.");
  }
  const data = await response.json().catch(() => ({ error: "Серверийн хариу буруу байна." }));
  if (!response.ok) {
    if (
      response.status === 401 &&
      !["/auth/login", "/auth/register"].includes(path) &&
      typeof window !== "undefined"
    )
      window.dispatchEvent(new Event("cozy:unauthorized"));
    throw new ApiError(response.status, data.error || "Хүсэлт амжилтгүй боллоо.");
  }
  return data as T;
}
export const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});
export const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Алдаа гарлаа. Дахин оролдоно уу.";
export async function uploadImage(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new Error("Зураг 5MB-аас бага байна.");
  const body = new FormData();
  body.append("image", file);
  return (await api<{ url: string }>("/admin/upload", { method: "POST", body })).url;
}
