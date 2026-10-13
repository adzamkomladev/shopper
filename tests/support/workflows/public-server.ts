import {
  boxAuthFlows,
  boxCache,
  boxPool,
  boxPriceChange,
  boxRealtime,
} from "@shopper/adapters-box";
import { serveRuntime } from "@shopper/api/runtime";
import { createMaileroo } from "@shopper/auth";
import { mailerooFixture } from "./maileroo";

const databaseURL = process.env.E2E_DATABASE_URL;
if (!databaseURL || !new URL(databaseURL).pathname.endsWith("_e2e")) {
  throw new Error("The public browser API requires E2E_DATABASE_URL ending in _e2e");
}
const database = boxPool(databaseURL);
const baseURL = process.env.SHOPPER_AUTH_URL ?? "http://localhost:5185";
const linkSecret = "e2e-only-link-secret-more-than-32-characters";
const cache = boxCache(".shopper/public-e2e-cache.sqlite");
const mail = await mailerooFixture(3103);
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

export default {
  port: 3102,
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
      publicOnboarding: true,
      clientIP: "127.0.0.1",
    }),
};
