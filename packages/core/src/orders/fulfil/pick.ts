import { and, eq } from "drizzle-orm";
import * as v from "valibot";
import { v7 } from "uuid";
import { defineCommand, enqueueAfterCommit } from "@shopper/audit";
import { onlineOrder, onlineOrderPick, type ShopperTransaction } from "@shopper/db-pg";
import { snapshotAmount } from "@shopper/tax";
import { pickInput } from "../../schemas/orders/pick";
import { quoteCart } from "../../storefront/cart";
import { OrderError } from "../error";
import { move, readOrder } from "../flow";
import { readGoods, settleAdjustment } from "./adjust";
import { recordStatus } from "./events";
import { goodsOf, quoteMissing } from "./goods";

const conflict = (message: string) => new OrderError("conflict", message);

/** The picker takes an accepted order in hand. */
export const startPicking = defineCommand({
  name: "order.picking",
  async run(tx, ctx, input: { id: string }) {
    const moved = await move(tx, ctx.orgId, input.id, "accepted", "picking");
    if (!moved) throw conflict("This order is not waiting to be picked.");
    await recordStatus(tx, ctx, input.id, "picking");
    return { moved };
  },
  audit: (input) => ({ id: input.id }),
  details: (input) => ({ entity: "online_order", entityId: input.id }),
});

/**
 * Records what the picker found for one line: all of it, some of it (the rest is short), or some of it with a
 * substitute for the rest. The substitute is priced and taxed now and never costs the shopper more than the missing
 * quantity would have: a dearer one is charged at the missing quantity's price. Recording again replaces the pick.
 */
export const recordPick = defineCommand({
  name: "order.pick",
  async run(tx, ctx, raw: v.InferInput<typeof pickInput>) {
    const input = v.parse(pickInput, raw);
    const order = await readOrder(tx, ctx.orgId, input.id);
    if (order.status !== "picking") throw conflict("This order is not being picked.");
    const { lines } = await readGoods(tx, ctx.orgId, order.id);
    const line = lines.find((row) => row.id === input.lineId && row.productId);
    if (!line) throw new OrderError("not_found", "That item is not on this order");
    if (input.pickedThousandths > line.quantityThousandths)
      throw conflict("More was picked than was ordered.");
    const missing = line.quantityThousandths - input.pickedThousandths;
    if (input.substitute && missing === 0) throw conflict("Nothing is missing to substitute.");
    const substitute = input.substitute
      ? await substituteFor(tx, ctx.orgId, order, line, missing, input.substitute)
      : null;
    const values = {
      pickedThousandths: input.pickedThousandths,
      outcome: substitute
        ? ("substituted" as const)
        : missing
          ? ("short" as const)
          : ("picked" as const),
      substituteProductId: substitute?.productId ?? null,
      substituteQuantityThousandths: substitute?.quantityThousandths ?? null,
      substituteGross: substitute?.gross ?? null,
      substitutePayload: substitute?.payload ?? null,
      pickerId: ctx.actorId ?? null,
      pickedAt: new Date(),
    };
    await tx
      .insert(onlineOrderPick)
      .values({ orgId: ctx.orgId, orderId: order.id, lineId: line.id, ...values })
      .onConflictDoUpdate({
        target: [onlineOrderPick.orgId, onlineOrderPick.orderId, onlineOrderPick.lineId],
        set: values,
      });
    return { outcome: values.outcome };
  },
  audit: (input, output) => ({
    id: input.id,
    lineId: input.lineId,
    picked: input.pickedThousandths,
    substitute: input.substitute?.productId ?? null,
    ...output,
  }),
  details: (input) => ({ entity: "online_order", entityId: input.id }),
});

/** The substitute as the shopper will be charged for it: the till's own quote, capped at the missing goods' price. */
async function substituteFor(
  tx: ShopperTransaction,
  orgId: string,
  order: typeof onlineOrder.$inferSelect,
  line: Awaited<ReturnType<typeof readGoods>>["lines"][number],
  missing: number,
  wanted: { productId: string; quantityThousandths: number },
) {
  const quote = await quoteCart(
    tx,
    orgId,
    { branch: order.branchId, fulfilment: "pickup", lines: [wanted] },
    new Date(),
  );
  const found = quote.lines[0]!;
  if (found.problem === "unavailable" || !found.tax)
    throw new OrderError("stock", "That product is not sold online here.", 409, [wanted.productId]);
  if (found.problem === "short")
    throw new OrderError("stock", "There is not enough of that product to substitute.", 409, [
      wanted.productId,
    ]);
  const worth = quoteMissing((line.payload as { tax: typeof found.tax }).tax, missing);
  const tax =
    found.tax.gross <= worth.gross
      ? found.tax
      : capped(found.tax, worth.gross, wanted.quantityThousandths);
  return {
    productId: wanted.productId,
    quantityThousandths: wanted.quantityThousandths,
    gross: tax.gross,
    payload: { name: found.name, sku: found.sku, baseUnit: found.baseUnit, tax },
  };
}

function capped(
  tax: NonNullable<Awaited<ReturnType<typeof quoteCart>>["lines"][number]["tax"]>,
  gross: typeof tax.gross,
  quantityThousandths: number,
) {
  if (tax.priceMode !== "inclusive")
    throw conflict("That substitute costs more than the item it replaces. Pick a smaller amount.");
  return snapshotAmount({ ...tax, quantityThousandths, gross });
}

/**
 * The pick is done: every item has been looked at. If it changed the order, the adjustment (stock, books, documents,
 * refund) is made in this same transaction. The order is then ready for the shopper.
 */
export const finishPicking = defineCommand({
  name: "order.picked",
  async run(tx, ctx, input: { id: string }) {
    const order = await readOrder(tx, ctx.orgId, input.id);
    if (order.status !== "picking") throw conflict("This order is not being picked.");
    const { lines, picks } = await readGoods(tx, ctx.orgId, order.id);
    const products = lines.filter((line) => line.productId);
    if (products.some((line) => !picks.some((pick) => pick.lineId === line.id)))
      throw conflict("Check every item before finishing.");
    const goods = goodsOf(lines, picks);
    if (![...goods.kept, ...goods.substitutes].some((item) => item.productId))
      throw conflict("Nothing was picked. Cancel the order instead.");
    const now = new Date();
    const adjusted = await settleAdjustment(tx, ctx, order, now);
    await tx
      .update(onlineOrder)
      .set({ status: "ready", readyAt: now, updatedAt: now })
      .where(and(eq(onlineOrder.orgId, ctx.orgId), eq(onlineOrder.id, order.id)));
    await recordStatus(tx, ctx, order.id, "ready", now);
    enqueueAfterCommit(tx, {
      id: v7(),
      orgId: ctx.orgId,
      v: 1,
      sequence: "0",
      type: "order.status",
      payload: { orderId: order.id, status: "ready" },
    });
    return { adjusted: adjusted !== null, refund: adjusted?.refundAmount ?? 0 };
  },
  audit: (input, output) => ({ id: input.id, ...output }),
  details: (input) => ({ entity: "online_order", entityId: input.id }),
});
