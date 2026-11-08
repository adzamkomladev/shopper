import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { Hono } from "hono";
import { getMimeType } from "hono/utils/mime";
import type { BoxBindings, Pack, PortalSource } from "./types";

// The headers Workers Static Assets sends with the portal (apps/portal/public/_headers).
const SHELL_HEADERS = {
  "content-security-policy": "frame-ancestors 'none'",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

/**
 * The back office on the box's origin, as the cloud serves it: `/api/*` is the API (whose own routes sit at the root),
 * a GET for a built file gets the file, a browser navigation gets the SPA shell, and everything else is the API.
 */
export function withPortal(api: Hono<{ Bindings: BoxBindings }>, source: PortalSource | undefined) {
  return new Hono<{ Bindings: BoxBindings }>().all("*", async (context) => {
    const request = context.req.raw;
    const url = new URL(request.url);
    // `/api/auth/*` is mounted under that name already; the other API routes drop the prefix.
    if (url.pathname.startsWith("/api/auth/")) return api.fetch(request, context.env);
    if (url.pathname.startsWith("/api/"))
      return api.fetch(
        new Request(new URL(url.pathname.slice(4) + url.search, url), request),
        context.env,
      );
    if (!source || request.method !== "GET") return api.fetch(request, context.env);
    const file = await portalFile(source, url.pathname);
    if (file) return file;
    if (request.headers.get("accept")?.includes("text/html"))
      return (await portalFile(source, "/index.html")) ?? api.fetch(request, context.env);
    return api.fetch(request, context.env);
  });
}

/** The portal folder `dir`, read from disk (`SHOPPER_PORTAL_DIR`). */
export function portalFolder(dir: string | undefined): PortalSource | undefined {
  if (!dir) return undefined;
  const root = resolve(dir);
  return async (pathname) => {
    const path = resolve(root, `.${safeDecode(pathname)}`);
    // A decoded `..` (or `\`) that leaves the portal folder is never read.
    if (!path.startsWith(root + sep)) return undefined;
    const found = await stat(path).catch(() => undefined);
    return found?.isFile() ? new Blob([await readFile(path)]) : undefined;
  };
}

/** The portal embedded in the sealed binary, under `portal/`. */
export function portalPack(pack: Pack): PortalSource {
  return async (pathname) => pack.file(`portal${safeDecode(pathname)}`);
}

async function portalFile(source: PortalSource, pathname: string) {
  const body = await source(pathname);
  if (!body) return undefined;
  return new Response(body, {
    headers: {
      ...SHELL_HEADERS,
      "content-type": getMimeType(pathname) ?? "application/octet-stream",
    },
  });
}

function safeDecode(pathname: string) {
  try {
    return decodeURIComponent(pathname).replaceAll("\\", "/");
  } catch {
    return "/";
  }
}
