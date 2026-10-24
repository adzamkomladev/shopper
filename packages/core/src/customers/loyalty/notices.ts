import { and, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { v7 } from "uuid";
import * as v from "valibot";
import { defineCommand, enqueueAfterCommit, type CommandContext } from "@shopper/audit";
import { customer, loyaltyTier, org, tierNotice, type ShopperTransaction } from "@shopper/db-pg";
import type { Delivery } from "@shopper/ports";
import { formatDay } from "@shopper/utils";
import { tierNoticeMessage } from "../../schemas/customers/accounts";
import type { StatementDeliveryDeps } from "../statements/types";
import type { Queryable } from "../../types";
import { readCustomerRow } from "../queries";
import { readLoyaltySettings } from "./settings";
import { readTierProjection } from "./tiers";

const DAY = 86_400_000;
type Input = { customerId: string; at: Date };

/**
 * Tells a customer, once, that their tier is about to drop: re-projects at `at` (a sale since may have kept the
 * tier) and, from `tier_notice_days` before the drop, records a `tier_notice` and queues its message.
 */
export const sendTierNotice = defineCommand({
  name: "loyalty.tier.notice",
  async replay(tx, ctx, input: Input) {
    const due = await dueNotice(tx, ctx, input);
    return due.notice ? undefined : { output: { customerId: due.customerId, sent: false } };
  },
  async run(tx, ctx, input) {
    const { customerId, notice } = await dueNotice(tx, ctx, input);
    if (!notice) return { customerId, sent: false };
    const [row] = await tx
      .insert(tierNotice)
      .values({
        orgId: ctx.orgId,
        customerId,
        fromTierId: notice.from.id,
        toTierId: notice.to?.id ?? null,
        effectiveOn: notice.effectiveOn,
      })
      .returning({ id: tierNotice.id });
    enqueueAfterCommit(tx, {
      id: v7(),
      orgId: ctx.orgId,
      v: 1,
      sequence: "0",
      type: "tier.notice",
      payload: { noticeId: row!.id },
    });
    return {
      customerId,
      sent: true,
      noticeId: row!.id,
      effectiveOn: notice.effectiveOn,
      from: notice.from.name,
      to: notice.to?.name ?? null,
    };
  },
  audit: (_input, output) => ({ ...output }),
  details: (_input, output) => ({ entity: "customer", entityId: output.customerId }),
});

/** When the next notice falls due, or null: none projected, notices off, or this one already recorded. */
export async function nextNoticeAt(db: Queryable, orgId: string, customerId: string, now: Date) {
  const { enabled, tierNoticeDays } = await readLoyaltySettings(db, orgId);
  if (!enabled || tierNoticeDays === 0) return null;
  const projected = await readTierProjection(db, orgId, customerId, now);
  if (!projected || (await recorded(db, orgId, customerId, projected.from.id, day(projected.on))))
    return null;
  return new Date(projected.on.getTime() - tierNoticeDays * DAY);
}

/** Sends a queued notice by email when the customer has one (and the shell can mail), else by SMS; then marks it. */
export async function deliverTierNotice(deps: StatementDeliveryDeps, delivery: Delivery) {
  try {
    const { orgId, payload } = v.parse(tierNoticeMessage, delivery.message);
    const from = alias(loyaltyTier, "from_tier");
    const to = alias(loyaltyTier, "to_tier");
    const [row] = await deps.db
      .select({
        notice: tierNotice,
        phone: customer.phone,
        email: customer.email,
        shop: org.name,
        from: from.name,
        to: to.name,
      })
      .from(tierNotice)
      .innerJoin(
        customer,
        and(eq(customer.orgId, tierNotice.orgId), eq(customer.id, tierNotice.customerId)),
      )
      .innerJoin(org, eq(org.id, tierNotice.orgId))
      .innerJoin(from, and(eq(from.orgId, tierNotice.orgId), eq(from.id, tierNotice.fromTierId)))
      .leftJoin(to, and(eq(to.orgId, tierNotice.orgId), eq(to.id, tierNotice.toTierId)))
      .where(and(eq(tierNotice.orgId, orgId), eq(tierNotice.id, payload.noticeId)));
    if (!row || row.notice.sentAt) return await delivery.ack();
    const when = formatDay(row.notice.effectiveOn, false);
    const text = `${row.shop}: Your ${row.from} tier ${row.to ? `changes to ${row.to}` : "ends"} on ${when}.`;
    const channel = row.email && deps.mail ? "email" : "sms";
    if (channel === "email")
      await deps.mail!({
        email: row.email!,
        subject: text,
        link: "",
        plain: text,
        attachments: [],
      });
    else if (deps.sms) await deps.sms.send([row.phone], text);
    else throw new Error("Tier notices need SMS or email");
    await markSent(deps.db, { orgId, appVersion: deps.appVersion }, { id: row.notice.id, channel });
    await delivery.ack();
  } catch (error) {
    console.error({ event: "tier_notice.deliver_failed", attempts: delivery.attempts, error });
    await delivery.retry();
  }
}

const markSent = defineCommand({
  name: "loyalty.tier.notice.sent",
  async run(tx, ctx, input: { id: string; channel: "sms" | "email" }) {
    const [row] = await tx
      .update(tierNotice)
      .set({ sentAt: new Date(), channel: input.channel, updatedAt: new Date() })
      .where(
        and(
          eq(tierNotice.orgId, ctx.orgId),
          eq(tierNotice.id, input.id),
          isNull(tierNotice.sentAt),
        ),
      )
      .returning({ customerId: tierNotice.customerId });
    return { id: input.id, channel: input.channel, customerId: row?.customerId };
  },
  audit: (_input, output) => ({ ...output }),
  details: (_input, output) => ({ entity: "customer", entityId: output.customerId }),
});

async function dueNotice(tx: ShopperTransaction, ctx: CommandContext, input: Input) {
  const current = await readCustomerRow(tx, ctx.orgId, input.customerId, true);
  const due = await nextNoticeAt(tx, ctx.orgId, current.id, input.at);
  if (!due || due > input.at) return { customerId: current.id, notice: null };
  const projected = (await readTierProjection(tx, ctx.orgId, current.id, input.at))!;
  return {
    customerId: current.id,
    notice: { from: projected.from, to: projected.to, effectiveOn: day(projected.on) },
  };
}

async function recorded(
  db: Queryable,
  orgId: string,
  customerId: string,
  fromTierId: string,
  effectiveOn: string,
) {
  const [found] = await db
    .select({ id: tierNotice.id })
    .from(tierNotice)
    .where(
      and(
        eq(tierNotice.orgId, orgId),
        eq(tierNotice.customerId, customerId),
        eq(tierNotice.fromTierId, fromTierId),
        eq(tierNotice.effectiveOn, effectiveOn),
      ),
    );
  return Boolean(found);
}

const day = (at: Date) => at.toISOString().slice(0, 10);
