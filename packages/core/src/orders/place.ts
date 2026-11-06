import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand, type CommandContext } from "@shopper/audit";
import {
  branch,
  onlineOrder,
  onlineOrderLine,
  type ShopperDatabase,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { money } from "@shopper/money";
import type { Json } from "@shopper/ports";
import { sha256 } from "@shopper/utils";
import { allocateStoreSequence } from "../sequence";
import { placeOrderInput, type PlaceOrderInput } from "../schemas/orders/place";
import { quoteCart } from "../storefront/cart";
import { OrderError } from "./error";
import { reserveStock } from "./holds";
import { readFulfilment, slotStarts, takenSlots } from "./slots";
import { orderByDigest } from "./view";

/** How long an unpaid order keeps its stock: the time a shopper has to pay. */
export const HOLD_MINUTES = 30;

type Deps = {
  /** Starts the order's workflow inside the placing transaction: a rollback leaves the flow nothing to find. */
  launch: (instanceId: string, params: Json) => Promise<void>;
  /** The signed-in shopper's account, linked to the order when there is one. */
  accountId?: string | null;
  now?: Date;
};

/**
 * A guest checkout at one branch, in one transaction: the slot must be open with a place left, every line priced and
 * available as the cart showed it, the stock held for HOLD_MINUTES, and the order numbered from the store's sequence.
 * Sending the same checkout key again returns the order it already placed. Nothing is paid yet, so nothing is posted.
 */
export async function placeOrder(
  db: ShopperDatabase,
  context: CommandContext,
  raw: unknown,
  deps: Deps,
) {
  const input = v.parse(placeOrderInput, raw);
  return placeCommand(db, context, {
    input,
    digest: await sha256(input.key),
    accountId: deps.accountId ?? null,
    now: deps.now ?? new Date(),
    launch: deps.launch,
  });
}

type Placing = Omit<Deps, "now" | "accountId"> & {
  input: PlaceOrderInput;
  digest: string;
  accountId: string | null;
  now: Date;
};

const placeCommand = defineCommand({
  name: "order.place",
  replay: async (tx, context, placing: Placing) => {
    const found = await orderByDigest(tx, context.orgId, placing.digest);
    return found ? { output: found } : undefined;
  },
  async run(tx, context, placing: Placing) {
    const { input, now } = placing;
    const fulfilment = await readFulfilment(tx, context.orgId, input.branch);
    if (!fulfilment?.[input.fulfilment])
      throw new OrderError(
        "closed",
        input.fulfilment === "delivery"
          ? "This branch does not deliver. Choose pickup."
          : "This branch does not take pickup orders.",
      );
    const slot = slotStarts(fulfilment, now).find((at) => at.getTime() === input.slot.getTime());
    if (!slot) throw new OrderError("slot", "That time is no longer open. Pick another.");
    const taken = (await takenSlots(tx, context.orgId, input.branch, [slot])).get(slot.getTime());
    if ((taken ?? 0) >= fulfilment.slotCapacity)
      throw new OrderError("slot", "That time just filled up. Pick another.");
    const quote = await quoteCart(tx, context.orgId, input, now);
    const unsold = quote.lines.filter((line) => line.problem).map((line) => line.productId);
    if (unsold.length) throw stockError(unsold);
    const id = v7();
    const holdExpiresAt = new Date(now.getTime() + HOLD_MINUTES * 60_000);
    const storeId = await storeOf(tx, context.orgId, input.branch);
    const cursor = await allocateStoreSequence(tx, context.orgId, storeId);
    await tx.insert(onlineOrder).values({
      id,
      orgId: context.orgId,
      storeId,
      branchId: input.branch,
      inboxCursor: cursor,
      fulfilment: input.fulfilment,
      slotStart: slot,
      slotEnd: new Date(slot.getTime() + fulfilment.slotMinutes * 60_000),
      deliveryAddress: input.fulfilment === "delivery" ? (input.address ?? null) : null,
      customerName: input.name,
      customerPhone: input.phone,
      shopAccountId: placing.accountId,
      viewTokenDigest: placing.digest,
      ...pick(quote.totals),
      holdExpiresAt,
      placedAt: now,
    });
    const products = quote.lines.map((line, index) => ({
      orgId: context.orgId,
      orderId: id,
      position: index + 1,
      kind: "product" as const,
      productId: line.productId,
      priceId: line.priceId,
      quantityThousandths: line.quantityThousandths,
      gross: line.tax!.gross,
      payload: { name: line.name, sku: line.sku, baseUnit: line.baseUnit, tax: line.tax },
    }));
    const delivery = quote.delivery
      ? [
          {
            orgId: context.orgId,
            orderId: id,
            position: products.length + 1,
            kind: "delivery" as const,
            productId: null,
            priceId: null,
            quantityThousandths: 1_000,
            gross: quote.delivery.gross,
            payload: { name: "Delivery", tax: quote.delivery },
          },
        ]
      : [];
    await tx.insert(onlineOrderLine).values([...products, ...delivery]);
    // The holds name the order, so they go in after it; a short line rolls the whole order back.
    const held = await reserveStock(tx, context.orgId, {
      branchId: input.branch,
      orderId: id,
      lines: input.lines,
      expiresAt: holdExpiresAt,
      now,
    });
    if (held.short.length) throw stockError(held.short);
    await placing.launch(id, { orgId: context.orgId, id });
    return (await orderByDigest(tx, context.orgId, placing.digest))!;
  },
  audit: (placing, order) => ({
    id: order.id,
    number: order.number,
    branchId: order.branch.id,
    fulfilment: order.fulfilment,
    slotStart: order.slotStart,
    gross: order.totals.gross,
    lines: placing.input.lines.length,
    customerPhone: placing.input.phone,
  }),
  details: (_placing, order) => ({ entity: "online_order", entityId: order.id }),
});

const stockError = (products: string[]) =>
  new OrderError("stock", "Some items are no longer available in that amount", 409, products);

const pick = (totals: Record<"base" | "vat" | "nhil" | "getfund" | "covid" | "gross", number>) => ({
  base: money(totals.base),
  vat: money(totals.vat),
  nhil: money(totals.nhil),
  getfund: money(totals.getfund),
  covid: money(totals.covid),
  gross: money(totals.gross),
});

async function storeOf(tx: ShopperTransaction, orgId: string, branchId: string) {
  const [row] = await tx
    .select({ storeId: branch.storeId })
    .from(branch)
    .where(and(eq(branch.orgId, orgId), eq(branch.id, branchId)));
  if (!row) throw new OrderError("not_found", "We could not find that branch");
  return row.storeId;
}
