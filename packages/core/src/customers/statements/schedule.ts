import { eq, sql } from "drizzle-orm";
import { v7 } from "uuid";
import * as v from "valibot";
import { defineCommand, enqueueAfterCommit, type CommandContext } from "@shopper/audit";
import { customer, org, type ShopperDatabase } from "@shopper/db-pg";
import { money } from "@shopper/money";
import type { Delivery, Queue, WorkflowLauncher } from "@shopper/ports";
import {
  statementScheduledMessage,
  statementScheduleMessage,
  statementSettings,
} from "../../schemas/customers/statements";
import type { Queryable } from "../../types";
import { sendStatement } from "./send";

type Settings = Awaited<ReturnType<typeof readStatementSettings>>;

/** The org's statement schedule; off by default. */
export async function readStatementSettings(db: Queryable, orgId: string) {
  const [row] = await db
    .select({
      schedule: org.statementSchedule,
      day: org.statementDay,
      channels: org.statementChannels,
      minBalance: org.statementMinBalance,
    })
    .from(org)
    .where(eq(org.id, orgId));
  return { ...row!, channels: row!.channels as ("sms" | "email")[] };
}

/** Changes the schedule; the org's workflow is started or woken, and ends when the schedule is off. */
export const setStatementSettings = defineCommand({
  name: "statement.settings.set",
  async run(tx, ctx, input: { body: unknown }) {
    const next = v.parse(statementSettings, input.body);
    const before = await readStatementSettings(tx, ctx.orgId);
    await tx
      .update(org)
      .set({
        statementSchedule: next.schedule,
        statementDay: next.day,
        statementChannels: next.channels,
        statementMinBalance: next.minBalance,
        updatedAt: new Date(),
      })
      .where(eq(org.id, ctx.orgId));
    enqueueAfterCommit(tx, {
      id: v7(),
      orgId: ctx.orgId,
      v: 1,
      sequence: "0",
      type: "statement.schedule",
      payload: { actorId: ctx.actorId! },
    });
    return { before, after: next };
  },
  audit: (_input, output) => ({ ...output }),
  details: (_input, output) => ({ entity: "org", before: output.before, after: output.after }),
});

/** Pure: the next run after `now`, on the schedule's day at Accra midnight (UTC all year); null when off. */
export function statementRunDue(settings: Pick<Settings, "schedule" | "day">, now: Date) {
  if (settings.schedule === "off") return null;
  const run = (month: number) => new Date(Date.UTC(now.getUTCFullYear(), month, settings.day));
  const thisMonth = run(now.getUTCMonth());
  return thisMonth > now ? thisMonth : run(now.getUTCMonth() + 1);
}

/** The calendar month before a run on `at`, as inclusive days. */
export function statementPeriod(at: Date) {
  const from = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() - 1, 1));
  const to = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 0));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

/**
 * Queues one message per active customer who owes at least the minimum, or whose account moved in the period
 * before `at`. Each message runs statement.send per channel, so running a period again sends nothing.
 */
export async function fanOutStatements(
  db: ShopperDatabase,
  ctx: CommandContext & { queue?: Queue },
  input: { at: Date },
) {
  const settings = await readStatementSettings(db, ctx.orgId);
  if (settings.schedule === "off" || !ctx.queue || !ctx.actorId) return { queued: 0 };
  const { from, to } = statementPeriod(input.at);
  const floor = money(Math.max(1, settings.minBalance));
  // ponytail: one query and one message per customer in a single step; page it when an org has very many accounts.
  const { rows } = await db.execute<{ id: string }>(sql`
    SELECT c.id FROM ${customer} c
    WHERE c.org_id = ${ctx.orgId} AND c.archived_at IS NULL AND (
      (SELECT COALESCE(SUM(amount), 0) FROM credit_entry e WHERE e.org_id = c.org_id AND e.customer_id = c.id) >= ${floor}
      OR EXISTS (SELECT 1 FROM credit_entry e WHERE e.org_id = c.org_id AND e.customer_id = c.id
        AND e.occurred_at >= ${from}::date AND e.occurred_at < ${to}::date + 1))`);
  for (const row of rows)
    await ctx.queue.send({
      id: v7(),
      orgId: ctx.orgId,
      v: 1,
      sequence: "0",
      type: "statement.scheduled",
      payload: { customerId: row.id, actorId: ctx.actorId, from, to, channels: settings.channels },
    });
  return { queued: rows.length };
}

/** The queue side: a schedule wake starts or wakes the org's workflow; a scheduled message sends per channel. */
export async function deliverSchedule(
  deps: { db: ShopperDatabase; appVersion: string; queue?: Queue; statements?: WorkflowLauncher },
  delivery: Delivery,
) {
  try {
    if (delivery.message.type === "statement.schedule") {
      if (!deps.statements) return await delivery.retry();
      const { orgId, payload } = v.parse(statementScheduleMessage, delivery.message);
      await deps.statements.start(orgId, { orgId, actorId: payload.actorId });
    } else {
      const { orgId, payload } = v.parse(statementScheduledMessage, delivery.message);
      const ctx = {
        orgId,
        appVersion: deps.appVersion,
        actorId: payload.actorId,
        queue: deps.queue,
      };
      const [row] = await deps.db
        .select({ email: customer.email })
        .from(customer)
        .where(eq(customer.id, payload.customerId));
      for (const channel of payload.channels)
        if (channel === "sms" || row?.email)
          await sendStatement(deps.db, ctx, {
            id: payload.customerId,
            body: { channel, from: payload.from, to: payload.to },
          });
    }
    await delivery.ack();
  } catch (error) {
    console.error({ event: "statement.schedule_failed", attempts: delivery.attempts, error });
    await delivery.retry();
  }
}
