import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// When frontend and backend are deployed as separate origins (e.g. two
// standalone Vercel projects), scripts/start.mjs's single-origin gateway
// doesn't exist to proxy /api, /media, /uploads, /health to the backend —
// so this server does it instead. In a self-hosted build the gateway
// intercepts those paths before they ever reach this process, so this
// branch is simply never hit there.
const BACKEND_PROXY_PATTERN = /^\/(api|media|uploads|health)(\/|$)/;

async function proxyToBackend(request: Request): Promise<Response> {
  const backendOrigin =
    process.env["API_PROXY_TARGET"]?.trim() || "https://jintemo-backend-new.vercel.app";
  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, backendOrigin);
  const headers = new Headers(request.headers);
  headers.delete("host");
  // This is a same-origin gateway. Browsers send Origin on POST requests;
  // the API sees a server-to-server request, so omit only our own origin.
  // Keep foreign origins for the backend's CORS checks to reject.
  if (headers.get("origin") === url.origin) headers.delete("origin");
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = request.body;
    init.duplex = "half";
  }
  try {
    const upstream = await fetch(target, init);
    // fetch already transparently decompresses the body, but upstream.headers
    // still reports the original Content-Encoding/Content-Length — forwarding
    // those as-is makes the browser try (and fail) to decode plain bytes again.
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    console.error("Backend proxy failed:", error);
    return new Response(JSON.stringify({ error: "Сервертэй холбогдож чадсангүй." }), {
      status: 502,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    if (BACKEND_PROXY_PATTERN.test(new URL(request.url).pathname))
      return proxyToBackend(request);
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
