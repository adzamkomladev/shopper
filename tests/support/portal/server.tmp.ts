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
import { resolve } from "node:path";
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
const portalRuntime = (request: Request) =>
  servePortal(request, (request) =>
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
      clientIP: "127.0.0.1",
      blobs: blobs.blobs,
    }),
  );

export default {
  port: Number(new URL(baseURL).port),
  idleTimeout: 30,
  async fetch(request: Request) {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/assets/")) {
      const file = Bun.file(resolve("apps/portal/dist/client", `.${path}`));
      if (await file.exists()) return new Response(file);
      return new Response("Not found", { status: 404 });
    }
    return server.default.fetch(request, { context: { portalRuntime } });
  },
};
