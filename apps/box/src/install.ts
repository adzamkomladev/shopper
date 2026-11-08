import { timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";
import { v7 } from "uuid";
import { installBox } from "@shopper/auth";
import { installSchema } from "@shopper/auth/schemas";
import { buildInfo } from "@shopper/config";
import { org, type ShopperDatabase } from "@shopper/db-pg";
import type { BoxLicence } from "@shopper/api";
import { sha256 } from "@shopper/utils";
import { boxDatabase } from "@shopper/adapters-box";
import { acceptLicence } from "./licence";
import type { BoxBindings } from "./types";

const REASONS = {
  missing: "Paste the licence Shopper issued for this box.",
  unreadable: "That is not a licence file.",
  forged: "That licence was not issued by Shopper.",
  machine: "That licence was issued for another machine.",
  key: "That licence was issued for another request code. Ask Shopper support to reissue it from this box's current code.",
} as const;
// shortcut: wrong codes are counted in this process, not stored; a restart forgives them. The code is 12 characters of
// 31 and the box answers only its own shop network, so this only slows a neighbour; upgrade if the box ever faces the internet.
const WINDOW_MS = 15 * 60_000;
const MAX_WRONG = 5;

/**
 * The first-boot wizard's API (`GET /install` state, `POST /install`). A box with no shop creates its shop, first store,
 * owner and licence from the setup code the installer printed; once a shop exists both answer as if the route were not there.
 */
export function boxInstall(
  env: Record<string, string | undefined>,
  options: { issuer: string; licence?: BoxLicence },
) {
  const wrong: number[] = [];
  const app = new Hono();
  const withDb = async <T>(
    run: (db: Awaited<ReturnType<typeof boxDatabase>>["db"]) => Promise<T>,
  ) => {
    const connection = await boxDatabase(env.DATABASE_URL!);
    try {
      return await run(connection.db);
    } finally {
      await connection.close();
    }
  };
  app.use(async (c, next) =>
    env.DATABASE_URL && env.SHOPPER_SETUP_CODE_HASH
      ? next()
      : c.json({ error: "This box has no setup code" }, 503),
  );
  app.get("/install", async (c) => {
    if (!(await withDb(needsInstall))) return c.json({ error: "Not found" }, 404);
    return c.json({
      needsInstall: true,
      licence: {
        enforced: Boolean(options.issuer),
        request: options.licence && (await options.licence.status()).request,
      },
    });
  });
  app.post("/install", async (c) => {
    const parsed = v.safeParse(installSchema, await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json({ error: "Invalid request data" }, 400);
    const input = parsed.output;
    if (!(await withDb(needsInstall))) return c.json({ error: "Not found" }, 404);
    const recent = wrong.filter((at) => Date.now() - at < WINDOW_MS);
    wrong.splice(0, wrong.length, ...recent);
    if (recent.length >= MAX_WRONG)
      return c.json({ error: "Too many wrong codes. Wait a few minutes." }, 429);
    if (!(await codeMatches(input.code, env.SHOPPER_SETUP_CODE_HASH!))) {
      wrong.push(Date.now());
      return c.json({ error: "That setup code is not right" }, 403);
    }
    if (options.issuer) {
      const refused = await acceptLicence(env, options.issuer, input.licence);
      if (refused)
        return c.json({ error: REASONS[refused as keyof typeof REASONS] ?? REASONS.forged }, 422);
    }
    const created = await withDb((db) =>
      db.transaction(async (tx) => {
        // Two people pressing the button at once make one shop: the second finds the first's.
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtextextended('shopper.box.install', 0))`,
        );
        if (!(await needsInstall(tx))) return undefined;
        return installBox(tx, { orgId: v7(), appVersion: buildInfo.version }, input);
      }),
    );
    return created ? c.json(created, 201) : c.json({ error: "Not found" }, 404);
  });
  return app;
}

/**
 * The tenant for a request: `SHOPPER_ORG_ID` when set. With `SHOPPER_SINGLE_SHOP` (the installer sets it) the only shop in
 * the database, once the wizard has made it. Development boxes and tests otherwise choose a tenant per request.
 */
export function boxTenant(env: Record<string, string | undefined>) {
  let known: string | undefined;
  return async (db: Pick<ShopperDatabase, "select">) => {
    if (env.SHOPPER_ORG_ID || !env.SHOPPER_SINGLE_SHOP) return env.SHOPPER_ORG_ID;
    if (known) return known;
    const shops = await db.select({ id: org.id }).from(org).limit(2);
    return (known = shops.length === 1 ? shops[0]!.id : undefined);
  };
}

/** `/setup` is the signed-in readiness wizard; on a box with no shop yet a browser goes to first-boot setup instead. */
export function withInstallRedirect(
  app: Hono<{ Bindings: BoxBindings }>,
  pending: () => Promise<boolean>,
) {
  return new Hono<{ Bindings: BoxBindings }>()
    .get("/setup", async (c, next) =>
      c.req.header("accept")?.includes("text/html") && (await pending())
        ? c.redirect("/install")
        : next(),
    )
    .all("*", (c) => app.fetch(c.req.raw, c.env));
}

export async function boxNeedsInstall(env: Record<string, string | undefined>) {
  if (!env.DATABASE_URL) return false;
  const connection = await boxDatabase(env.DATABASE_URL);
  try {
    return await needsInstall(connection.db);
  } finally {
    await connection.close();
  }
}

async function needsInstall(db: Pick<ShopperDatabase, "select">) {
  return (await db.select({ id: org.id }).from(org).limit(1)).length === 0;
}

async function codeMatches(code: string, expectedHash: string) {
  const given = Buffer.from(await sha256(code.toUpperCase().replace(/[^A-Z0-9]/g, "")));
  const expected = Buffer.from(expectedHash);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
