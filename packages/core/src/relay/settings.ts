import * as v from "valibot";
import { eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { org, relayPublished } from "@shopper/db-pg";
import { onlineSettingsInput } from "../schemas/relay";
import type { Queryable } from "../types";

/** The box's Online Orders switch and how its last publish went. */
export async function readOnlineSettings(db: Queryable, orgId: string) {
  const [row] = await db
    .select({
      onlineOrders: org.onlineOrders,
      publishedAt: org.relayPublishedAt,
      error: org.relayError,
    })
    .from(org)
    .where(eq(org.id, orgId));
  return {
    onlineOrders: row!.onlineOrders,
    publishedAt: row!.publishedAt?.toISOString() ?? null,
    error: row!.error,
  };
}

/**
 * Switches Online Orders on the box. Switching on forgets what the relay was sent, so the next publish is a full
 * snapshot: the way to repair a relay that lost its copy.
 */
export const saveOnlineSettings = defineCommand({
  name: "settings.online",
  async run(tx, context, input: { body: unknown }) {
    const next = v.parse(onlineSettingsInput, input.body);
    const before = await readOnlineSettings(tx, context.orgId);
    if (next.onlineOrders && !before.onlineOrders)
      await tx.delete(relayPublished).where(eq(relayPublished.orgId, context.orgId));
    await tx
      .update(org)
      .set({
        onlineOrders: next.onlineOrders,
        ...(next.onlineOrders &&
          !before.onlineOrders && { relayPublishedAt: null, relayError: null }),
      })
      .where(eq(org.id, context.orgId));
    return { before: before.onlineOrders, after: next.onlineOrders };
  },
  audit: (_input, output) => ({ onlineOrders: output.after }),
  details: (_input, output) => ({
    entity: "org",
    before: { onlineOrders: output.before },
    after: { onlineOrders: output.after },
  }),
});
