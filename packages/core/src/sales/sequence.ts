import { saleSequenceInput } from "../schemas/sales/sequence";
import { and, eq } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand, type CommandContext } from "@shopper/audit";
import {
  sale,
  cashierSession,
  type ShopperDatabase,
  type ShopperTransaction,
} from "@shopper/db-pg";

import { allocateStoreSequence } from "../sequence";

export function assignSaleSequence(
  db: ShopperDatabase,
  context: CommandContext,
  storeId: string,
  deviceId: string,
  localId: string,
) {
  return assign(
    db,
    context,
    v.parse(saleSequenceInput, {
      storeId,
      deviceId,
      localId,
    }),
  );
}
// `defineCommand` hands `run` the same input `replay` just looked up, inside the same transaction.
const replayed = new WeakMap<object, Awaited<ReturnType<typeof acceptedSale>>>();
const assign = defineCommand({
  name: "sale.assign-sequence",
  async replay(tx, ctx, input: { storeId: string; deviceId: string; localId: string }) {
    const saved = await acceptedSale(tx, ctx.orgId, input);
    replayed.set(input, saved);
    return saved.storeSequence === null ? undefined : { output: saved.storeSequence };
  },
  async run(tx, ctx, input) {
    const saved = replayed.get(input) ?? (await acceptedSale(tx, ctx.orgId, input));
    ctx.actorId = saved.cashierId;
    ctx.deviceId = saved.deviceId;
    ctx.branchId = saved.branchId;
    ctx.deviceTime = saved.deviceTime;
    ctx.appVersion = saved.appVersion;
    ctx.role = saved.roleName;
    const sequence = await allocateStoreSequence(tx, ctx.orgId, input.storeId);
    await tx
      .update(sale)
      .set({ storeSequence: sequence })
      .where(and(eq(sale.orgId, ctx.orgId), eq(sale.id, saved.id)));
    return sequence;
  },
  audit: (input, output) => ({
    localId: input.localId,
    storeId: input.storeId,
    sequence: output.toString(),
  }),
  details: (input) => ({ entity: "sale", entityId: input.localId }),
});
async function acceptedSale(
  tx: ShopperTransaction,
  orgId: string,
  input: { storeId: string; deviceId: string; localId: string },
) {
  const [found] = await tx
    .select({ sale, roleName: cashierSession.roleName })
    .from(sale)
    // The accepted sale has a tenant-scoped foreign key to its cashier session.
    .innerJoin(
      cashierSession,
      and(eq(cashierSession.orgId, sale.orgId), eq(cashierSession.id, sale.sessionId)),
    )
    .where(
      and(
        eq(sale.orgId, orgId),
        eq(sale.storeId, input.storeId),
        eq(sale.deviceId, input.deviceId),
        eq(sale.localId, input.localId),
      ),
    );
  if (!found) throw new Error("Accepted sale does not belong to this tenant/device/store");
  return { ...found.sale, roleName: found.roleName };
}
