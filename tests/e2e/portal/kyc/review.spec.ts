import { expect, test, type Page } from "@playwright/test";
import { createStaff, signInAs } from "../../../support/admin/people";
import {
  caseRow,
  customer,
  customerRow,
  ghanaCard,
  seedCase,
} from "../../../support/customers/portal";
import { shoot } from "../../../support/customers/shots";
import { expectNoSeriousAxe } from "../../../support/e2e";

// The owner of E2E Mart is signed in. Cases are written to the database as the workflow leaves them
// (phone verified, an ID or none on file), so the review is what is under test.
const heading = (page: Page, name: string, level = 1) => page.getByRole("heading", { name, level });

// The heading takes focus when the check opens, which is when A and R start to work.
async function openCheck(page: Page, id: string) {
  await page.goto(`/kyc/${id}`);
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeFocused();
}

test("shows the verified phone and the masked ID, and the keyboard approves it with a lower limit", async ({
  page,
  request,
}, info) => {
  const made = await customer(request, { name: "Kofi Credit" });
  const check = await seedCase(request, { customer: made, id: ghanaCard() });
  await openCheck(page, check.id);
  await expect(heading(page, "Kofi Credit")).toBeVisible();
  const details = page.getByRole("region", { name: "Check details" });
  await expect(details).toContainText(made.phone);
  await expect(details.getByText("Verified")).toBeVisible();
  await expect(details).toContainText("GH₵ 500.00");
  await expect(details).toContainText("Ghana Card");
  await expect(details).toContainText("GHA-•••••••45-6");
  await expect(page.getByText("This ID is on another check")).toHaveCount(0);
  await expectNoSeriousAxe(page);
  await shoot(page, info, "kyc-review");

  await page.keyboard.press("a");
  const sighted = page.getByRole("checkbox", { name: "I sighted the ID document" });
  const limit = page.getByLabel("Approved limit (GH₵)");
  await expect(limit).toHaveValue("500.00");
  await page.keyboard.press("Control+Enter");
  await expect(page.getByText("Confirm you sighted the ID document")).toBeVisible();
  await expect(sighted).toBeFocused();
  await shoot(page, info, "kyc-review-approve-error", { sizes: [[1440, 900]] });
  await page.keyboard.press("Space");
  await limit.fill("250.00");
  await page.keyboard.press("Control+Enter");
  await expect(page.getByText("Check approved")).toBeVisible();
  await expect(heading(page, "Identity checks")).toBeVisible();
  expect(await caseRow(check.id)).toMatchObject({ status: "approved", id_sighted: true });
  expect(await customerRow(made.id)).toMatchObject({ credit_limit: "2500000" });
});

test("another check with the same ID is flagged and linked", async ({ page, request }, info) => {
  const fingerprint = `fp-same-${Date.now()}`;
  const other = await seedCase(request, { id: ghanaCard(fingerprint) });
  const check = await seedCase(request, { id: ghanaCard(fingerprint) });
  await openCheck(page, check.id);
  const warning = page.getByRole("alert").filter({ hasText: "This ID is on another check" });
  await expect(warning).toBeVisible();
  await expect(warning.getByRole("link", { name: "Open check" })).toHaveAttribute(
    "href",
    `/kyc/${other.id}`,
  );
  await expectNoSeriousAxe(page);
  await shoot(page, info, "kyc-review-duplicate", {
    sizes: [
      [1440, 900],
      [390, 844],
    ],
  });
});

test("a check with no ID can be approved without the sighted box", async ({ page, request }) => {
  const check = await seedCase(request);
  await openCheck(page, check.id);
  await expect(page.getByRole("region", { name: "Check details" })).toContainText("No ID provided");
  await page.keyboard.press("a");
  await expect(page.getByLabel("Approved limit (GH₵)")).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.keyboard.press("Control+Enter");
  await expect(heading(page, "Identity checks")).toBeVisible();
  expect(await caseRow(check.id)).toMatchObject({ status: "approved", approved_limit: "5000000" });
});

test("rejecting needs a note", async ({ page, request }, info) => {
  const check = await seedCase(request, { id: ghanaCard() });
  await openCheck(page, check.id);
  await page.keyboard.press("r");
  const note = page.getByLabel("Reason for rejecting");
  await expect(note).toBeFocused();
  await page.keyboard.press("Control+Enter");
  await expect(page.getByText("Say why you are rejecting this check")).toBeVisible();
  await shoot(page, info, "kyc-review-reject-error", { sizes: [[1440, 900]] });
  await note.fill("The name does not match the ID");
  await page.keyboard.press("Control+Enter");
  await expect(heading(page, "Identity checks")).toBeVisible();
  expect(await caseRow(check.id)).toMatchObject({
    status: "rejected",
    decision_note: "The name does not match the ID",
  });
  expect((await customerRow(check.customerId)).credit_limit).toBe("0");
});

test("a decided check shows its decision and offers no buttons", async ({
  page,
  request,
}, info) => {
  const check = await seedCase(request, { status: "approved", id: ghanaCard() });
  await openCheck(page, check.id);
  const decision = page.getByRole("region", { name: "Decision" });
  await expect(decision).toContainText("Approved");
  await expect(decision).toContainText("Known customer");
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await shoot(page, info, "kyc-review-decided", {
    sizes: [
      [1440, 900],
      [390, 844],
    ],
  });
});

test("a check still waiting for its ID says it can't be decided yet", async ({ page, request }) => {
  const check = await seedCase(request, { status: "id_needed" });
  await openCheck(page, check.id);
  await expect(page.getByRole("region", { name: "Decision" })).toContainText(
    "once the ID step is done",
  );
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
});

test("an unknown check says it doesn't exist", async ({ page }) => {
  await page.goto("/kyc/0197b2d4-7c3a-7000-8000-000000000000");
  await expect(heading(page, "Not found")).toBeVisible();
});

test("an accountant can review a check but has no buttons to decide it", async ({
  page,
  request,
}, info) => {
  const check = await seedCase(request);
  const accountant = await createStaff(request, "accountant", "Kyc");
  await page.context().clearCookies();
  await signInAs(page, accountant);
  await openCheck(page, check.id);
  await expect(page.getByRole("region", { name: "Check details" })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("permission to approve");
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await page.keyboard.press("a");
  await expect(page.getByLabel("Approved limit (GH₵)")).toHaveCount(0);
  await shoot(page, info, "kyc-review-readonly", { sizes: [[1440, 900]] });
});
