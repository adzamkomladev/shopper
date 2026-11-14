import { bootArchiveExport, bootCloudMove } from "./exports";
import { bootFiscalLane } from "./fiscal";
import { Hono } from "hono";
import { buildInfo } from "@shopper/config";
import { deliverNotification } from "@shopper/core/notifications";
import { runWatchdog } from "@shopper/core/reports";
import type { BoxBindings, BoxOptions } from "./types";
import { boxPayments } from "./payments";
import { boxOrders } from "./orders";
import { boxEngine } from "./engine";
import { boxStorage } from "./storage";
import { portalFolder, withPortal } from "./portal";
import { TILL_FEED, withTillFeed } from "./tillfeed";
import { boxUpdatesFor } from "./updates/box";
import { boxInstall, boxNeedsInstall, boxTenant, withInstallRedirect } from "./install";
import { boxLicence } from "./licence";
import { boxChannels } from "./channels";
import {
  boxLive,
  boxCache,
  boxSequencer,
  boxDatabase,
  boxPool,
  boxPriceChange,
  boxRealtime,
  boxAuthFlows,
  boxKycFlows,
  boxAccountFlows,
  boxStatementFlows,
  boxRateLimiter,
  boxAuditAnchors,
  boxStoreDays,
  boxWatchdog,
} from "@shopper/adapters-box";
import { boxRenderer } from "@shopper/adapters-box/renderer";
import { NOTIFICATION_RETRY, type Queue } from "@shopper/ports";
import { isPublicRequest, publicApi, runtimeUnavailable, serveRuntime } from "@shopper/api/runtime";
export function createBoxApp(
  environment: Record<string, string | undefined> = process.env,
  options: BoxOptions = {},
) {
  const issuer = options.licenceIssuer ?? buildInfo.licenceIssuer;
  const licence = boxLicence(environment, { issuer, fetch: options.fetch });
  const realtime = boxRealtime();
  const rateLimiter = boxRateLimiter();
  let workflowPool: ReturnType<typeof boxPool> | undefined;
  let cache: ReturnType<typeof boxCache> | undefined;
  let authFlows: ReturnType<typeof boxAuthFlows> | undefined;
  let kycFlows: ReturnType<typeof boxKycFlows> | undefined;
  let archiveExport: ReturnType<typeof bootArchiveExport> | undefined;
  let cloudMove: ReturnType<typeof bootCloudMove> | undefined;
  let payments: ReturnType<typeof boxPayments> | undefined;
  let priceChange: ReturnType<typeof boxPriceChange> | undefined;
  let notifications: Queue | undefined;
  let accountFlows: ReturnType<typeof boxAccountFlows> | undefined;
  let statementFlows: ReturnType<typeof boxStatementFlows> | undefined;
  let lane: Awaited<ReturnType<typeof bootFiscalLane>>;
  let watchdog: ReturnType<typeof boxWatchdog> | undefined;
  let storeDays: ReturnType<typeof boxStoreDays> | undefined;
  let orders: ReturnType<typeof boxOrders> | undefined;
  let engine: ReturnType<typeof boxEngine> | undefined;
  const renderer = boxRenderer({ wasm: options.wasm });
  const install = boxInstall(environment, { issuer, licence });
  const tenant = boxTenant(environment);
  const updatesFor = boxUpdatesFor(environment, licence, options.releaseKey);
  const api = new Hono<{ Bindings: BoxBindings }>().all("*", async (context) => {
    const request = context.req.raw;
    if (new URL(request.url).pathname === "/install") return install.fetch(request);
    if (isPublicRequest(request)) return publicApi.fetch(request);
    const { DATABASE_URL, SHOPPER_AUTH_SECRET, SHOPPER_AUTH_URL, SHOPPER_BOOTSTRAP_TOKEN } =
      environment;
    if (!DATABASE_URL || !SHOPPER_AUTH_SECRET || !SHOPPER_AUTH_URL) return runtimeUnavailable();
    const blobs = () =>
      boxStorage(environment, { baseUrl: SHOPPER_AUTH_URL, secret: SHOPPER_AUTH_SECRET });
    engine ??= boxEngine(environment);
    const launch = engine.launch;
    const connection = await boxDatabase(DATABASE_URL);
    const shopId = await tenant(connection.db);
    cache ??= boxCache(environment.SHOPPER_CACHE_PATH ?? ".shopper/cache.sqlite");
    // Created on first use, never at import: workflows outlive requests, so they get their own pool.
    workflowPool ??= boxPool(DATABASE_URL);
    const workflowDatabase = workflowPool.db;
    const { mail, sms } = boxChannels(environment);
    priceChange ??= boxPriceChange({ database: workflowDatabase, realtime }, launch);
    if (environment.SHOPPER_LINK_SECRET)
      authFlows ??= boxAuthFlows(
        {
          withDatabase: (run) => run(workflowDatabase),
          linkSecret: environment.SHOPPER_LINK_SECRET,
          baseURL: SHOPPER_AUTH_URL,
          mail,
        },
        launch,
      );
    payments ??= boxPayments(environment, {
      database: workflowDatabase,
      realtime,
      baseUrl: SHOPPER_AUTH_URL,
      launch,
    });
    orders ??= boxOrders(workflowDatabase, payments, () => notifications, launch);
    // Alerts, statements, tier notices and account wakes share one queue; a channel it lacks retries.
    notifications ??= engine.queue(NOTIFICATION_RETRY, (delivery) =>
      deliverNotification(
        {
          db: workflowDatabase,
          appVersion: buildInfo.version,
          sms,
          mail,
          renderer,
          linkSecret: environment.SHOPPER_LINK_SECRET,
          baseUrl: SHOPPER_AUTH_URL,
          shopUrl: environment.SHOPPER_SHOP_URL || undefined,
          accounts: accountFlows,
          statements: statementFlows,
          refunds: payments?.momoRefund,
          orderRefunds: orders?.refunds,
          realtime,
          queue: notifications,
        },
        delivery,
      ),
    );
    if (!statementFlows) {
      statementFlows = boxStatementFlows(
        {
          withDatabase: (run) => run(workflowDatabase),
          appVersion: buildInfo.version,
          queue: notifications,
        },
        launch,
      );
      // On boot every monthly statement schedule starts again and runs a run day it missed.
      statementFlows
        .relaunch()
        .catch((error: unknown) => console.error({ event: "statement.relaunch_failed", error }));
    }
    if (!accountFlows) {
      accountFlows = boxAccountFlows(
        {
          withDatabase: (run) => run(workflowDatabase),
          appVersion: buildInfo.version,
          queue: notifications,
        },
        launch,
      );
      // On boot every account with a ledger looks for its next due moment again.
      accountFlows
        .relaunch()
        .catch((error: unknown) => console.error({ event: "account.relaunch_failed", error }));
    }
    if (!storeDays) {
      storeDays = boxStoreDays({ database: workflowDatabase, queue: notifications }, launch);
      // The in-process engine forgets sleeping days on restart: every store's today starts again on boot.
      storeDays
        .relaunch()
        .catch((error: unknown) => console.error({ event: "store_day.relaunch_failed", error }));
    }
    archiveExport ??= bootArchiveExport(
      { database: workflowDatabase, blobs: await blobs() },
      launch,
    );
    // Only a licensed box can move: the licence is what the cloud trusts.
    if (licence) cloudMove ??= bootCloudMove(licence, workflowDatabase, await blobs(), launch);
    if (!watchdog) {
      const anchors = boxAuditAnchors({ database: workflowDatabase, queue: notifications }, launch);
      const days = storeDays.launcher;
      const settled = payments.settlements?.launcher;
      // The box bills nobody: Shopper subscriptions are cloud only, so it starts no billing periods.
      watchdog = boxWatchdog(async (at) => {
        // Each night the box checks its licence in, when it can reach Shopper; offline it just waits.
        await licence
          ?.checkIn()
          .catch((error: unknown) => console.error({ event: "licence.check_in_failed", error }));
        return runWatchdog(
          {
            withDatabase: (run) => run(workflowDatabase),
            anchors: anchors.launcher,
            storeDays: days,
            settlements: settled,
          },
          at,
        );
      }, launch).catch((error: unknown) =>
        console.error({ event: "watchdog.start_failed", error }),
      );
    }
    lane ??= await bootFiscalLane(environment, { database: workflowDatabase, blobs, launch });
    if (sms && environment.SHOPPER_LINK_SECRET)
      kycFlows ??= boxKycFlows(
        {
          withDatabase: (run) => run(workflowDatabase),
          sms,
          linkSecret: environment.SHOPPER_LINK_SECRET,
        },
        launch,
      );
    try {
      return await serveRuntime(request, {
        database: connection.db,
        notifications,
        lane,
        renderer,
        sequencer: boxSequencer(connection.db),
        cache: cache.cache,
        rateLimiter,
        realtime,
        live: boxLive(
          realtime,
          context.env?.upgrade ? { upgrade: context.env.upgrade.bind(context.env) } : undefined,
        ),
        blobs: await blobs(),
        secret: SHOPPER_AUTH_SECRET,
        baseURL: SHOPPER_AUTH_URL,
        orgId: shopId,
        bootstrapToken: SHOPPER_BOOTSTRAP_TOKEN,
        clientIP: context.env?.requestIP?.(request)?.address ?? "127.0.0.1",
        priceChange: priceChange.launcher,
        momoPayment: payments.momoPayment,
        momoRefund: payments.momoRefund,
        hubtel: payments.hubtel,
        settlements: payments.settlements?.launcher,
        approvals: payments.approvals,
        paystackSecret: environment.PAYSTACK_SECRET_KEY,
        authFlows,
        kyc: kycFlows,
        archiveExports: archiveExport.launcher,
        cloudMoves: cloudMove?.launcher,
        storeDays: storeDays.launcher,
        ...orders,
        linkSecret: environment.SHOPPER_LINK_SECRET,
        minTillVersion: environment.SHOPPER_MIN_TILL_VERSION,
        tillFeed: TILL_FEED,
        licence,
        updates: updatesFor(workflowDatabase, launch),
      });
    } finally {
      await connection.close();
    }
  });
  const portal = withPortal(api, options.portal ?? portalFolder(environment.SHOPPER_PORTAL_DIR));
  return withInstallRedirect(withTillFeed(portal, environment), () => boxNeedsInstall(environment));
}
