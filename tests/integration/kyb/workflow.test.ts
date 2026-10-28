// A submitted case runs the automated checks, then waits for a Shopper reviewer. A failed check lists every reason
// and the owner fixes and resubmits; a rejection keeps its note and emails the owner; an approval opens the shop's
// Paystack subaccount exactly once, however often the workflow runs again.
import { v7 } from "uuid";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { expect, test, vi } from "vite-plus/test";
import { decideKyb, kybId } from "@shopper/core/kyb";
import {
  blobs,
  call,
  freshKybFlows,
  caseRow,
  context,
  db,
  delivered,
  kybEmails,
  paystack,
  queue,
  upload,
  validCase,
  waitForStatus,
} from "./support";

const reviewerId = v7();
const decideAs = (input: { version: number; decision: "approved" | "rejected"; note?: string }) =>
  decideKyb(db, { orgId: context.orgId, appVersion: "test", queue }, { ...input, reviewerId });
const decide = async (decision: "approved" | "rejected", note?: string) =>
  decideAs({ version: (await caseRow())!.version, decision, note });
const submit = async (body: unknown) => {
  expect((await call("/kyb", "PUT", body)).status).toBe(200);
  expect((await call("/kyb/submit", "POST")).status).toBe(202);
};

test("failed checks list every reason, and the owner fixes and resubmits", async () => {
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const tampered = await upload("the bytes the owner meant");
  // Swapped in storage after the upload: the bytes no longer match what was registered.
  await blobs.put(context.orgId, `receipts/kyb/${tampered}`, new TextEncoder().encode("other"));
  await submit(
    await validCase({
      tin: "12345",
      settlementBank: "999",
      directors: [
        {
          name: "Ama Mensah",
          ghanaCard: "GHA-12-0",
          cardExpiresOn: yesterday,
          cardAssetId: tampered,
        },
      ],
      documents: [{ kind: "registration_certificate", assetId: v7(), expiresOn: null }],
    }),
  );
  await waitForStatus("checks_failed");
  const failed = (await caseRow())!.checks.filter((check) => !check.ok).map((check) => check.check);
  expect(failed).toEqual(
    expect.arrayContaining(["tin", "ghana_card", "card_expiry", "settlement_bank", "documents"]),
  );
  const view = await (await call("/kyb")).json();
  expect(view.checks.filter((check: { ok: boolean }) => !check.ok).length).toBe(failed.length);
  expect(kybEmails().some((sent) => /needs attention/i.test(sent.subject))).toBe(true);
  // The run ended with the case back with the owner, and its record says so.
  await vi.waitFor(async () => {
    const [run] = await db
      .select()
      .from(schema.workflowRun)
      .where(eq(schema.workflowRun.instanceId, kybId(context.orgId)));
    expect(run?.status).toBe("completed");
  });

  await submit(await validCase());
  await waitForStatus("in_review");
  expect((await caseRow())!.checks.every((check) => check.ok)).toBe(true);
  expect((await caseRow())!.version).toBe(2);
});

test("a rejection keeps its note and emails the owner; a stale decision is refused", async () => {
  const version = (await caseRow())!.version;
  await decide("rejected", "The certificate is for another business.");
  await waitForStatus("rejected");
  expect(await caseRow()).toMatchObject({
    decisionNote: "The certificate is for another business.",
  });
  await vi.waitFor(() =>
    expect(kybEmails().some((sent) => /not approved/i.test(sent.subject))).toBe(true),
  );
  await expect(decideAs({ version, decision: "approved" })).rejects.toThrow(/already decided/i);
});

test("an approval opens one Paystack subaccount, however often the workflow runs again", async () => {
  await submit(await validCase());
  await waitForStatus("in_review");
  await decide("approved");
  await vi.waitFor(async () => expect((await caseRow())?.subaccountCode).toMatch(/^ACCT_/), {
    timeout: 10_000,
  });
  expect(paystack.subaccounts).toHaveLength(1);
  expect(paystack.subaccounts[0]!.body).toMatchObject({
    business_name: "Ama Mart Limited",
    settlement_bank: "040",
    account_number: "1234567890123",
  });
  // The notice that started it is delivered again, as an at-least-once queue may.
  const notice = delivered.find((message) => message.type === "kyb.notice")!;
  await queue.send({ ...notice, id: v7() });
  await queue.idle();
  // A run with none of the earlier steps cached, as after a restart, reads the kept code instead.
  const restarted = freshKybFlows();
  await restarted.start(kybId(context.orgId), { orgId: context.orgId });
  await new Promise((resolve) => setTimeout(resolve, 500));
  expect(paystack.subaccounts).toHaveLength(1);
  expect(kybEmails().some((sent) => /verification approved/i.test(sent.subject))).toBe(true);

  // Payouts already go to that account: changing it is refused, while other details may change.
  expect((await call("/kyb", "PUT", { settlementAccount: "999999999" })).status).toBe(409);
  expect((await call("/kyb", "PUT", { registrationNumber: "CS000000001" })).status).toBe(200);
});
