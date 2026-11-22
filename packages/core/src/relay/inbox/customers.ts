import { and, asc, eq, isNull } from "drizzle-orm";
import * as v from "valibot";
import { v7 } from "uuid";
import type { CommandContext } from "@shopper/audit";
import { customer, onlineOrder, type ShopperTransaction } from "@shopper/db-pg";
import { insertCustomer } from "../../customers/commands";
import { customerInput } from "../../schemas/customers/inputs";

/**
 * Joins each newly relayed order to the in-store customer with its phone (v1.5 Day 51): the shop's oldest live record
 * for it, or a new one made from the order's name, which the tills then see like any customer. Inside the command
 * that received the orders, so a redelivered order is never linked twice.
 */
export async function linkOrderCustomers(
  tx: ShopperTransaction,
  ctx: CommandContext,
  orders: { id: string; customerName: string; customerPhone: string }[],
) {
  for (const order of orders) {
    const [known] = await tx
      .select({ id: customer.id })
      .from(customer)
      .where(
        and(
          eq(customer.orgId, ctx.orgId),
          eq(customer.phone, order.customerPhone),
          isNull(customer.mergedIntoId),
          isNull(customer.archivedAt),
        ),
      )
      .orderBy(asc(customer.id))
      .limit(1);
    const id =
      known?.id ??
      (
        await insertCustomer(
          tx,
          ctx,
          v.parse(customerInput, {
            id: v7(),
            name: order.customerName,
            phone: order.customerPhone,
          }),
        )
      ).id;
    await tx
      .update(onlineOrder)
      .set({ customerId: id })
      .where(and(eq(onlineOrder.orgId, ctx.orgId), eq(onlineOrder.id, order.id)));
  }
}
