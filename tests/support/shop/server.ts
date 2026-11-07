// The shop app as a browser meets it in e2e: the built Start server under Bun, `/api/shop/*` answered by the shared
// runtime on the e2e database, and sign-in codes texted to an Arkesel fake a spec reads, as a shopper reads a phone.
//   GET http://127.0.0.1:3106/test/requests  -> every SMS sent (shifted by the run's port offset)
// Guest checkout runs the box's order workflow and stock-hold timers in this process.
import {
  boxCache,
  boxOnlineOrders,
  boxOrderPayments,
  boxPool,
  boxQueue,
  boxRateLimiter,
  boxStockHolds,
} from "@shopper/adapters-box";
import { serveRuntime } from "@shopper/api/runtime";
import { serveShop } from "@shopper/api/shop";
import type { ShopContext } from "@shopper/api/shop";
import { buildInfo } from "@shopper/config";
import { deliverNotification } from "@shopper/core/notifications";
import { createPaystack } from "@shopper/core/payments/paystack";
import { createArkesel } from "@shopper/core/sms/arkesel";
import { NOTIFICATION_RETRY } from "@shopper/ports";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { startArkeselFake } from "../../../tooling/arkesel/server";
import { signWebhook, startPaystackFake } from "../../../tooling/paystack/server";
import { e2eRun } from "../../../tooling/e2e/run";

const databaseURL = process.env.E2E_DATABASE_URL;
if (!databaseURL || !new URL(databaseURL).pathname.endsWith("_e2e"))
  throw new Error("The shop browser server requires E2E_DATABASE_URL ending in _e2e");
const database = boxPool(databaseURL);
const baseURL = process.env.SHOPPER_SHOP_URL ?? e2eRun.url(5189);
const linkSecret = "e2e-only-link-secret-more-than-32-characters";
const cache = boxCache(":memory:");
const arkesel = await startArkeselFake({ port: e2eRun.port(3106) });
const sms = createArkesel({ apiKey: arkesel.apiKey, sender: "Shopper", baseUrl: arkesel.baseUrl });
const notifications = boxQueue(NOTIFICATION_RETRY, (delivery) =>
  deliverNotification(
    { db: database.db, appVersion: buildInfo.version, sms, linkSecret },
    delivery,
  ),
);
// Guest checkouts: each order's workflow and the timers that free unpaid stock, as the box runs them.
// Paystack is a fake the specs "pay" through: a number that approves at once, and `/test/paystack/pay` for a card.
const paystackFake = await startPaystackFake();
paystackFake.behave("0551234987", "success");
const paystack = createPaystack({
  secretKey: paystackFake.secretKey,
  baseUrl: paystackFake.baseUrl,
});
const flowDeps = {
  withDatabase: <T>(run: (db: typeof database.db) => Promise<T>) => run(database.db),
  appVersion: buildInfo.version,
};
const orderFlows = boxOnlineOrders({ ...flowDeps, paystack });
const orderPayments = boxOrderPayments({ ...flowDeps, paystack, orders: orderFlows });
const stockHolds = boxStockHolds({ db: database.db, appVersion: buildInfo.version }).holds;
// Every browser connects from 127.0.0.1; a spec names its own address so the per-address budgets stay apart.
const clientIP = (request: Request) => request.headers.get("x-e2e-client") ?? "127.0.0.1";
const runtime = (request: Request, ip: string) =>
  serveRuntime(request, {
    database: database.db,
    cache: cache.cache,
    rateLimiter: boxRateLimiter(),
    secret: "e2e-only-secret-more-than-32-characters",
    baseURL,
    linkSecret,
    notifications,
    orderFlows,
    orderPayments,
    paystack,
    paystackSecret: paystackFake.secretKey,
    stockHolds,
    clientIP: ip,
  });
const context: ShopContext = {
  shopApi: (request) => serveShop(request, (forwarded) => runtime(forwarded, clientIP(forwarded))),
};
/** Paystack's webhook for a card a spec pays: the fake knows the charge, and the shop runtime hears it signed. */
async function payByCard(reference: string, pesewas: number) {
  paystackFake.knownCharge(reference, pesewas);
  const raw = JSON.stringify({
    event: "charge.success",
    data: { reference, status: "success", amount: pesewas },
  });
  return runtime(
    new Request(`${baseURL}/webhooks/paystack`, {
      method: "POST",
      body: raw,
      headers: { "x-paystack-signature": signWebhook(paystackFake.secretKey, raw) },
    }),
    "127.0.0.1",
  );
}
const app = resolve(`apps/shop/${e2eRun.outDir}`);
const server = await import(pathToFileURL(`${app}/server/server.js`).href);
const assets = `${app}/client`;
const contentTypes: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/** Like Workers Static Assets in front of the Worker: built files by path, everything else to the server. */
async function serveStatic(path: string) {
  const file = resolve(assets, `.${path}`);
  if (!file.startsWith(`${assets}${sep}`)) return undefined;
  const bytes = await readFile(file).catch(() => undefined);
  if (!bytes) return undefined;
  const type = contentTypes[extname(file)] ?? "application/octet-stream";
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": type } });
}

export default {
  port: Number(new URL(baseURL).port),
  idleTimeout: 30,
  async fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/test/paystack/pay")
      return payByCard(url.searchParams.get("reference")!, Number(url.searchParams.get("pesewas")));
    const owned = path.startsWith("/api/") || path.startsWith("/_serverFn/");
    return (
      (owned ? undefined : await serveStatic(path)) ?? server.default.fetch(request, { context })
    );
  },
};
