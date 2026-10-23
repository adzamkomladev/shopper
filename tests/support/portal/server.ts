import {
  boxAuthFlows,
  boxBlobs,
  boxCache,
  boxKycFlows,
  boxPool,
  boxPriceChange,
  boxRealtime,
} from "@shopper/adapters-box";
import { createArkesel } from "@shopper/core/sms/arkesel";
import { serveRuntime } from "@shopper/api/runtime";
import { probePortal, servePortal } from "@shopper/api/portal";
import type { PortalContext } from "@shopper/api/portal";
import { buildInfo } from "@shopper/config";
import { sql } from "drizzle-orm";
import { createMaileroo } from "@shopper/auth";
import { sha256 } from "@shopper/utils";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { startArkeselFake } from "../../../tooling/arkesel/server";

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
// Identity checks send their one-time codes through an Arkesel fake: a spec reads the code from
// http://127.0.0.1:3104/test/requests, as a person would read it from their phone.
const arkesel = await startArkeselFake({ port: Number(process.env.E2E_ARKESEL_PORT ?? 3104) });
const kyc = boxKycFlows({
  withDatabase: (run) => run(database.db),
  sms: createArkesel({ apiKey: arkesel.apiKey, sender: "Shopper", baseUrl: arkesel.baseUrl }),
  linkSecret,
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
// Satori and resvg read their wasm from their own folders, which a bundle in .shopper/ cannot reach, so this
// server has no renderer. A statement's PDF comes from the box on the same database and link secret.
const boxURL = process.env.E2E_BOX_URL ?? "http://localhost:3101";
const statementPdf = /^\/api(\/public\/statements\/[^/]+\/pdf)$/;
const portalRuntime = async (request: Request) => {
  const pdf = statementPdf.exec(new URL(request.url).pathname);
  if (pdf) return fetch(new URL(pdf[1]!, boxURL));
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
      kyc,
      publicOnboarding,
      clientIP,
      blobs: blobs.blobs,
    }),
  );
};

// An org id no shop uses: the probes only need the stores to answer, not to hold anything.
const probeOrg = "00000000-0000-7000-8000-000000000000";
const context: PortalContext = {
  portalRuntime,
  portalHost: () => ({
    version: buildInfo.version,
    environment: "e2e",
    publicOnboarding,
  }),
  portalHealth: () =>
    probePortal({
      database: () => database.db.execute(sql`select 1`),
      cache: () => cache.cache.request().get(probeOrg, "health"),
      blobs: () => blobs.blobs.get(probeOrg, "health/absent"),
    }),
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
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/** Like Workers Static Assets: files by path, `index.html` for any other document navigation. */
async function serveStatic(request: Request, path: string) {
  const file = resolve(assets, `.${path}`);
  const wantsDocument = request.headers.get("accept")?.includes("text/html");
  const target = !file.startsWith(`${assets}/`)
    ? undefined
    : await readFile(file).catch(() => undefined);
  if (target) return respond(target, extname(file));
  // A document navigation to any other path gets the shell, whatever the path ends in: a statement link ends in its signature.
  if (wantsDocument) return respond(await readFile(resolve(assets, "index.html")), ".html");
  return undefined;
}

function respond(bytes: Uint8Array, extension: string) {
  const type = contentTypes[extension] ?? "application/octet-stream";
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": type } });
}

export default {
  port: Number(new URL(baseURL).port),
  idleTimeout: 30,
  async fetch(request: Request) {
    const path = new URL(request.url).pathname;
    const owned = path === "/api" || path.startsWith("/api/") || path.startsWith("/_serverFn/");
    return (
      (owned ? undefined : await serveStatic(request, path)) ??
      server.default.fetch(request, { context })
    );
  },
};
