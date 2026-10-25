import { expect, test, type Page } from "@playwright/test";
import { createStaff, signInAs } from "../../../support/admin/people";
import { shoot } from "../../../support/customers/shots";

// The Fiscal tab. The e2e box runs without an SDC, so the real API shows the not-connected state and empty
// segments. The documents view fakes only the list and one document's reply (the API's behaviour is covered by
// tests/integration/fiscal), so every status, the reason and the Retry path can be seen and driven by keyboard.
test.describe.configure({ timeout: 180_000 });

const documents = [
  {
    id: "019a0000-0000-7000-8000-00000000f001",
    kind: "invoice",
    invoiceNumber: "BR1-T1-000123",
    branchName: "Accra Central",
    status: "rejected",
    attempts: 1,
    createdAt: "2026-10-24T10:15:00.000Z",
    acceptedAt: null,
    reason: "E_TIN: Buyer TIN is not registered",
  },
  {
    id: "019a0000-0000-7000-8000-00000000f002",
    kind: "credit_note",
    invoiceNumber: "BR1-T1-000124",
    branchName: "Accra Central",
    status: "dead",
    attempts: 10,
    createdAt: "2026-10-24T10:20:00.000Z",
    acceptedAt: null,
    reason: "The SDC replied 503",
  },
  {
    id: "019a0000-0000-7000-8000-00000000f003",
    kind: "invoice",
    invoiceNumber: "BR1-T1-000125",
    branchName: "Accra Central",
    status: "accepted",
    attempts: 1,
    createdAt: "2026-10-24T10:25:00.000Z",
    acceptedAt: "2026-10-24T10:25:03.000Z",
    reason: null,
  },
];
const detail = (doc: (typeof documents)[number], status = doc.status) => ({
  ...doc,
  status,
  attempts: status === "pending" ? 0 : doc.attempts,
  sdcId: null,
  sdcCounter: null,
  signature: null,
  qr: null,
  signedAt: null,
  rejectionCode: null,
  rejectionMessage: null,
  lastError: doc.reason,
  payload: { totals: { total: 125_000 } },
});

async function fakeDocuments(page: Page) {
  await page.route("**/api/tax/fiscal?*", (route) =>
    route.fulfill({
      json: {
        connected: true,
        counts: { all: 3, pending: 0, accepted: 1, rejected: 1, dead: 1 },
        documents,
      },
    }),
  );
  await page.route(`**/api/tax/fiscal/${documents[1]!.id}`, (route) =>
    route.fulfill({ json: detail(documents[1]!) }),
  );
  await page.route(`**/api/tax/fiscal/${documents[1]!.id}/retry`, (route) =>
    route.fulfill({ json: detail(documents[1]!, "pending") }),
  );
}

test("the owner sees the SDC is not connected, and every segment is empty with what it holds", async ({
  page,
}, info) => {
  await page.goto("/tax/fiscal");
  await expect(page.getByRole("tab", { name: /Fiscal/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("The SDC is not connected")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No fiscal documents yet" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Archive" })).toContainText(
    "No bundles for this day yet.",
  );
  await page.getByRole("heading", { name: "Tax", level: 1 }).focus();
  await page.keyboard.press("5");
  await expect(page).toHaveURL(/status=dead/);
  await expect(page.getByRole("heading", { name: "Nothing is dead-lettered" })).toBeVisible();
  await shoot(page, info, "tax-fiscal-empty");
});

test("documents show their status and reason; Retry sends a dead-lettered one back, by keyboard", async ({
  page,
}, info) => {
  await fakeDocuments(page);
  await page.goto("/tax/fiscal");
  const table = page.getByRole("region", { name: "Fiscal documents" });
  await expect(table.getByRole("row").filter({ hasText: "BR1-T1-000123" })).toContainText(
    "E_TIN: Buyer TIN is not registered",
  );
  await expect(page.getByRole("tab", { name: /Rejected/ })).toContainText("1");
  await shoot(page, info, "tax-fiscal-documents", {
    sizes: [
      [1920, 1080],
      [1440, 900],
      [1366, 768],
      [768, 1024],
      [390, 844],
    ],
  });

  await page.getByRole("button", { name: "BR1-T1-000124" }).focus();
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog", { name: "Credit note BR1-T1-000124" });
  await expect(sheet).toContainText("The SDC replied 503");
  await expect(sheet.getByRole("button", { name: /Retry/ })).toBeVisible();
  await shoot(page, info, "tax-fiscal-sheet", {
    sizes: [
      [1440, 900],
      [390, 844],
    ],
  });
  await page.keyboard.press("r");
  await expect(page.getByText("Sent back to the SDC queue")).toBeVisible();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("button", { name: "BR1-T1-000124" })).toBeFocused();
});

test("searching by receipt number narrows the list, and / focuses the search", async ({ page }) => {
  await page.goto("/tax/fiscal");
  await page.getByRole("heading", { name: "Tax", level: 1 }).focus();
  await page.keyboard.press("/");
  const search = page.getByRole("searchbox", { name: "Search by receipt number" });
  await expect(search).toBeFocused();
  await search.fill("NOPE-1");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/q=NOPE-1/);
  await expect(page.getByRole("heading", { name: "No receipt matches “NOPE-1”" })).toBeVisible();
});

test("an accountant reads the documents but cannot retry; a cashier cannot open the tab", async ({
  page,
  request,
}) => {
  const accountant = await createStaff(request, "accountant", "Fiscal");
  const cashier = await createStaff(request, "cashier", "Fiscal");
  await page.context().clearCookies();
  await signInAs(page, accountant);
  await fakeDocuments(page);
  await page.goto("/tax/fiscal");
  await page.getByRole("button", { name: "BR1-T1-000124" }).click();
  await expect(page.getByRole("dialog")).toContainText("The SDC replied 503");
  await expect(page.getByRole("button", { name: /Retry/ })).toHaveCount(0);
  await page.context().clearCookies();
  await signInAs(page, cashier);
  await page.goto("/tax/fiscal");
  await expect(page.getByText(/fiscal documents/i).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Fiscal documents" })).toHaveCount(0);
});

test("a document that cannot be read says so in the sheet, and Try again reads it", async ({
  page,
}) => {
  await fakeDocuments(page);
  let fail = true;
  await page.route(`**/api/tax/fiscal/${documents[0]!.id}`, (route) =>
    fail
      ? route.fulfill({ status: 500, json: { error: "Server error" } })
      : route.fulfill({ json: detail(documents[0]!) }),
  );
  await page.goto("/tax/fiscal");
  await page.getByRole("button", { name: "BR1-T1-000123" }).click();
  const sheet = page.getByRole("dialog", { name: "Invoice BR1-T1-000123" });
  await expect(sheet.getByRole("alert")).toContainText("Could not load this document", {
    timeout: 20_000,
  });
  fail = false;
  await sheet.getByRole("button", { name: "Try again" }).click();
  await expect(sheet).toContainText("E_TIN: Buyer TIN is not registered");
  await expect(sheet.getByRole("alert")).toHaveCount(0);
});
