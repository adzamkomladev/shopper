import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { branch, onlineOrder, org } from "@shopper/db-pg";
import { formatGHS } from "@shopper/money";
import type { Delivery, Json } from "@shopper/ports";
import type { StatementDeliveryDeps } from "../../customers";
import { renderEmail } from "../../emails";
import { receiptDocument } from "../../schemas/receipts/document";
import { orderMessage } from "../../schemas/orders/messages";

const clock = new Intl.DateTimeFormat("en-GH", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Africa/Accra",
});

/**
 * Tells the shopper their order is paid: a text, and a receipt email when they left an address. Each is sent once
 * and stamped on the order, so a redelivery after a half-sent message sends only what is still owed. A channel the
 * shell has no credentials for retries and, in the end, dead-letters rather than dropping the message.
 */
export async function deliverOrderConfirmation(deps: StatementDeliveryDeps, delivery: Delivery) {
  const orgId = delivery.message.orgId;
  const { orderId } = v.parse(orderMessage, delivery.message).payload;
  const [found] = await deps.db
    .select({ order: onlineOrder, shop: org.name, branchName: branch.name })
    .from(onlineOrder)
    .innerJoin(org, eq(org.id, onlineOrder.orgId))
    .innerJoin(
      branch,
      and(eq(branch.orgId, onlineOrder.orgId), eq(branch.id, onlineOrder.branchId)),
    )
    .where(and(eq(onlineOrder.orgId, orgId), eq(onlineOrder.id, orderId)));
  if (!found?.order.receipt) return await delivery.ack();
  const order = found.order;
  const context = { orgId, appVersion: deps.appVersion };
  const owesSms = !order.smsSentAt;
  const owesEmail = Boolean(order.email) && !order.emailSentAt;
  if ((owesSms && !deps.sms) || (owesEmail && (!deps.mail || !deps.renderer)))
    return await delivery.retry();
  const receipt = v.parse(receiptDocument, order.receipt);
  if (owesSms) {
    const where = order.fulfilment === "pickup" ? `Pick up at ${found.branchName}` : "We deliver";
    await deps.sms!.send(
      [order.customerPhone],
      `${found.shop}: order ${order.receiptNumber} is paid (${formatGHS(order.gross)}). ${where} on ${clock.format(order.slotStart)}.`,
    );
    await markSent(deps.db, context, { id: orderId, channel: "sms" });
  }
  if (owesEmail) {
    const pdf = await deps.renderer!.receipt(
      receipt as unknown as Json,
      { paperMm: 80, reprint: false },
      "pdf",
    );
    await deps.mail!({
      email: order.email!,
      subject: `Your order ${order.receiptNumber} from ${found.shop}`,
      link: deps.baseUrl ?? "",
      ...renderEmail({
        preheader: `Order ${order.receiptNumber} is paid, ${formatGHS(order.gross)}.`,
        shop: `${found.shop}, ${found.branchName}`,
        heading: "Thank you for your order",
        blocks: [
          {
            kind: "facts",
            rows: [
              { label: "Order", value: order.receiptNumber! },
              { label: "Paid", value: formatGHS(order.gross) },
              {
                label: order.fulfilment === "pickup" ? "Pick up" : "Delivery",
                value: clock.format(order.slotStart),
              },
            ],
          },
          { kind: "text", text: "Your receipt is attached as a PDF." },
        ],
      }),
      attachments: [
        {
          fileName: `receipt-${order.receiptNumber}.pdf`,
          contentType: "application/pdf",
          content: pdf,
        },
      ],
    });
    await markSent(deps.db, context, { id: orderId, channel: "email" });
  }
  await delivery.ack();
}

const markSent = defineCommand({
  name: "order.confirmation.sent",
  async run(tx, ctx, input: { id: string; channel: "sms" | "email" }) {
    const now = new Date();
    await tx
      .update(onlineOrder)
      .set(input.channel === "sms" ? { smsSentAt: now } : { emailSentAt: now })
      .where(and(eq(onlineOrder.orgId, ctx.orgId), eq(onlineOrder.id, input.id)));
    return input;
  },
  audit: (input) => ({ id: input.id, channel: input.channel }),
  details: (input) => ({ entity: "online_order", entityId: input.id }),
});
