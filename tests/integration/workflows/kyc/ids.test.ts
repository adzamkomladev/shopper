// The ID step: Ghana Card or passport stored masked plus a fingerprint, verified by hand (idSighted), duplicates flagged.
import { expect, test } from "vite-plus/test";
import {
  as,
  caseRow,
  customerRow,
  openCredit,
  otpFor,
  waitForRun,
} from "../../../support/kyc/world";

const card = { idType: "ghana_card", idNumber: "GHA-123456789-0", fullName: "Kofi Credit" };

/** A credit case that has passed the OTP and is waiting for its ID. */
async function awaitingId() {
  const made = await openCredit();
  expect((await as("accountant").verify(made.id, await otpFor(made.phone))).status).toBe(200);
  return made;
}
const withCard = async (body: Record<string, unknown> = card) => {
  const made = await awaitingId();
  const recorded = await as("accountant").recordId(made.id, body);
  return { ...made, recorded };
};

test("a Ghana Card is stored masked with an HMAC fingerprint, never in clear", async () => {
  const made = await withCard();
  expect(made.recorded.status).toBe(200);
  expect(made.recorded.body).toMatchObject({
    status: "review",
    idType: "ghana_card",
    idMasked: "GHA-•••••••89-0",
    fullName: "Kofi Credit",
    idSighted: false,
  });
  const row = await caseRow(made.id);
  expect(row).toMatchObject({ idType: "ghana_card", idMasked: "GHA-•••••••89-0" });
  expect(row.idFingerprint).toMatch(/^[0-9a-f]{64}$/);
  expect(JSON.stringify(row)).not.toContain("123456789");
  expect(JSON.stringify(made.recorded.body)).not.toContain("123456789");
});

test("a passport is masked the same way and its fingerprint tells numbers apart", async () => {
  const first = await withCard({ idType: "passport", idNumber: "G1234567", fullName: "Ama P" });
  expect(first.recorded.status).toBe(200);
  expect(first.recorded.body.idType).toBe("passport");
  expect(first.recorded.body.idMasked).toMatch(/^G•+67$|^•+67$/);
  expect(JSON.stringify(await caseRow(first.id))).not.toContain("G1234567");
  const second = await withCard({ idType: "passport", idNumber: "G7654321", fullName: "Ama Q" });
  const [a, b] = [await caseRow(first.id), await caseRow(second.id)];
  expect(a.idFingerprint).toMatch(/^[0-9a-f]{64}$/);
  expect(a.idFingerprint).not.toBe(b.idFingerprint);
});

test("an ID with the wrong format, an unknown type, no name or at the wrong step is refused", async () => {
  const made = await awaitingId();
  const record = (body: Record<string, unknown>) => as("accountant").recordId(made.id, body);
  expect((await record({ ...card, idNumber: "12345" })).status).toBe(400);
  expect((await record({ ...card, idType: "nin" })).status).toBe(400);
  expect((await record({ ...card, fullName: "" })).status).toBe(400);
  expect((await record({ idType: "ghana_card", idNumber: card.idNumber })).status).toBe(400);
  expect((await caseRow(made.id)).status).toBe("id_needed");
  const early = await openCredit();
  expect((await as("accountant").recordId(early.id, card)).status).toBe(409);
});

test("an ID type the org does not accept is refused", async () => {
  const all = ["ghana_card", "passport", "voter_id", "drivers_licence"];
  expect(
    (await as("accountant").setSettings({ idRequired: false, idTypes: ["passport"] })).status,
  ).toBe(200);
  try {
    const made = await awaitingId();
    expect((await as("accountant").recordId(made.id, card)).status).toBe(400);
    expect((await caseRow(made.id)).status).toBe("id_needed");
  } finally {
    await as("accountant").setSettings({ idRequired: false, idTypes: all });
  }
});

test("approving a case with an ID needs idSighted; rejecting does not", async () => {
  const made = await withCard();
  const approval = { approve: true, limit: 5_000_000, note: "Card checked" };
  for (const body of [approval, { ...approval, idSighted: false }]) {
    const refused = await as("admin").decide(made.id, body);
    expect([400, 409]).toContain(refused.status);
  }
  expect(await caseRow(made.id)).toMatchObject({ status: "review", idSighted: false });
  expect(await customerRow(made.customerId)).toMatchObject({ creditLimit: 0, kycVerifiedAt: null });

  const approved = await as("admin").decide(made.id, { ...approval, idSighted: true });
  expect(approved.status).toBe(200);
  expect(await caseRow(made.id)).toMatchObject({ status: "approved", idSighted: true });
  const customer = await customerRow(made.customerId);
  expect(customer.creditLimit).toBe(5_000_000);
  expect(customer.kycVerifiedAt).toBeInstanceOf(Date);
  await waitForRun(made.id, "completed");

  const other = await withCard({ ...card, idNumber: "GHA-222222222-2" });
  const rejected = await as("admin").decide(other.id, { approve: false, note: "Photo unclear" });
  expect(rejected.status).toBe(200);
  expect((await caseRow(other.id)).status).toBe("rejected");
});

test("the same Ghana Card on another customer's case is flagged as a duplicate on the case read", async () => {
  const first = await withCard({ ...card, idNumber: "GHA-333333333-3" });
  expect((await as("admin").read(first.id)).body.duplicates).toEqual([]);
  const second = await withCard({ ...card, idNumber: "GHA-333333333-3", fullName: "Someone Else" });
  expect(second.recorded.status).toBe(200);
  const read = await as("admin").read(second.id);
  expect(read.body.duplicates).toHaveLength(1);
  expect(read.body.duplicates[0]).toMatchObject({
    caseId: first.id,
    customerId: first.customerId,
  });
  expect(read.body.duplicates[0].customerId).not.toBe(second.customerId);
  expect((await caseRow(first.id)).idFingerprint).toBe((await caseRow(second.id)).idFingerprint);
  // A different number is not a duplicate; a duplicate never blocks the case.
  const distinct = await withCard({ ...card, idNumber: "GHA-444444444-4" });
  expect((await as("admin").read(distinct.id)).body.duplicates).toEqual([]);
  expect((await caseRow(second.id)).status).toBe("review");
});
