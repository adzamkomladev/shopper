// POST /sync/customers: the till's customer lane. {requestId, proof, customer: {v:1, type, customer:{...}}} answers
// {requestId, accepted:{id, version}} or {requestId, rejected:{code, message}}. Creates are idempotent on the client's
// UUIDv7. An update applies whole when its baseVersion is the current version; otherwise each field is last-writer-wins
// by occurredAt and the audit keeps both versions. A conflict is never a rejection, so it never blocks the queue.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { portalOwner } from "../../../support/api/portal";
import { customerApi } from "../../../support/customers/http";
import {
  created,
  customersByPhone,
  pause,
  serverCustomer,
  tillAudit,
  updated,
  upload,
  uploader,
} from "../../../support/customers/till";
import { ids } from "../../../support/till/sales";
import { api } from "../../../support/till/server";
import { syncHeaders } from "../../../support/till/requests";
import { inventorySession } from "../../../support/till/stock";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let portal: ReturnType<typeof customerApi>;
beforeAll(async () => {
  world = await goldenWorld();
  const owner = await portalOwner(ids.org, ids.cashier);
  portal = customerApi(owner, owner.cookie);
});
afterAll(async () => world?.local.close());

const accepted = (id: string, version: number) => ({ accepted: { id, version } });
/** A customer both the server and the "till" know at version 1. */
async function known(phone: string) {
  const session = await uploader();
  const body = created(session, { name: "Ama Mensah", phone });
  expect((await upload(body)).body).toMatchObject(accepted(body.customer.customer.id, 1));
  return { session, id: body.customer.customer.id };
}

test("a created customer is stored, audited as customer.till.create and a retry changes nothing", async () => {
  const session = await uploader();
  const body = created(session, { name: "Kofi Mensah", phone: "0241230101" });
  const id = body.customer.customer.id;
  for (let attempt = 0; attempt < 2; attempt++)
    expect(await upload(body)).toMatchObject({
      status: 200,
      body: { requestId: body.requestId, ...accepted(id, 1) },
    });
  expect(await serverCustomer(id)).toMatchObject({
    name: "Kofi Mensah",
    phone: "0241230101",
    version: 1,
  });
  const audit = await tillAudit("customer.till.create", id);
  expect(audit).toHaveLength(1);
  expect(audit[0]).toMatchObject({ actorId: ids.cashier, entity: "customer" });
  // The same identity under a new request id is the same customer, not a second one.
  expect((await upload({ ...body, requestId: v7() })).body).toMatchObject(accepted(id, 1));
  expect(await customersByPhone("0241230101")).toEqual([id]);
});

test("a bad credential is 401, and a forged proof, a bad event or another organisation is rejected for good", async () => {
  const session = await uploader();
  const body = created(session, { phone: "0241230102" });
  const bare = { "content-type": "application/json" };
  expect((await upload(body, bare)).status).toBe(401);

  const forged = await upload({ ...body, proof: "forged-proof" });
  expect(forged.body).toMatchObject({ rejected: { code: "INVALID_SESSION" } });
  const badPhone = created(session, { phone: "12345" });
  expect((await upload(badPhone)).body).toMatchObject({ rejected: { code: "INVALID_EVENT" } });
  const badVersion = created(session, { phone: "0241230102" });
  badVersion.customer.v = 2;
  expect((await upload(badVersion)).body).toMatchObject({ rejected: { code: "INVALID_EVENT" } });
  const foreign = created(session, { phone: "0241230102", orgId: ids.otherOrg } as never);
  expect((await upload(foreign)).body.rejected.code).toMatch(/^(SCOPE|INVALID_EVENT)$/);
  expect(await customersByPhone("0241230102")).toEqual([]);
});

test("a session without customer.write is rejected PERMISSION_DENIED and nothing is stored", async () => {
  const stock = await inventorySession();
  const body = created({ sessionId: stock.sessionId, proof: stock.proof }, { phone: "0241230103" });
  body.customer.customer.occurredAt = "2025-12-31T22:00:00.000Z";
  expect((await upload(body)).body).toMatchObject({ rejected: { code: "PERMISSION_DENIED" } });
  expect(await customersByPhone("0241230103")).toEqual([]);
});

test("an update on the version the till saw applies whole, however old its clock", async () => {
  const { session, id } = await known("0241230104");
  const edit = updated(
    session,
    id,
    1,
    { name: "Ama Owusu", tin: "C0012345678" },
    new Date(Date.now() - 1_000).toISOString(),
  );
  expect(await upload(edit)).toMatchObject({ body: accepted(id, 2) });
  expect(await serverCustomer(id)).toMatchObject({
    name: "Ama Owusu",
    tin: "C0012345678",
    version: 2,
  });
  const [audit] = await tillAudit("customer.till.update", id);
  expect(audit!.payload).toMatchObject({ baseVersion: 1, currentVersion: 1 });
  // A retry of the same request does not apply twice.
  expect(await upload(edit)).toMatchObject({ body: accepted(id, 2) });
  expect((await serverCustomer(id))!.version).toBe(2);
  expect(await tillAudit("customer.till.update", id)).toHaveLength(1);
});

test("fields the portal did not touch since the till's version apply, however old the till's edit", async () => {
  const { session, id } = await known("0241230105");
  const editedAt = new Date().toISOString();
  await pause(30);
  expect((await portal.patch(id, { name: "Portal Name" })).body.version).toBe(2);
  const reply = await upload(updated(session, id, 1, { tin: "C0012345678" }, editedAt));
  expect(reply.body).toMatchObject(accepted(id, 3));
  expect(await serverCustomer(id)).toMatchObject({
    name: "Portal Name",
    tin: "C0012345678",
    version: 3,
  });
  const [audit] = await tillAudit("customer.till.update", id);
  expect(audit!.payload).toMatchObject({ baseVersion: 1, currentVersion: 2 });
});

test("a field both sides changed goes to the later writer: the portal when it was last, the till when it was", async () => {
  const older = await known("0241230106");
  const tillAt = new Date().toISOString();
  await pause(30);
  await portal.patch(older.id, { name: "Portal Later" });
  expect(
    await upload(updated(older.session, older.id, 1, { name: "Till Earlier" }, tillAt)),
  ).toMatchObject({
    status: 200,
    body: { accepted: { id: older.id } },
  });
  expect((await serverCustomer(older.id))!.name).toBe("Portal Later");
  expect((await tillAudit("customer.till.update", older.id))[0]!.payload).toMatchObject({
    baseVersion: 1,
    currentVersion: 2,
  });

  const newer = await known("0241230107");
  await portal.patch(newer.id, { name: "Portal Earlier" });
  await pause(30);
  expect(await upload(updated(newer.session, newer.id, 1, { name: "Till Later" }))).toMatchObject({
    status: 200,
    body: { accepted: { id: newer.id } },
  });
  expect(await serverCustomer(newer.id)).toMatchObject({ name: "Till Later", version: 3 });
});

test("the credit limit is not editable from the till: the event is rejected and the limit stays", async () => {
  const { session, id } = await known("0241230108");
  const reply = await upload(updated(session, id, 1, { creditLimit: 5_000_000 }));
  expect(reply.body).toMatchObject({ rejected: { code: "INVALID_EVENT" } });
  expect(await serverCustomer(id)).toMatchObject({ credit_limit: "0", version: 1 });
});

test("a reply the till can act on: a rejection is terminal and the request is answered 200", async () => {
  const session = await uploader();
  const response = await api.request("/sync/customers", {
    method: "POST",
    headers: syncHeaders(),
    body: JSON.stringify({ ...created(session), customer: { v: 1, type: "customer.deleted" } }),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ rejected: { code: "INVALID_EVENT" } });
});

test("an edit to a merged or archived customer is rejected for good and changes nothing", async () => {
  const archived = await known("0241230109");
  const winner = await known("0241230110");
  const merged = await known("0241230110");
  expect((await portal.archive(archived.id)).status).toBe(200);
  expect((await portal.merge(winner.id, merged.id)).status).toBe(200);

  for (const [target, code] of [
    [archived, "ARCHIVED"],
    [merged, "MERGED"],
  ] as const) {
    const before = await serverCustomer(target.id);
    const reply = await upload(updated(target.session, target.id, 1, { name: "Too Late" }));
    expect(reply).toMatchObject({ status: 200, body: { rejected: { code } } });
    expect(await serverCustomer(target.id)).toEqual(before);
    expect(await tillAudit("customer.till.update", target.id)).toHaveLength(0);
  }
});
