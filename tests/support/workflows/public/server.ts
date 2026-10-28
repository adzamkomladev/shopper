import {
  boxAuthFlows,
  boxBlobs,
  boxCache,
  boxPool,
  boxPriceChange,
  boxRealtime,
  boxSequencer,
} from "@shopper/adapters-box";
import { serveRuntime } from "@shopper/api/runtime";
import { createMaileroo } from "@shopper/auth";
import { mailerooFixture } from "../maileroo";
import { e2eRun } from "../../../../tooling/e2e/run";

const databaseURL = process.env.E2E_DATABASE_URL;
if (!databaseURL || !new URL(databaseURL).pathname.endsWith("_e2e")) {
  throw new Error("The public browser API requires E2E_DATABASE_URL ending in _e2e");
}
const database = boxPool(databaseURL);
const baseURL = process.env.SHOPPER_AUTH_URL ?? e2eRun.url(5185);
const linkSecret = "e2e-only-link-secret-more-than-32-characters";
const cache = boxCache(e2eRun.path(".shopper/public-e2e-cache.sqlite", "public/cache.sqlite"));
const mail = await mailerooFixture(e2eRun.port(3103));
const authFlows = boxAuthFlows({
  withDatabase: (run) => run(database.db),
  baseURL,
  linkSecret,
  mail: createMaileroo({
    apiKey: mail.apiKey,
    from: "noreply@shopper.test",
    endpoint: mail.endpoint,
  }),
});
const priceChange = boxPriceChange({ database: database.db, realtime: boxRealtime() }).launcher;
// A till a new shop enrols here (the onboarding milestone spec) syncs its catalogue and sales with this host.
const blobs = await boxBlobs(e2eRun.path(".shopper/public/blobs", "public/blobs"), {
  baseUrl: baseURL,
  secret: new TextEncoder().encode(linkSecret),
});

export default {
  port: e2eRun.port(3102),
  idleTimeout: 30,
  fetch: (request: Request) =>
    serveRuntime(request, {
      database: database.db,
      cache: cache.cache,
      secret: "e2e-only-secret-more-than-32-characters",
      baseURL,
      linkSecret,
      authFlows,
      priceChange,
      sequencer: boxSequencer(database.db),
      blobs: blobs.blobs,
      publicOnboarding: true,
      clientIP: "127.0.0.1",
    }),
};
