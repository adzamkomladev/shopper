// A statement sent by email carries the PDF and the link; by SMS, a summary and the link. One delivery row per
// customer, period and channel, however often it is asked for; a failure is recorded and a retry can still succeed.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { createMaileroo } from "@shopper/auth";
import { boxRenderer } from "@shopper/adapters-box/renderer";
import { deliverStatement, readStatementByToken } from "@shopper/core/customers";
import type { Envelope } from "@shopper/ports";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { ids } from "../../../support/till/sales";
import { appVersion, databases } from "../../../support/till/server";
import {
  baseURL,
  linkSecret,
  portalMember,
  portalOwner,
  type Portal,
} from "../../../support/api/portal";
import { sentMessages } from "../../../support/stock/queue";
import { arkesel, recordedDelivery, sms } from "../../../support/stock/sms";
import { mailerooFixture } from "../../../support/workflows/maileroo";
import { addCustomer } from "../../../support/customers/seed";
import { addEntryAt, auditCommands } from "../../../support/customers/ledger";
import { deliveries, statementApi } from "../../../support/customers/statements";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let admin: ReturnType<typeof statementApi>;
let cashier: ReturnType<typeof statementApi>;
let mailer: Awaited<ReturnType<typeof mailerooFixture>>;
const period = { from: "2026-10-01", to: "2026-10-31" };

const deps = () => ({
  db: databases().db,
  sms,
  mail: createMaileroo({
    apiKey: mailer.apiKey,
    from: "shop@shopper.test",
    endpoint: mailer.endpoint,
  }),
  renderer: boxRenderer(),
  linkSecret,
  baseUrl: baseURL,
  appVersion,
});
async function messageFor(deliveryId: string) {
  return (await sentMessages()).find(
    (m) => (m.payload as { deliveryId?: string }).deliveryId === deliveryId,
  )!;
}
async function deliver(message: Envelope, attempts = 1) {
  const recorded = recordedDelivery(message, attempts);
  await deliverStatement(deps(), recorded.delivery);
  return recorded.settled;
}
/** An owing customer with a payment inside the period, so the SMS has something to summarise. */
async function owing(phone: string, email: string | null = "buyer@shopper.test") {
  const customerId = await addCustomer({ name: "Ama Mensah", phone, creditLimit: 1_000_000 });
  if (email)
    await databases().db.execute(
      sql`UPDATE customer SET email = ${email} WHERE id = ${customerId}`,
    );
  await addEntryAt(customerId, "charge", 1_700_000, "2026-10-02T09:00:00Z");
  await addEntryAt(customerId, "payment", -500_000, "2026-10-03T09:00:00Z");
  return customerId;
}

beforeAll(async () => {
  world = await goldenWorld();
  mailer = await mailerooFixture();
  owner = await portalOwner(ids.org, ids.cashier);
  admin = statementApi(owner, owner.cookie);
  cashier = statementApi(owner, await portalMember(owner, "cashier"));
});
afterAll(async () => {
  await mailer?.close();
  await world?.local.close();
});

test("an emailed statement has the PDF attached and the link, one delivery row, and is audited", async () => {
  const customerId = await owing("0271730001");
  const sent = await admin.send(customerId, { channel: "email", ...period });
  expect(sent.status).toBe(201);
  expect(sent.body).toMatchObject({ channel: "email", status: "queued", ...period });

  expect(await deliver(await messageFor(sent.body.id))).toEqual(["ack"]);
  const email = mailer.requests.at(-1)!;
  expect(email.to.address).toBe("buyer@shopper.test");
  expect(email.attachments).toHaveLength(1);
  const [pdf] = email.attachments!;
  expect(pdf!.content_type).toBe("application/pdf");
  expect(pdf!.file_name).toBe("statement-2026-10-01-2026-10-31.pdf");
  expect(Buffer.from(pdf!.content, "base64").subarray(0, 5).toString("latin1")).toBe("%PDF-");

  expect(email.plain).toContain(`${baseURL}/statement/`);
  const token = email.plain.match(/\/statement\/([\w.-]+)/)![1]!;
  expect((await readStatementByToken(databases().db, linkSecret, token)).customer.name).toBe(
    "Ama Mensah",
  );

  const [row, ...others] = await deliveries(customerId);
  expect(others).toEqual([]);
  expect(row).toMatchObject({ channel: "email", status: "sent", period_from: period.from });
  expect(row!.provider_reference).toMatch(/\S/);
  expect(row!.link_id).toMatch(/\S/);
  expect(await auditCommands(customerId)).toEqual(
    expect.arrayContaining(["statement.send", "statement.delivery.sent"]),
  );
});

test("an SMS statement is a summary with the link", async () => {
  const customerId = await owing("0271730002");
  const sent = await admin.send(customerId, { channel: "sms", ...period });
  expect(sent.status).toBe(201);
  const before = arkesel.requests.length;
  expect(await deliver(await messageFor(sent.body.id))).toEqual(["ack"]);
  expect(arkesel.requests).toHaveLength(before + 1);
  const text = arkesel.requests.at(-1)!;
  expect(text.recipients).toEqual(["233271730002"]);
  expect(text.message).toContain("owe GHS 120.00");
  expect(text.message).toContain("last payment GHS 50.00 on 3 Oct");
  expect(text.message).toContain(`${baseURL}/statement/`);
  expect(await deliveries(customerId)).toMatchObject([
    { channel: "sms", status: "sent", provider_reference: expect.stringMatching(/\S/) },
  ]);
});

test("asking again changes nothing: one row, one message, and a redelivery sends nothing", async () => {
  const customerId = await owing("0271730003");
  const first = await admin.send(customerId, { channel: "sms", ...period });
  const again = await admin.send(customerId, { channel: "sms", ...period });
  expect(again.status).toBe(200);
  expect(again.body.id).toBe(first.body.id);
  const matching = (await sentMessages()).filter(
    (m) => (m.payload as { deliveryId?: string }).deliveryId === first.body.id,
  );
  expect(matching).toHaveLength(1);

  expect(await deliver(matching[0]!)).toEqual(["ack"]);
  const sentSoFar = arkesel.requests.length;
  expect(await deliver(matching[0]!)).toEqual(["ack"]);
  expect(arkesel.requests).toHaveLength(sentSoFar);
  expect(await deliveries(customerId)).toHaveLength(1);

  // Another period is its own delivery.
  const september = { channel: "sms", from: "2026-09-01", to: "2026-09-30" };
  expect((await admin.send(customerId, september)).status).toBe(201);
});

test("a failed send is recorded and retried, and a later success marks it sent", async () => {
  const customerId = await owing("0271730004");
  const sent = await admin.send(customerId, { channel: "email", ...period });
  const message = await messageFor(sent.body.id);
  mailer.responses.push({ status: 500, body: { success: false } });
  expect(await deliver(message, 2)).toEqual(["retry"]);
  expect(await deliveries(customerId)).toMatchObject([
    { status: "failed", provider_reference: null },
  ]);
  expect(await auditCommands(customerId)).toContain("statement.delivery.failed");

  expect(await deliver(message, 3)).toEqual(["ack"]);
  expect(await deliveries(customerId)).toMatchObject([{ status: "sent" }]);
});

test("sending needs customer.manage and a contact for the channel, and writes nothing otherwise", async () => {
  const noEmail = await owing("0271730005", null);
  expect((await admin.send(noEmail, { channel: "email", ...period })).status).toBe(409);
  expect(await deliveries(noEmail)).toEqual([]);
  const customerId = await owing("0271730006");
  expect((await cashier.send(customerId, { channel: "sms", ...period })).status).toBe(403);
  for (const bad of [
    { channel: "pdf", ...period },
    { channel: "sms", from: "2026-10-31", to: "2026-10-01" },
    { channel: "sms", from: "soon", to: "2026-10-01" },
  ])
    expect((await admin.send(customerId, bad)).status, JSON.stringify(bad)).toBe(400);
  const foreign = await addCustomer({ orgId: ids.otherOrg });
  expect((await admin.send(foreign, { channel: "sms", ...period })).status).toBe(404);
  expect(await deliveries(customerId)).toEqual([]);
});
