import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { Hono } from "hono";
import type { BoxBindings } from "./types";

/** Where the box's registers find their updates: what the handshake hands them, on the box's own origin. */
export const TILL_FEED = "/till/updates";

/**
 * The till feed of the running slot (`<release>/till/<channel>/`, signed with the rest of the slot), laid out as the
 * cloud's bucket is: `latest.yml` beside its installer. A box LAN has no route to the cloud feed, so an update bundle
 * carries the tills' update and the registers take it from here.
 */
export function withTillFeed(
  app: Hono<{ Bindings: BoxBindings }>,
  env: Record<string, string | undefined>,
) {
  const release = env.SHOPPER_RELEASE_DIR ?? "/opt/shopper/current";
  return new Hono<{ Bindings: BoxBindings }>()
    .get(`${TILL_FEED}/:channel{pilot|stable}/:file{[A-Za-z0-9][A-Za-z0-9._-]*}`, async (c) => {
      const path = join(release, "till", c.req.param("channel"), c.req.param("file"));
      const found = await stat(path).catch(() => undefined);
      if (!found?.isFile()) return c.notFound();
      return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream, {
        headers: { "content-length": String(found.size), "cache-control": "no-cache" },
      });
    })
    .all("*", (c) => app.fetch(c.req.raw, c.env));
}
