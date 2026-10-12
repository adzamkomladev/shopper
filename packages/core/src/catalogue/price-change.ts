import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand, type CommandContext } from "@shopper/audit";
import { branch, price, product, store, type ShopperDatabase } from "@shopper/db-pg";
import { money } from "@shopper/money";
import {
  type Envelope,
  type Json,
  type Realtime,
  type Workflow,
  type WorkflowCheckpoint,
} from "@shopper/ports";
import { allocateStoreSequence } from "../sequence";
import { managementJson, ManagementError } from "../management";
import { priceView } from "./prices";
import { priceChangeParams, scheduleInput } from "../schemas/catalogue";
import { recordId } from "./records";

export interface PriceChangeDeps {
  // Each step opens its own connection: workflows outlive the request that started them.
  withDatabase<T>(run: (db: ShopperDatabase) => Promise<T>): Promise<T>;
  realtime: Realtime;
  appVersion: string;
}
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
      const sent = await flow.step(`publish-${phase}`, policy, async () => {
        const sent = await deps.withDatabase((db) =>
          publishPrice(
            db,
            context,
            { priceId: params.priceId, phase },
            checkpoint(
              flow.instanceId,
              `publish-${phase}`,
              phase === "start" ? "waiting" : "completed",
            ),
          ),
        );
        // Replays resend the checkpointed envelopes; devices dedupe by envelope id.
        for (const { storeId, envelope } of sent.envelopes)
          await deps.realtime.publish(params.orgId, storeId, envelope as unknown as Envelope);
        return sent;
      });
      // The schedule rolled back after launching: nothing to announce, so end now, not at endsAt.
      if (sent.missing) {
        await close("abandoned", "completed", "The scheduled price was never committed");
        return;
      }
    }
  } catch (error) {
    await close("failed", "failed", String(error));
    throw error;
  }
}

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

/** Builds one price.changed envelope per affected store, each with its own store sequence. */
const publishPrice = defineCommand({
  name: "price.publish",
  async run(tx, context, input: { priceId: string; phase: "start" | "end" }) {
    const [row] = await tx
      .select()
      .from(price)
      .where(and(eq(price.orgId, context.orgId), eq(price.id, input.priceId)));
    if (!row) return { missing: true, envelopes: [] };
    const stores = row.branchId
      ? await tx
          .select({ id: branch.storeId })
          .from(branch)
          .where(and(eq(branch.orgId, context.orgId), eq(branch.id, row.branchId)))
      : await tx.select({ id: store.id }).from(store).where(eq(store.orgId, context.orgId));
    const view = priceView(row);
    const envelopes = [];
    for (const { id: storeId } of stores) {
      const sequence = await allocateStoreSequence(tx, context.orgId, storeId);
      const envelope = {
        id: v7(),
        orgId: context.orgId,
        v: 1,
        sequence: sequence.toString(),
        type: "price.changed",
        // Listed field by field: a new price column must not reach devices by accident (the reason stays in the back office).
        payload: {
          priceId: view.id,
          productId: row.productId,
          phase: input.phase,
          id: view.id,
          branchId: view.branchId,
          amount: view.amount,
          validFrom: view.validFrom,
          validTo: view.validTo,
        },
      };
      envelopes.push({ storeId, envelope });
    }
    return managementJson({ missing: false, envelopes });
  },
  audit: (input, result) => ({
    priceId: input.priceId,
    phase: input.phase,
    stores: result.envelopes.length,
  }),
  details: (input, result) => ({
    entity: "price",
    entityId: input.priceId,
    after: { phase: input.phase, stores: result.envelopes.map((sent) => sent.storeId) },
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
