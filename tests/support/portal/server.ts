import {
  boxAuthFlows,
  boxBlobs,
  boxCache,
  boxPool,
  boxPriceChange,
  boxRealtime,
} from "@shopper/adapters-box";
import { serveRuntime } from "@shopper/api/runtime";
import { servePortal } from "@shopper/api/portal";
import { createMaileroo } from "@shopper/auth";
import { sha256 } from "@shopper/utils";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const databaseURL = process.env.E2E_DATABASE_URL;
if (!databaseURL || !new URL(databaseURL).pathname.endsWith("_e2e")) {
  throw new Error("The portal browser server requires E2E_DATABASE_URL ending in _e2e");
}
const database = boxPool(databaseURL);
const baseURL = process.env.SHOPPER_AUTH_URL ?? "http://localhost:5183";
const linkSecret = "e2e-only-link-secret-more-than-32-characters";
const cache = boxCache(`.shopper/portal/${new URL(baseURL).port}.sqlite`);
const publicOnboarding = process.env.E2E_PUBLIC_ONBOARDING === "1";
const authFlows = boxAuthFlows({
  withDatabase: (run) => run(database.db),
  baseURL,
  linkSecret,
  mail: createMaileroo({
    apiKey: "local-maileroo-contract-key",
    from: "noreply@shopper.test",
    endpoint: "http://127.0.0.1:3103/api/v2/emails",
  }),
});
const priceChange = boxPriceChange({ database: database.db, realtime: boxRealtime() }).launcher;
const blobs = await boxBlobs(".shopper/portal/blobs", {
  baseUrl: baseURL,
  secret: new TextEncoder().encode(linkSecret),
  objectStorage: {
    endpoint: "http://127.0.0.1:9200",
    bucket: "shopper-imports-dev",
    accessKeyId: "shopper_dev_access",
    secretAccessKey: "shopper_dev_secret_at_least_32_chars",
    region: "us-east-1",
  },
});
const server = await import(pathToFileURL(resolve("apps/portal/dist/server/server.js")).href);
const portalRuntime = async (request: Request) => {
  const clientIP = await clientAddress(request);
  return servePortal(request, (request) =>
    serveRuntime(request, {
      database: database.db,
      cache: cache.cache,
      secret: "e2e-only-secret-more-than-32-characters",
      bootstrapToken: "e2e-only-bootstrap-token",
      baseURL,
      linkSecret,
      authFlows,
      priceChange,
      publicOnboarding,
      clientIP,
      blobs: blobs.blobs,
    }),
  );
};

/**
 * Every browser in the suite connects from 127.0.0.1, so Better Auth's per-address limits would
 * pool the whole run into one client. A signed-in browser gets its own address from its session
 * cookie; anonymous requests (sign-in, onboarding) still share 127.0.0.1 and keep their limits.
 */
async function clientAddress(request: Request) {
  const session = request.headers.get("cookie")?.match(/better-auth\.session_token=([^;]+)/)?.[1];
  if (!session) return "127.0.0.1";
  const digest = await sha256(session);
  const octet = (index: number) => Number.parseInt(digest.slice(index * 2, index * 2 + 2), 16);
  return `10.${octet(0)}.${octet(1)}.${octet(2)}`;
}

const assets = resolve("apps/portal/dist/client");
const contentTypes: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

export default {
  port: Number(new URL(baseURL).port),
  idleTimeout: 30,
  async fetch(request: Request) {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/assets/")) {
      const bytes = await readFile(resolve(assets, `.${path}`)).catch(() => undefined);
      if (!bytes) return new Response("Not found", { status: 404 });
      const type = contentTypes[extname(path)] ?? "application/octet-stream";
      return new Response(bytes, { headers: { "Content-Type": type } });
    }
    return server.default.fetch(request, { context: { portalRuntime } });
  },
};
