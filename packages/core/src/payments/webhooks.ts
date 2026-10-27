import { and, eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { paymentEvent, type momoProviders } from "@shopper/db-pg";
import { changeMomo } from "./commands";
import type { MomoUpdate } from "./types";

type Applied =
  | { duplicate: true }
  | ({ duplicate: false } & Awaited<ReturnType<typeof changeMomo>>);
type ProviderEvent = {
  provider: (typeof momoProviders)[number];
  /** The provider's identity for this event: a replay carries the same key. */
  key: string;
  kind: string;
};

/**
 * Applies a provider callback to its payment exactly once. The event's key is written in the transaction that
 * applies it, so a replay returns `duplicate` and the caller publishes and wakes nothing.
 */
export const applyMomoEvent = defineCommand({
  name: "payment.webhook.applied",
  async replay(
    tx,
    context,
    input: ProviderEvent & MomoUpdate,
  ): Promise<{ output: Applied } | undefined> {
    const [seen] = await tx
      .select({ id: paymentEvent.id })
      .from(paymentEvent)
      .where(
        and(
          eq(paymentEvent.orgId, context.orgId),
          eq(paymentEvent.provider, input.provider),
          eq(paymentEvent.key, input.key),
        ),
      );
    return seen ? { output: { duplicate: true } } : undefined;
  },
  async run(tx, context, input: ProviderEvent & MomoUpdate): Promise<Applied> {
    await tx.insert(paymentEvent).values({
      orgId: context.orgId,
      provider: input.provider,
      key: input.key,
      reference: input.reference,
      kind: input.kind,
    });
    return { duplicate: false as const, ...(await changeMomo(tx, context, input)) };
  },
  audit: (input, output) => ({
    reference: input.reference,
    provider: input.provider,
    kind: input.kind,
    ...(output.duplicate ? {} : { status: output.status }),
  }),
});
