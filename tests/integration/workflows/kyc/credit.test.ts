// Credit KYC (Owner decision 4): phone OTP and manager approval are always needed; the ID is optional unless the org requires it.
import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import {
  allAuditRows,
  arkesel,
  as,
  caseRow,
  creditInReview,
  customerRow,
  expectChainValid,
  newCustomer,
  openCredit,
  otpFor,
  runOf,
  waitForRun,
  wrongCodeFor,
} from "../../../support/kyc/world";

test("a credit case runs OTP, skipped ID and approval: the limit is set, the customer verified and the workflow completed", async () => {
  const customer = await newCustomer();
  const opened = await as("accountant").open({
    subject: { customerId: customer.id },
    purpose: "credit",
    requestedLimit: 5_000_000,
  });
  expect(opened.status).toBe(201);
  expect(opened.body).toMatchObject({
    status: "otp_sent",
    purpose: "credit",
    customerId: customer.id,
    requestedLimit: 5_000_000,
    phone: customer.phone,
  });
  const id = opened.body.id as string;

  const code = await otpFor(customer.phone);
  expect(code).toMatch(/^\d{6}$/);
  expect(arkesel.requests.at(-1)).toMatchObject({
    sender: "Shopper",
    recipients: [customer.phone.replace(/^0/, "233")],
  });
  expect((await customerRow(customer.id)).creditLimit).toBe(0);

  const verified = await as("accountant").verify(id, code);
  expect(verified.status).toBe(200);
  expect(verified.body.status).toBe("id_needed");
  const skipped = await as("accountant").skipId(id);
  expect(skipped.status).toBe(200);
  expect(skipped.body).toMatchObject({ status: "review", idType: null, idMasked: null });
  expect((await customerRow(customer.id)).creditLimit).toBe(0);

  const approved = await as("admin").decide(id, {
    approve: true,
    limit: 5_000_000,
    note: "Known trader",
  });
  expect(approved.status).toBe(200);
  expect(approved.body).toMatchObject({ status: "approved", approvedLimit: 5_000_000 });
  const row = await caseRow(id);
  expect(row).toMatchObject({ status: "approved", approvedLimit: 5_000_000, idSighted: false });
  expect(row.decidedAt).toBeInstanceOf(Date);
  expect(row.decisionNote).toBe("Known trader");
  const after = await customerRow(customer.id);
  expect(after.creditLimit).toBe(5_000_000);
  expect(after.kycVerifiedAt).toBeInstanceOf(Date);
  await waitForRun(id, "completed");
  expect(await runOf(id)).toMatchObject({ type: "kyc", businessKey: id });

  const commands = (await allAuditRows()).filter((r) => r.entityId === id).map((r) => r.command);
  expect(commands).toEqual([
    "kyc.case.open",
    "kyc.otp.issue",
    "kyc.otp.check",
    "kyc.id.skip",
    "kyc.decide",
  ]);
  await expectChainValid();
});

test("a rejected case leaves the limit at zero and the customer unverified", async () => {
  const made = await creditInReview();
  const rejected = await as("admin").decide(made.id, { approve: false, note: "Not known to us" });
  expect(rejected.status).toBe(200);
  expect(rejected.body.status).toBe("rejected");
  expect(await customerRow(made.customerId)).toMatchObject({
    creditLimit: 0,
    kycVerifiedAt: null,
  });
  await waitForRun(made.id, "completed");
});

test("a wrong code is refused and counted, and the right code still works afterwards", async () => {
  const made = await openCredit();
  const code = await otpFor(made.phone);
  const wrong = await as("accountant").verify(made.id, wrongCodeFor(code));
  expect(wrong.status).toBe(400);
  expect(await caseRow(made.id)).toMatchObject({ status: "otp_sent", otpAttempts: 1 });
  expect((await as("accountant").verify(made.id, "12")).status).toBe(400);
  const right = await as("accountant").verify(made.id, code);
  expect(right.status).toBe(200);
  expect(right.body.status).toBe("id_needed");
});

test("five wrong codes lock the case: the right code is then refused too", async () => {
  const made = await openCredit();
  const code = await otpFor(made.phone);
  for (let attempt = 1; attempt <= 5; attempt++) {
    const refused = await as("accountant").verify(made.id, wrongCodeFor(code));
    expect(refused.status, `wrong code ${attempt}`).toBeLessThan(500);
    expect(refused.status).toBeGreaterThanOrEqual(400);
  }
  const row = await caseRow(made.id);
  expect(row.otpAttempts).toBe(5);
  const late = await as("accountant").verify(made.id, code);
  expect(late.status).toBeGreaterThanOrEqual(400);
  expect(late.status).toBeLessThan(500);
  const after = await caseRow(made.id);
  expect(["id_needed", "review", "approved"]).not.toContain(after.status);
  expect((await customerRow(made.customerId)).kycVerifiedAt).toBeNull();
});

test("with 'ID required' on, skipping the ID is refused with ID_REQUIRED until an ID is recorded", async () => {
  const allTypes = ["ghana_card", "passport", "voter_id", "drivers_licence"];
  const on = await as("accountant").setSettings({ idRequired: true, idTypes: allTypes });
  expect(on.status).toBe(200);
  try {
    const made = await openCredit();
    expect((await as("accountant").verify(made.id, await otpFor(made.phone))).status).toBe(200);
    const skipped = await as("accountant").skipId(made.id);
    expect(skipped.status).toBe(409);
    expect(skipped.body.code).toBe("ID_REQUIRED");
    expect((await caseRow(made.id)).status).toBe("id_needed");
    const recorded = await as("accountant").recordId(made.id, {
      idType: "ghana_card",
      idNumber: "GHA-765432101-4",
      fullName: "Kofi Credit",
    });
    expect(recorded.status).toBe(200);
    expect(recorded.body.status).toBe("review");
  } finally {
    await as("accountant").setSettings({ idRequired: false, idTypes: allTypes });
  }
});

test("opening and deciding need the right permission, and the input is validated", async () => {
  const customer = await newCustomer();
  const body = { subject: { customerId: customer.id }, purpose: "credit", requestedLimit: 100_000 };
  expect((await as("cashier").open(body)).status).toBe(403);
  expect((await as("accountant").open({ ...body, requestedLimit: 12.5 })).status).toBe(400);
  expect((await as("accountant").open({ ...body, requestedLimit: -1 })).status).toBe(400);
  expect(
    (
      await as("accountant").open({
        subject: { customerId: v7() },
        purpose: "credit",
        requestedLimit: 1,
      })
    ).status,
  ).toBe(404);
  const made = await creditInReview();
  // customer.manage opens the case; only kyc.approve decides it.
  for (const who of ["accountant", "cashier"]) {
    const refused = await as(who).decide(made.id, { approve: true, limit: 100_000, note: "x" });
    expect(refused.status, who).toBe(403);
  }
  expect((await as("admin").decide(made.id, { approve: true, note: "no limit" })).status).toBe(400);
  expect((await as("admin").decide(made.id, { approve: true, limit: 1.5, note: "x" })).status).toBe(
    400,
  );
  expect((await caseRow(made.id)).status).toBe("review");
  expect((await customerRow(made.customerId)).creditLimit).toBe(0);
});

test("a customer has one open case at a time, and cases are listed and read by status", async () => {
  const made = await openCredit();
  const again = await as("accountant").open({
    subject: { customerId: made.customerId },
    purpose: "credit",
    requestedLimit: 1_000_000,
  });
  expect(again.status).toBe(409);
  const waiting = await as("accountant").list("status=otp_sent");
  expect(waiting.status).toBe(200);
  expect(waiting.body.items.map((item: { id: string }) => item.id)).toContain(made.id);
  const review = await as("admin").list("status=review");
  expect(review.body.items.map((item: { id: string }) => item.id)).not.toContain(made.id);
  expect((await as("admin").read(made.id)).body).toMatchObject({ id: made.id, status: "otp_sent" });
  expect((await as("admin").read(v7())).status).toBe(404);
});

test("a merge expires the loser's open case, and a case is not decided for an archived customer", async () => {
  const loser = await creditInReview();
  const winner = await newCustomer();
  const merged = await as("admin").call("POST", `/customers/${winner.id}/merge`, {
    loserId: loser.customerId,
  });
  expect(merged.status).toBe(200);
  expect((await caseRow(loser.id)).status).toBe("expired");

  const made = await creditInReview();
  const archived = await as("admin").call("POST", `/customers/${made.customerId}/archive`);
  expect(archived.status).toBe(200);
  const refused = await as("admin").decide(made.id, { approve: true, limit: 100_000, note: "x" });
  expect(refused.status).toBe(409);
  expect(refused.body.code).toBe("ARCHIVED");
  expect((await customerRow(made.customerId)).creditLimit).toBe(0);
});
