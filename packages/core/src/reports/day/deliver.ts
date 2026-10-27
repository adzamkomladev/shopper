import { and, eq } from "drizzle-orm";
import * as v from "valibot";
import { store, storeDay, user } from "@shopper/db-pg";
import { formatGHS, money } from "@shopper/money";
import type { Delivery } from "@shopper/ports";
import { formatDay } from "@shopper/utils";
import type { StatementDeliveryDeps } from "../../customers";
import { storeDayReminder, storeDaySummary } from "../../schemas/reports/day";
import { tenderLabels } from "../sums";

type Deps = Pick<StatementDeliveryDeps, "db" | "appVersion" | "mail" | "baseUrl">;
type Figure = { value: number; yesterday: number; changeBps: number | null };
type Summary = {
  kpis: Record<"netSales" | "transactions" | "basket" | "refunds" | "margin", Figure>;
  top: { name: string; netSales: number }[];
  tenders: { kind: string; net: number }[];
};

/** Emails one owner the registers still without a Z at closing; without mail or a portal origin it retries. */
export async function deliverStoreDayReminder(deps: Deps, delivery: Delivery) {
  const message = v.parse(storeDayReminder, delivery.message);
  if (!deps.mail || !deps.baseUrl) return await delivery.retry();
  const found = await recipient(deps, message.orgId, message.payload);
  if (!found) return await delivery.ack();
  const day = formatDay(message.payload.day);
  const link = `${deps.baseUrl.replace(/\/$/, "")}/shifts`;
  await deps.mail({
    email: found.email,
    subject: `${found.store}: Z reports still to come for ${day}`,
    link,
    plain: [
      `${found.store} has closed for ${day}, and these registers took sales but have not sent their Z report:`,
      "",
      ...message.payload.registers.map((name) => `- ${name}`),
      "",
      `Ask each cashier to close their shift, then check the shifts: ${link}`,
    ].join("\n"),
    attachments: [],
  });
  await delivery.ack();
}

/** Emails one owner the day's figures as the store-day workflow kept them on the day's record. */
export async function deliverStoreDaySummary(deps: Deps, delivery: Delivery) {
  const message = v.parse(storeDaySummary, delivery.message);
  if (!deps.mail || !deps.baseUrl) return await delivery.retry();
  const found = await recipient(deps, message.orgId, message.payload);
  const [record] = await deps.db
    .select({ summary: storeDay.summary })
    .from(storeDay)
    .where(
      and(
        eq(storeDay.orgId, message.orgId),
        eq(storeDay.storeId, message.payload.storeId),
        eq(storeDay.day, message.payload.day),
      ),
    );
  if (!found || !record?.summary) return await delivery.ack();
  const summary = record.summary as Summary;
  const day = formatDay(message.payload.day);
  const link = `${deps.baseUrl.replace(/\/$/, "")}/reports?day=${message.payload.day}`;
  const k = summary.kpis;
  const ghs = (amount: number) => formatGHS(money(amount));
  await deps.mail({
    email: found.email,
    subject: `${found.store}: ${day} in figures`,
    link,
    plain: [
      `${found.store}, ${day} (yesterday in brackets):`,
      "",
      `Net sales ${ghs(k.netSales.value)} (${ghs(k.netSales.yesterday)})${change(k.netSales)}`,
      `Transactions ${k.transactions.value} (${k.transactions.yesterday})`,
      `Average basket ${ghs(k.basket.value)} (${ghs(k.basket.yesterday)})`,
      `Refunds ${ghs(k.refunds.value)} (${ghs(k.refunds.yesterday)})`,
      `Margin ${ghs(k.margin.value)} (${ghs(k.margin.yesterday)})`,
      "",
      "Top products:",
      ...(summary.top.length
        ? summary.top.map((p) => `- ${p.name}: ${ghs(p.netSales)}`)
        : ["- No sales"]),
      "",
      "Takings by tender:",
      ...summary.tenders.map((t) => `- ${tenderLabels[t.kind] ?? t.kind}: ${ghs(t.net)}`),
      "",
      `The full dashboard: ${link}`,
    ].join("\n"),
    attachments: [],
  });
  await delivery.ack();
}

async function recipient(deps: Deps, orgId: string, payload: { storeId: string; userId: string }) {
  const [owner] = await deps.db
    .select({ email: user.email })
    .from(user)
    .where(and(eq(user.orgId, orgId), eq(user.id, payload.userId)));
  const [shop] = await deps.db
    .select({ name: store.name })
    .from(store)
    .where(and(eq(store.orgId, orgId), eq(store.id, payload.storeId)));
  return owner && shop ? { email: owner.email, store: shop.name } : undefined;
}

const change = (figure: Figure) =>
  figure.changeBps === null
    ? ""
    : `, ${figure.changeBps >= 0 ? "up" : "down"} ${Math.abs(figure.changeBps) / 100}%`;
