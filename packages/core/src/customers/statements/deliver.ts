import { and, eq, ne } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import { customer, statementDelivery, statementLink } from "@shopper/db-pg";
import { sub, money, toDecimal } from "@shopper/money";
import type { Delivery, Json } from "@shopper/ports";
import { formatDay } from "@shopper/utils";
import { statementMessage, type StatementDocument } from "../../schemas/customers/statements";
import { readStatementDocument } from "./document";
import { signStatementToken, statementLinkUrl } from "./links";
import type { StatementDeliveryDeps } from "./types";

/**
 * Sends a queued statement over its channel, once. A sent row is acknowledged without sending; a failure is
 * recorded on the row and retried, and a later success marks it sent. The send precedes the audited `sent`
 * write, so a crash between them can send twice, never zero.
 */
export async function deliverStatement(deps: StatementDeliveryDeps, delivery: Delivery) {
  const { db, appVersion } = deps;
  let target: { orgId: string; deliveryId: string } | undefined;
  try {
    const { orgId, payload } = v.parse(statementMessage, delivery.message);
    target = { orgId, deliveryId: payload.deliveryId };
    const [row] = await db
      .select({
        delivery: statementDelivery,
        phone: customer.phone,
        email: customer.email,
        expiresAt: statementLink.expiresAt,
      })
      .from(statementDelivery)
      .innerJoin(
        customer,
        and(
          eq(customer.orgId, statementDelivery.orgId),
          eq(customer.id, statementDelivery.customerId),
        ),
      )
      .innerJoin(
        statementLink,
        and(
          eq(statementLink.orgId, statementDelivery.orgId),
          eq(statementLink.id, statementDelivery.linkId),
        ),
      )
      .where(and(eq(statementDelivery.orgId, orgId), eq(statementDelivery.id, payload.deliveryId)));
    if (!row || row.delivery.status === "sent") return await delivery.ack();
    if (!deps.linkSecret || !deps.baseUrl) throw new Error("Statement links are not configured");
    const { customerId, periodFrom: from, periodTo: to, linkId } = row.delivery;
    const document = await readStatementDocument(db, orgId, customerId, { from, to });
    const link = statementLinkUrl(
      deps.baseUrl,
      await signStatementToken(deps.linkSecret, {
        linkId: linkId!,
        orgId,
        customerId,
        from,
        to,
        exp: row.expiresAt.getTime(),
      }),
    );
    const reference =
      row.delivery.channel === "email"
        ? await email(deps, row.email!, document, link)
        : await text(deps, row.phone, document, link);
    await markSent(db, { orgId, appVersion }, { deliveryId: payload.deliveryId, reference });
    await delivery.ack();
  } catch (error) {
    console.error({
      event: "statement.deliver_failed",
      attempts: delivery.attempts,
      error,
    });
    if (target)
      await markFailed(
        db,
        { orgId: target.orgId, appVersion },
        { deliveryId: target.deliveryId },
      ).catch((failure: unknown) =>
        console.error({ event: "statement.mark_failed_failed", failure }),
      );
    await delivery.retry();
  }
}

async function email(
  { mail, renderer }: StatementDeliveryDeps,
  address: string,
  document: StatementDocument,
  link: string,
) {
  if (!mail || !renderer) throw new Error("Email statements are not configured");
  const { shop, period, closing } = document;
  const pdf = await renderer.statement(document as unknown as Json);
  return mail({
    email: address,
    subject: `Your statement from ${shop.name}, ${formatDay(period.from)} to ${formatDay(period.to)}`,
    link,
    plain:
      `Hello ${document.customer.name},\n\nYour statement from ${shop.name} for ` +
      `${formatDay(period.from)} to ${formatDay(period.to)} is attached. Closing balance: GHS ${toDecimal(closing)}${closing < 0 ? " (credit)" : ""}.\n\n` +
      `View it online: ${link}`,
    attachments: [
      {
        fileName: `statement-${period.from}-${period.to}.pdf`,
        contentType: "application/pdf",
        content: pdf,
      },
    ],
  });
}

async function text(
  { sms }: StatementDeliveryDeps,
  phone: string,
  { shop, period, closing, entries }: StatementDocument,
  link: string,
) {
  if (!sms) throw new Error("SMS statements are not configured");
  const payment = [...entries].reverse().find((entry) => entry.kind === "payment");
  const owed =
    closing < 0
      ? `you have GHS ${toDecimal(sub(money(0), closing))} credit`
      : `you owe GHS ${toDecimal(closing)}`;
  const paid = payment
    ? `, last payment GHS ${toDecimal(sub(money(0), payment.amount))} on ${formatDay(payment.occurredAt, false)}`
    : "";
  return sms.send(
    [phone],
    `${shop.name}: ${owed} as of ${formatDay(period.to)}${paid}. Statement: ${link}`,
  );
}

const markSent = defineCommand({
  name: "statement.delivery.sent",
  async run(tx, ctx, input: { deliveryId: string; reference?: string }) {
    const [row] = await tx
      .update(statementDelivery)
      .set({
        status: "sent",
        providerReference: input.reference ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(eq(statementDelivery.orgId, ctx.orgId), eq(statementDelivery.id, input.deliveryId)),
      )
      .returning({ id: statementDelivery.id, customerId: statementDelivery.customerId });
    return row!;
  },
  audit: (input, output) => ({
    ...output,
    deliveryId: input.deliveryId,
    reference: input.reference,
  }),
  details: (_input, output) => ({ entity: "customer", entityId: output.customerId }),
});

const markFailed = defineCommand({
  name: "statement.delivery.failed",
  async run(tx, ctx, input: { deliveryId: string }) {
    const [row] = await tx
      .update(statementDelivery)
      .set({ status: "failed", updatedAt: new Date() })
      .where(
        and(
          eq(statementDelivery.orgId, ctx.orgId),
          eq(statementDelivery.id, input.deliveryId),
          ne(statementDelivery.status, "sent"),
        ),
      )
      .returning({ id: statementDelivery.id, customerId: statementDelivery.customerId });
    return { deliveryId: input.deliveryId, customerId: row?.customerId };
  },
  audit: (_input, output) => ({ ...output }),
  details: (_input, output) => ({ entity: "customer", entityId: output.customerId }),
});
