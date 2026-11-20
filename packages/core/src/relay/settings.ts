import * as v from "valibot";
import { eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { org, relayPublished } from "@shopper/db-pg";
import { onlineSettingsInput } from "../schemas/relay";
import type { Queryable } from "../types";

/** The box's Online Orders switch, the units it keeps back from the online store, and how its last publish went. */
export async function readOnlineSettings(db: Queryable, orgId: string) {
  const [row] = await db
    .select({
      onlineOrders: org.onlineOrders,
      buffer: org.onlineBuffer,
      publishedAt: org.relayPublishedAt,
      error: org.relayError,
    })
    .from(org)
    .where(eq(org.id, orgId));
  return {
    onlineOrders: row!.onlineOrders,
    buffer: row!.buffer / 1000,
    publishedAt: row!.publishedAt?.toISOString() ?? null,
    error: row!.error,
  };
}

/**
 * Switches Online Orders on the box. Switching on marks everything sent as stale, so the next publish is a full
 * snapshot (the way to repair a relay that lost its copy); the rows are kept so a product hidden while it was off is
 * still withdrawn.
 */
export const saveOnlineSettings = defineCommand({
  name: "settings.online",
  async run(tx, context, input: { body: unknown }) {
    const next = v.parse(onlineSettingsInput, input.body);
    const before = await readOnlineSettings(tx, context.orgId);
    if (next.onlineOrders && !before.onlineOrders)
      await tx
        .update(relayPublished)
        .set({ hash: "" })
        .where(eq(relayPublished.orgId, context.orgId));
    await tx
      .update(org)
      .set({
        onlineOrders: next.onlineOrders,
        ...(next.buffer !== undefined && { onlineBuffer: next.buffer * 1000 }),
        ...(next.onlineOrders &&
          !before.onlineOrders && { relayPublishedAt: null, relayError: null }),
      })
      .where(eq(org.id, context.orgId));
    const buffer = next.buffer ?? before.buffer;
    return { before: before.onlineOrders, after: next.onlineOrders, was: before.buffer, buffer };
  },
  audit: (_input, output) => ({ onlineOrders: output.after, buffer: output.buffer }),
  details: (_input, output) => ({
    entity: "org",
    before: { onlineOrders: output.before, buffer: output.was },
    after: { onlineOrders: output.after, buffer: output.buffer },
  }),
});
