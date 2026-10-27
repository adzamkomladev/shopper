// Digital receipts: a sale to a customer with an email queues one receipt email after it commits; the consumer
// renders the stored receipt JSON to a PDF with the shared renderer and sends it with the receipt number, lines,
// total and fiscal code in the text; a redelivered message or a double-clicked resend sends once.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq, sql } from "drizzle-orm";
import { createApi } from "@shopper/api";
import { deliverNotification } from "@shopper/core/notifications";
import * as schema from "@shopper/db-pg";
import { formatGHS, money } from "@shopper/money";
import type { Envelope, Json } from "@shopper/ports";
import { ids } from "../../fixtures/sales/golden";
import { tradingDay } from "../../fixtures/sales/golden/day";
import { goldenWorld } from "../../support/sales/golden/setup";
import { ringGolden, runGolden } from "../../support/sales/golden/run";
import { addCustomer } from "../../support/customers/seed";
import { portalMember, portalOwner, type Portal } from "../../support/api/portal";
import { notifications, sentMessages } from "../../support/stock/queue";
import { api as till, devices } from "../../support/till/server";
import { pushEvents } from "../../support/till/requests";
import { addBranch } from "../../support/stock/seed";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let api: ReturnType<typeof createApi>;
beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  api = createApi({ database: world.db, devices, authentication: owner.auth, notifications });
}, 300_000);
afterAll(async () => {
  await world?.local.close();
});

const scenario = tradingDay.find((s) => s.name === "manual card")!;
/** A sale rung up for a customer with an email, accepted by the server. */
async function soldTo(email: string | null) {
  const customerId = await addCustomer({ name: "Efua Mensah", phone: "0244000111" });
  if (email)
    await world.db.update(schema.customer).set({ email }).where(eq(schema.customer.id, customerId));
  const event = (await ringGolden(world, scenario))!;
  const customer = {
    id: customerId,
    name: "Efua Mensah",
    phone: "0244000111",
    kind: "individual",
    businessName: null,
    tin: null,
  };
  const response = await pushEvents(
    till,
    [{ ...event, sale: { ...event.sale, customer } }],
    [{ sessionId: world.session.id, proof: world.session.proof }],
  );
  expect(await response.json()).toMatchObject({ rejected: [] });
  return event.sale;
}
const emails = async (saleId: string) =>
  (await sentMessages()).filter(
    (m) => m.type === "receipt.email" && (m.payload as { saleId: string }).saleId === saleId,
  );
async function deliver(message: Envelope) {
  const sent: { email: string; subject: string; plain: string; attachments: unknown[] }[] = [];
  const rendered: Json[] = [];
  const outcome: string[] = [];
  await deliverNotification(
    {
      db: world.db,
      appVersion: "test",
      mail: async (m: (typeof sent)[number]) => {
        sent.push(m);
        return "ref";
      },
      renderer: {
        receipt: async (receipt: Json) => {
          rendered.push(receipt);
          return new Uint8Array([37, 80, 68, 70]);
        },
        statement: async () => new Uint8Array(),
      },
    } as Parameters<typeof deliverNotification>[0],
    {
      message,
      attempts: 1,
      ack: async () => void outcome.push("ack"),
      retry: async () => void outcome.push("retry"),
    },
  );
  return { sent, rendered, outcome };
}
const resend = (cookie: string, saleId: string, body: object) =>
  api.request(`/transactions/${saleId}/receipt/email`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

test("a sale to a customer with an email sends its receipt once, with lines, total and the fiscal code", async () => {
  const sale = await soldTo("efua@example.com");
  const [queued, ...more] = await emails(sale.id);
  expect(more).toEqual([]);
  expect(queued).toBeDefined();
  // The SDC signed it after the sale: the email carries the signature the receipt was stamped with.
  await world.db
    .update(schema.fiscalDoc)
    .set({
      status: "accepted",
      sdcId: "SDC-001",
      sdcCounter: 42,
      signature: "SIG-RECEIPT-123",
      qr: "https://gra.example/qr/123",
      signedAt: new Date("2026-10-15T12:00:05.000Z"),
      acceptedAt: new Date(),
    })
    .where(and(eq(schema.fiscalDoc.orgId, ids.org), eq(schema.fiscalDoc.saleId, sale.id)));

  const first = await deliver(queued!);
  expect(first.outcome).toEqual(["ack"]);
  expect(first.sent).toHaveLength(1);
  const mail = first.sent[0]!;
  expect(mail.email).toBe("efua@example.com");
  expect(mail.subject).toContain(sale.receiptNumber);
  for (const line of (first.rendered[0] as { lines: { name: string }[] }).lines)
    expect(mail.plain).toContain(line.name);
  expect(mail.plain).toContain(formatGHS(money(sale.total)));
  expect(mail.plain).toContain("SIG-RECEIPT-123");
  expect(mail.attachments).toMatchObject([
    { fileName: `receipt-${sale.receiptNumber}.pdf`, contentType: "application/pdf" },
  ]);
  expect(first.rendered[0]).toMatchObject({
    saleId: sale.id,
    fiscal: { signature: "SIG-RECEIPT-123", signedAt: "2026-10-15T12:00:05.000Z" },
  });
  const [row] = await world.db
    .select()
    .from(schema.receiptEmail)
    .where(eq(schema.receiptEmail.saleId, sale.id));
  expect(row!.sentAt).not.toBeNull();
  const audit = await world.db.execute(
    sql`SELECT 1 FROM audit_log WHERE command = 'receipt.email.sent' AND entity_id = ${row!.id}`,
  );
  expect(audit.rows).toHaveLength(1);

  // Redelivered after the send: nothing goes out again.
  const again = await deliver(queued!);
  expect(again).toMatchObject({ outcome: ["ack"], sent: [] });
});

test("a walk-in sale and a customer without an email queue no receipt email", async () => {
  const walkIn = (await runGolden(world, scenario))!;
  expect(await emails(walkIn.id)).toEqual([]);
  const noEmail = await soldTo(null);
  expect(await emails(noEmail.id)).toEqual([]);
});

test("the back office resends once per click key, to the customer or a given address, in its branches only", async () => {
  const sale = await soldTo("kwame@example.com");
  const before = (await emails(sale.id)).length;
  const key = "019a0000-0000-7000-8000-00000000c001";
  expect((await resend(owner.cookie, sale.id, { requestKey: key })).status).toBe(202);
  expect((await resend(owner.cookie, sale.id, { requestKey: key })).status).toBe(202);
  expect(await emails(sale.id)).toHaveLength(before + 1);
  const other = await resend(owner.cookie, sale.id, {
    requestKey: "019a0000-0000-7000-8000-00000000c002",
    email: "accounts@kwame.example",
  });
  expect(other.status).toBe(202);
  const queued = (await emails(sale.id)).at(-1)!;
  const { sent } = await deliver(queued);
  expect(sent[0]!.email).toBe("accounts@kwame.example");

  // Without an address to send to, the request says so.
  const walkIn = (await runGolden(world, scenario))!;
  const none = await resend(owner.cookie, walkIn.id, {
    requestKey: "019a0000-0000-7000-8000-00000000c003",
  });
  expect(none.status).toBe(400);

  // A manager scoped to another branch cannot see the sale, so cannot send it.
  const elsewhere = await portalMember(owner, "admin");
  const userId = (await owner.auth.resolvePrincipal(
    new Request("http://localhost", { headers: { cookie: elsewhere } }),
  ))!.userId;
  const [member] = await world.db
    .select()
    .from(schema.member)
    .where(eq(schema.member.userId, userId));
  await world.db
    .insert(schema.memberBranch)
    .values({ orgId: ids.org, memberId: member!.id, branchId: await addBranch(ids.store) });
  const scoped = await resend(elsewhere, sale.id, {
    requestKey: "019a0000-0000-7000-8000-00000000c004",
  });
  expect(scoped.status).toBe(404);
});
