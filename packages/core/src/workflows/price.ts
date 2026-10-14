import type { PriceChangeDeps } from "./types";
export type { PriceChangeDeps } from "./types";
import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand, type CommandContext } from "@shopper/audit";
import { price, product, type ShopperDatabase } from "@shopper/db-pg";
import { money } from "@shopper/money";
import { type Json, type Workflow, type WorkflowCheckpoint } from "@shopper/ports";
import { affectedStores, priceUpsert, recordChanges } from "../changes";
import { managementJson, ManagementError } from "../management";
import { priceView } from "../catalogue/prices/commands";
import { publishPrice } from "../catalogue/prices/publish";
import { priceChangeParams, scheduleInput } from "../schemas/catalogue/inputs";
import { recordId } from "../catalogue/records";

const policy = { maxAttempts: 5, delayMs: 1000, backoff: "exponential" } as const;

/** The scheduled price change, shared by Cloudflare Workflows and the box engine. */
export async function runPriceChange(
  flow: Pick<Workflow, "instanceId" | "step" | "sleepUntil">,
  deps: PriceChangeDeps,
  rawParams: unknown,
) {
  const params = v.parse(priceChangeParams, rawParams);
  const context = { orgId: params.orgId, actorId: params.actorId, appVersion: deps.appVersion };
  // Closes the run in PostgreSQL so workflow_run never claims a dead flow is still waiting.
  const close = (step: string, status: "completed" | "failed", reason: string) =>
    flow.step(step, policy, () =>
      deps.withDatabase((db) =>
        endPriceChange(
          db,
          context,
          { instanceId: flow.instanceId, reason },
          checkpoint(flow.instanceId, step, status),
        ),
      ),
    );
  try {
    for (const phase of ["start", "end"] as const) {
      await flow.sleepUntil(phase, phase === "start" ? params.startsAt : params.endsAt);
      const sent = await flow.step(`publish-${phase}`, policy, () =>
        deps.withDatabase((db) =>
          publishPrice(
            db,
            context,
            { priceId: params.priceId, phase },
            checkpoint(flow.instanceId, `publish-${phase}`, "waiting"),
          ),
        ),
      );
      // The schedule rolled back after launching: nothing to announce, so end now, not at endsAt.
      if (sent.missing) {
        await close("abandoned", "completed", "The scheduled price was never committed");
        return;
      }
      await flow.step(`notify-${phase}`, policy, async () => {
        for (const { storeId, envelope } of sent.envelopes)
          await deps.realtime.publish(params.orgId, storeId, envelope);
        return deps.withDatabase((db) =>
          notifyPrice(
            db,
            context,
            { priceId: params.priceId, phase },
            checkpoint(
              flow.instanceId,
              `notify-${phase}`,
              phase === "start" ? "waiting" : "completed",
            ),
          ),
        );
      });
    }
  } catch (error) {
    await close("failed", "failed", String(error));
    throw error;
  }
}

const notifyPrice = defineCommand({
  name: "price.notified",
  run: async (_tx, _context, input: { priceId: string; phase: "start" | "end" }) => input,
  audit: (input) => input,
});

const endPriceChange = defineCommand({
  name: "price.change_ended",
  run: async (_tx, _context, input: { instanceId: string; reason: string }) => ({
    reason: input.reason,
  }),
  audit: (input) => ({ instanceId: input.instanceId, reason: input.reason }),
});

export const priceChangeId = (orgId: string, priceId: string) => `price-change_${orgId}_${priceId}`;

/**
 * Appends a windowed price version and records the workflow as waiting, in one transaction.
 * The launch happens inside that transaction: if it rolls back, the flow finds no price.
 */
export function schedulePrice(
  db: ShopperDatabase,
  context: CommandContext,
  input: { productId: string; data: unknown; launch: (id: string, params: Json) => Promise<void> },
) {
  const productId = recordId(input.productId);
  const data = v.parse(scheduleInput, input.data);
  const priceId = v7();
  const instanceId = priceChangeId(context.orgId.toLowerCase(), priceId);
  return scheduleCommand(
    db,
    context,
    { productId, priceId, data, launch: input.launch },
    checkpoint(instanceId, "schedule", "waiting"),
  );
}
const scheduleCommand = defineCommand({
  name: "price.schedule",
  async run(
    tx,
    context,
    input: {
      productId: string;
      priceId: string;
      data: v.InferOutput<typeof scheduleInput>;
      launch: (id: string, params: Json) => Promise<void>;
    },
  ) {
    const [found] = await tx
      .select({ id: product.id })
      .from(product)
      .where(and(eq(product.orgId, context.orgId), eq(product.id, input.productId)));
    if (!found) throw new ManagementError("Record not found");
    const [row] = await tx
      .insert(price)
      .values({
        id: input.priceId,
        orgId: context.orgId,
        productId: input.productId,
        branchId: input.data.branchId,
        amount: money(input.data.amount),
        validFrom: input.data.startsAt,
        validTo: input.data.endsAt,
        reason: context.reason,
      })
      .returning();
    // The price carries its window, so tills hold it from now and resolve it by their own clock.
    await recordChanges(
      tx,
      context.orgId,
      [priceUpsert(row!)],
      await affectedStores(tx, context.orgId, row!.branchId),
    );
    const workflowId = priceChangeId(context.orgId, row!.id);
    await input.launch(workflowId, {
      orgId: context.orgId,
      priceId: row!.id,
      ...(context.actorId ? { actorId: context.actorId } : {}),
      startsAt: input.data.startsAt.toISOString(),
      endsAt: input.data.endsAt.toISOString(),
    });
    return managementJson({ price: priceView(row!), workflowId });
  },
  audit: (input, result) => ({ productId: input.productId, priceId: result.price.id }),
  details: (input, result) => ({
    entity: "price",
    entityId: result.price.id,
    before: null,
    after: { productId: input.productId, ...result.price },
  }),
});

const checkpoint = (
  instanceId: string,
  step: string,
  status: WorkflowCheckpoint["status"],
): WorkflowCheckpoint => ({
  instanceId,
  businessKey: instanceId,
  type: "price-change",
  step,
  status,
});
