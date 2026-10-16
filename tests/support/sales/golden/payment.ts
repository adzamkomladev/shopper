import { v7 } from "uuid";
import { defineCommand as pgCommand } from "@shopper/audit";
import { payment } from "@shopper/db-pg";
import { applyDraftPayment } from "@shopper/core/till";
import { money } from "@shopper/money";
import type { goldenWorld } from "./setup";
import { at } from "./setup";

// The provider workflow has its own conformance suite; this fixture starts at its confirmed result.
export async function confirmedPayment(
  world: Awaited<ReturnType<typeof goldenWorld>>,
  expectedRevision: number,
  amount: number,
) {
  const reference = v7();
  await confirmed(world.db, world.command, { reference, amount });
  await applyDraftPayment(world.local, world.command, {
    scope: world.scope,
    expectedRevision,
    at,
    reference,
    amount,
    phone: "******4567",
    network: "mtn",
    status: "confirmed",
  });
}

const confirmed = pgCommand({
  name: "golden.test.payment.confirm",
  async run(tx, ctx, input: { reference: string; amount: number }) {
    if (!ctx.branchId || !ctx.deviceId || !ctx.actorId)
      throw new Error("Golden payment requires register and cashier scope");
    await tx.insert(payment).values({
      orgId: ctx.orgId,
      branchId: ctx.branchId,
      deviceId: ctx.deviceId,
      cashierId: ctx.actorId,
      reference: input.reference,
      amount: money(input.amount),
      phone: "******4567",
      network: "mtn",
      status: "confirmed",
    });
    return {};
  },
  audit: (input) => ({ reference: input.reference, amount: input.amount }),
});
