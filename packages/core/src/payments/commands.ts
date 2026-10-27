import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as v from "valibot";
import { defineCommand, type CommandContext } from "@shopper/audit";
import {
  branch,
  org,
  payment,
  workflowRun,
  type ShopperDatabase,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { money } from "@shopper/money";
import type { WorkflowCheckpoint } from "@shopper/ports";
import { ManagementError } from "../management";
import { allocateStoreSequence } from "../sequence";
import { momoPhoneFingerprint } from "./phone";
import { momoInput } from "./schemas/momo";
import type { MomoUpdate } from "./types";

export async function startMomo(db: ShopperDatabase, context: CommandContext, raw: unknown) {
  const data = v.parse(momoInput, raw);
  const reference = data.reference ?? v7();
  return createPayment(db, context, {
    ...data,
    reference,
    phoneFingerprint: await momoPhoneFingerprint(data.phone),
  });
}

const createPayment = defineCommand({
  name: "payment.momo.started",
  async replay(
    tx,
    context,
    input: v.InferOutput<typeof momoInput> & { reference: string; phoneFingerprint: string },
  ) {
    const [row] = await tx.select().from(payment).where(eq(payment.id, input.reference));
    if (!row) return undefined;
    if (
      row.orgId !== context.orgId ||
      row.deviceId !== context.deviceId ||
      row.cashierId !== context.actorId ||
      row.amount !== input.amount ||
      row.network !== input.network ||
      row.phoneFingerprint !== input.phoneFingerprint
    )
      throw new ManagementError("Payment reference already used for another intent", 409);
    return { output: paymentView(row) };
  },
  async run(
    tx,
    context,
    input: v.InferOutput<typeof momoInput> & { reference: string; phoneFingerprint: string },
  ) {
    if (!context.actorId || !context.deviceId || !context.branchId)
      throw new Error("A cashier and device are required");
    const [shop] = await tx
      .select({ provider: org.momoProvider })
      .from(org)
      .where(eq(org.id, context.orgId));
    const [row] = await tx
      .insert(payment)
      .values({
        provider: shop!.provider,
        id: input.reference,
        reference: input.reference,
        orgId: context.orgId,
        cashierId: context.actorId,
        deviceId: context.deviceId,
        branchId: context.branchId,
        phone: `******${input.phone.slice(-4)}`,
        phoneFingerprint: input.phoneFingerprint,
        network: input.network,
        amount: money(input.amount),
      })
      .returning();
    await tx.insert(workflowRun).values({
      orgId: context.orgId,
      instanceId: input.reference,
      businessKey: input.reference,
      type: "momo-payment",
      currentStep: "created",
      status: "waiting",
    });
    // INSERT RETURNING produces exactly one row or throws.
    return paymentView(row!);
  },
  audit: (_input, output) => ({ reference: output.reference, amount: output.amount }),
});

export const updateMomo = defineCommand({
  name: "payment.momo.updated",
  run: changeMomo,
  audit: (input, output) => ({ reference: input.reference, status: output.status }),
});

/** Moves a payment to `input.status` unless it is already settled, and builds the till's `payment.updated` push. */
export async function changeMomo(
  tx: ShopperTransaction,
  context: CommandContext,
  input: MomoUpdate,
) {
  const where = and(eq(payment.orgId, context.orgId), eq(payment.reference, input.reference));
  const [current] = await tx.select().from(payment).where(where);
  if (!current) throw new Error("Payment not found");
  // Success is irreversible; a delayed provider reply must never erase collected money.
  let saved = current;
  if (
    current.status !== "confirmed" &&
    (!["failed", "expired"].includes(current.status) || input.status === "confirmed")
  ) {
    const [row] = await tx
      .update(payment)
      .set({
        status: input.status,
        providerReference: input.providerReference ?? current.providerReference,
        failureReason: ["failed", "expired", "otp"].includes(input.status)
          ? (input.message ?? null)
          : null,
        updatedAt: new Date(),
      })
      .where(where)
      .returning();
    // The tenant command lock preserves the payment selected above.
    saved = row!;
  }
  const [store] = await tx
    .select({ id: branch.storeId })
    .from(branch)
    .where(and(eq(branch.orgId, context.orgId), eq(branch.id, saved.branchId)));
  if (!store) throw new Error("Payment branch not found");
  const view = paymentView(saved);
  return {
    ...view,
    storeId: store.id,
    envelope: {
      id: v7(),
      orgId: context.orgId,
      v: 1,
      sequence: (await allocateStoreSequence(tx, context.orgId, store.id)).toString(),
      type: "payment.updated",
      payload: view,
    },
  };
}

export function paymentView(row: typeof payment.$inferSelect) {
  return {
    reference: row.reference,
    amount: row.amount,
    phone: `******${row.phone.slice(-4)}`,
    network: row.network,
    status: row.status,
    failureReason: row.failureReason,
  };
}

export const momoCheckpoint = (
  reference: string,
  step: string,
  status: WorkflowCheckpoint["status"],
): WorkflowCheckpoint => ({
  instanceId: reference,
  businessKey: reference,
  type: "momo-payment",
  step,
  status,
});

export const recordMomoDeadline = defineCommand({
  name: "payment.momo.checkpoint",
  async run(_tx, _context, input: { reference: string; deadline: number }) {
    return input;
  },
  audit: (input) => input,
});
