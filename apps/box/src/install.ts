import { timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";
import { v7 } from "uuid";
import { installBox } from "@shopper/auth";
import { installImportSchema, installSchema } from "@shopper/auth/schemas";
import { buildInfo } from "@shopper/config";
import type { Licence } from "@shopper/core/licence";
import { archiveImport, org, type ShopperDatabase } from "@shopper/db-pg";
import { arriveFromCloud, ImportError, readZip } from "@shopper/export";
import type { BoxLicence } from "@shopper/api";
import { sha256 } from "@shopper/utils";
import { boxDatabase } from "@shopper/adapters-box";
import { acceptLicence } from "./licence";
import { boxStorage } from "./storage";
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
 * A box installed with `--import` (`SHOPPER_IMPORT`) instead takes over the cloud shop in that archive
 * (`POST /install/import`), and stays installable until the cloud has its verification report.
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
  let shop: Promise<string> | undefined;
  const importing = () => env.SHOPPER_IMPORT && (shop ??= shopIn(env.SHOPPER_IMPORT));
  const pending = () => withDb(env.SHOPPER_IMPORT ? importPending : needsInstall);
  app.get("/install", async (c) => {
    if (!(await pending())) return c.json({ error: "Not found" }, 404);
    const archived = importing();
    return c.json({
      needsInstall: true,
      licence: {
        enforced: Boolean(options.issuer),
        request: options.licence && (await options.licence.status()).request,
      },
      ...(archived && { import: { shop: await archived } }),
    });
  });
  app.post("/install", async (c) => {
    const parsed = v.safeParse(installSchema, await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json({ error: "Invalid request data" }, 400);
    const input = parsed.output;
    if (env.SHOPPER_IMPORT)
      return c.json({ error: "This box was installed to take over a shop from the cloud." }, 409);
    if (!(await withDb(needsInstall))) return c.json({ error: "Not found" }, 404);
    const refused = await admit(input.code, input.licence);
    if (refused) return c.json(refused.body, refused.status);
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
  app.post("/install/import", async (c) => {
    const parsed = v.safeParse(installImportSchema, await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json({ error: "Invalid request data" }, 400);
    if (!env.SHOPPER_IMPORT || !(await pending())) return c.json({ error: "Not found" }, 404);
    const licence = options.licence;
    if (!licence || !env.SHOPPER_LICENCE_URL || !env.SHOPPER_AUTH_URL || !env.SHOPPER_AUTH_SECRET)
      return c.json({ error: "This box cannot reach Shopper to take over a shop" }, 503);
    const refused = await admit(parsed.output.code, parsed.output.licence);
    if (refused) return c.json(refused.body, refused.status);
    const cloud = env.SHOPPER_LICENCE_URL;
    const blobs = await boxStorage(env, {
      baseUrl: env.SHOPPER_AUTH_URL,
      secret: env.SHOPPER_AUTH_SECRET,
    });
    const arrived = await withDb(async (db) =>
      arriveFromCloud(
        db,
        {
          blobs,
          appVersion: buildInfo.version,
          cloud: (path, body) =>
            licence
              .send(new URL(path, cloud).toString(), {
                method: "POST",
                body: JSON.stringify(body),
              })
              .catch(() => new Response(null, { status: 502 })),
        },
        {
          archive: await readFile(env.SHOPPER_IMPORT!),
          licence: parsed.output.licence as Licence,
          // The registers find the box where its owner reaches it.
          upstream: new URL(env.SHOPPER_AUTH_URL!).origin,
        },
      ),
    );
    return c.json(arrived);
  });
  app.onError((error, c) => {
    if (error instanceof ImportError) return c.json({ error: error.message }, error.status);
    throw error;
  });
  return app;

  /** The setup code (wrong ones counted) and, where an issuer is enforced, a licence genuine for this machine. */
  async function admit(code: string, value: unknown) {
    const recent = wrong.filter((at) => Date.now() - at < WINDOW_MS);
    wrong.splice(0, wrong.length, ...recent);
    if (recent.length >= MAX_WRONG)
      return { body: { error: "Too many wrong codes. Wait a few minutes." }, status: 429 as const };
    if (!(await codeMatches(code, env.SHOPPER_SETUP_CODE_HASH!))) {
      wrong.push(Date.now());
      return { body: { error: "That setup code is not right" }, status: 403 as const };
    }
    if (!options.issuer) return undefined;
    const refused = await acceptLicence(env, options.issuer, value);
    if (!refused) return undefined;
    return {
      body: { error: REASONS[refused as keyof typeof REASONS] ?? REASONS.forged },
      status: 422 as const,
    };
  }
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

/** An import is pending until the cloud has agreed with the box's report: a box cut off mid-way runs it again. */
async function importPending(db: Pick<ShopperDatabase, "select">) {
  if (await needsInstall(db)) return true;
  const [arrival] = await db.select({ status: archiveImport.status }).from(archiveImport).limit(1);
  return arrival?.status === "importing";
}

async function shopIn(path: string) {
  const manifest = readZip(new Uint8Array(await readFile(path))).get("manifest.json");
  return (JSON.parse(new TextDecoder().decode(manifest)) as { org: { name: string } }).org.name;
}

async function codeMatches(code: string, expectedHash: string) {
  const given = Buffer.from(await sha256(code.toUpperCase().replace(/[^A-Z0-9]/g, "")));
  const expected = Buffer.from(expectedHash);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
