import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { buildInfo } from "@shopper/config";
import type { Cache } from "@shopper/ports";
import type { ShopperDatabase } from "@shopper/db-pg";

export function systemRoutes() {
  const app = new Hono();
  app.get("/", (c) => c.json({ name: "Shopper", status: "hello" }));
  app.get("/health", (c) => c.json({ status: "ok", build: buildInfo }));
  app.get("/about", (c) => c.json(buildInfo));
  return app;
}

/**
 * GET /health/ready: the database answers, holds every migration this build expects, and the cache
 * answers. Public, so it names each check but never an error.
 */
export async function readiness(options: { database: ShopperDatabase; cache: Cache }) {
  const [database, schema, cache] = await Promise.all([
    check(() => options.database.execute(sql`select 1`)),
    check(async () => {
      const { rows } = await options.database.execute<{ applied: number }>(
        sql`select count(*)::int as applied from drizzle.__drizzle_migrations`,
      );
      // The journal's idx counts from 0, so the build expects one more migration than its schemaVersion.
      if ((rows[0]?.applied ?? 0) <= buildInfo.schemaVersion) throw new Error("schema behind");
    }),
    check(() => options.cache.request().get(NO_ORG, "health/ready")),
  ]);
  const ready = database === "ok" && schema === "ok" && cache === "ok";
  return Response.json(
    { status: ready ? "ready" : "not ready", checks: { database, schema, cache } },
    {
      status: ready ? 200 : 503,
      headers: { "cache-control": "no-store", "shopper-version": buildInfo.version },
    },
  );
}

// A fixed UUIDv7 no shop has: the probe reads a key that is never written.
const NO_ORG = "00000000-0000-7000-8000-000000000000";

const check = (probe: () => Promise<unknown>) =>
  probe().then(
    () => "ok" as const,
    () => "error" as const,
  );
