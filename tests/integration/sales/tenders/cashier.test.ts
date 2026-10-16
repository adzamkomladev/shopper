import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { payment, sale, user } from "@shopper/db-pg";
import { money, sub } from "@shopper/money";
import { acceptSale } from "@shopper/core/sales";
import { databases, deviceId, recordSale } from "../../../support/till/server";

test("a cashier cannot consume another cashier's confirmed MoMo payment on the same register", async () => {
  const created = await recordSale();
  const event = structuredClone(created.event);
  const { db, context } = databases();
  const reference = v7();
  await arrange(db, context, { reference, branchId: event.sale.branchId });
  event.sale.tenders = [
    { ...event.sale.tenders[0]!, amount: sub(event.sale.paid, money(100)) },
    { id: v7(), kind: "momo", amount: money(100), reference, network: "mtn" },
  ];
  await expect(
    acceptSale(
      db,
      {
        orgId: context.orgId,
        deviceId,
        branchId: event.sale.branchId,
        storeId: event.sale.storeId,
      },
      event,
      created.proof,
    ),
  ).rejects.toMatchObject({ code: "INVALID_PAYMENT" });
  expect(await db.select().from(sale).where(eq(sale.id, event.sale.id))).toEqual([]);
  expect(await db.select().from(payment).where(eq(payment.reference, reference))).toMatchObject([
    { status: "confirmed" },
  ]);
});

const arrange = defineCommand({
  name: "test.payment.other.cashier",
  async run(tx, ctx, input: { reference: string; branchId: string }) {
    const cashierId = v7();
    await tx.insert(user).values({
      id: cashierId,
      orgId: ctx.orgId,
      email: `${cashierId}@example.test`,
      name: "Another cashier",
    });
    await tx.insert(payment).values({
      orgId: ctx.orgId,
      branchId: input.branchId,
      deviceId,
      cashierId,
      reference: input.reference,
      amount: money(100),
      phone: "******4567",
      network: "mtn",
      status: "confirmed",
    });
    return { reference: input.reference };
  },
  audit: (_input, output) => output,
});
