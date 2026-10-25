import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createStaff, signInAs } from "../../support/admin/people";
import { seedShifts } from "../../support/admin/shifts";
import { openProduct, seedPrice } from "../../support/catalogue";
import { shoot } from "../../support/customers/shots";
import { OWNER_NAME } from "../../support/e2e";

// The Audit area as the owner of E2E Mart: the merged log, an entry's before and after, the CSV, and the chains'
// integrity. The API's behaviour (filters, paging, tamper detection) is covered by tests/integration/audit; a broken
// chain is faked here so its Fail state and link can be seen and driven.
test.describe.configure({ timeout: 180_000 });

const heading = (page: Page, name: string, level = 1) => page.getByRole("heading", { name, level });

test("who changed this price, when, where and approved by whom: three clicks from the product", async ({
  page,
  request,
}, info) => {
  const product = await openProduct(page, request, "Sugar");
  await seedPrice(request, product.id, 125_000);
  await seedPrice(request, product.id, 131_000);
  await page.reload();
  // 1: History on the product.
  await page.getByRole("link", { name: /History/ }).click();
  await expect(page).toHaveURL(new RegExp(`entity=product.*entityId=${product.id}`));
  const table = page.getByRole("region", { name: "Audit entries" });
  const rows = table.getByRole("row").filter({ hasText: "Price set" });
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText(OWNER_NAME);
  await expect(rows.first()).toContainText("Back office");
  await shoot(page, info, "audit-log", {
    sizes: [
      [1920, 1080],
      [1440, 900],
      [1366, 768],
      [768, 1024],
      [390, 844],
    ],
  });
  // 2: the newest change.
  await rows.first().getByRole("button", { name: "Price set" }).click();
  const sheet = page.getByRole("dialog", { name: "Price set" });
  await expect(sheet).toContainText(OWNER_NAME);
  await expect(sheet).toContainText("No approval needed");
  const amount = sheet.getByRole("row", { name: /amount/ });
  await expect(amount).toContainText("125000");
  await expect(amount).toContainText("131000");
  await expect(amount).toHaveAttribute("data-changed", "true");
  await shoot(page, info, "audit-entry", {
    sizes: [
      [1440, 900],
      [390, 844],
    ],
  });
  // The open entry is in the address: Escape closes it, and focus goes back to the row.
  await expect(page).toHaveURL(/entry=/);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(page).not.toHaveURL(/entry=/);
  await expect(rows.first().getByRole("button", { name: "Price set" })).toBeFocused();
});

test("filters live in the address, / reaches them, and a filter that matches nothing says so", async ({
  page,
}, info) => {
  await page.goto("/audit");
  await heading(page, "Audit").focus();
  await page.keyboard.press("/");
  await expect(page.getByRole("combobox", { name: "Actor" })).toBeFocused();
  await page.getByRole("combobox", { name: "Action" }).click();
  await page.getByRole("option", { name: "Price set" }).click();
  await expect(page).toHaveURL(/command=price.set/);
  await expect(
    page
      .getByRole("region", { name: "Audit entries" })
      .getByRole("row")
      .filter({ hasText: "Price set" })
      .first(),
  ).toBeVisible();
  await page.getByLabel("From").fill("2099-01-01");
  await expect(page).toHaveURL(/from=2099-01-01/);
  await expect(heading(page, "Nothing matches these filters", 2)).toBeVisible();
  await shoot(page, info, "audit-filtered-empty", {
    sizes: [
      [1440, 900],
      [390, 844],
    ],
  });
  // Filters replace the address rather than stack history, so a reload (or a shared link) keeps them.
  await page.reload();
  await expect(heading(page, "Nothing matches these filters", 2)).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).first().click();
  await expect(page).toHaveURL(/\/audit$/);
});

test("E exports the filtered log as CSV", async ({ page }) => {
  await page.goto("/audit?command=price.set");
  await heading(page, "Audit").focus();
  const download = page.waitForEvent("download");
  await page.keyboard.press("e");
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^audit-\d{4}-\d{2}-\d{2}\.csv$/);
  const lines = readFileSync((await file.path())!, "utf8")
    .trim()
    .split("\n");
  expect(lines[0]).toMatch(/^Time,Device time,Stream,Seq,Actor,Role,Device,Branch,Command,/);
  expect(lines.slice(1).every((line) => line.includes(",price.set,"))).toBe(true);
});

test("Verify all re-hashes every chain to a pass, and a broken chain names the entry that broke it", async ({
  page,
}, info) => {
  await page.goto("/audit/integrity");
  await expect(page.getByRole("tab", { name: "Integrity" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const chains = page.getByRole("region", { name: "Audit chains" });
  const org = chains.getByRole("row").filter({ hasText: "Back office" });
  await expect(org).toBeVisible();
  await heading(page, "Audit")
    .focus()
    .catch(() => undefined);
  await page.keyboard.press("v");
  await expect(org.getByText("Pass")).toBeVisible({ timeout: 60_000 });
  await expect(chains.getByText("Fail")).toHaveCount(0);
  await shoot(page, info, "audit-integrity", {
    sizes: [
      [1920, 1080],
      [1440, 900],
      [1366, 768],
      [768, 1024],
      [390, 844],
    ],
  });

  const broken = "019a0000-0000-7000-8000-00000000a0d1";
  await page.route("**/api/audit/verify?stream=org", (route) =>
    route.fulfill({ json: { valid: false, entryId: broken, seq: 12, reason: "hash" } }),
  );
  await org.getByRole("button", { name: "Verify Back office" }).click();
  await expect(org.getByText("Fail")).toBeVisible();
  await expect(org).toContainText("At #12: an entry was changed after it was written.");
  await shoot(page, info, "audit-integrity-fail", {
    sizes: [
      [1440, 900],
      [390, 844],
    ],
  });
  await org.getByRole("link", { name: "Open the entry" }).click();
  await expect(page).toHaveURL(new RegExp(`/audit\\?entry=${broken}`));
  await expect(page.getByRole("dialog")).toBeVisible();
  // The linked entry has no row on the page: closing hands focus to the heading, not the document.
  await page.keyboard.press("Escape");
  await expect(heading(page, "Audit")).toBeFocused();
});

test("a closed shift says whether its Z matches the server and whether its anchor holds", async ({
  page,
}) => {
  const { till } = await seedShifts();
  await page.goto("/shifts");
  // The seeded Zs claim sales the server never received, and their registers never uploaded a chain.
  const row = page.getByRole("row").filter({ hasText: till }).first();
  await expect(row).toContainText("Totals differ");
  await row.getByRole("link").first().click();
  await expect(page.getByText("Differ in number of sales")).toBeVisible();
  await expect(page.getByText("Waiting for the register's chain")).toBeVisible();
});

test("an accountant reads the log; a cashier sees no Audit and is told why", async ({
  page,
  request,
}) => {
  const accountant = await createStaff(request, "accountant", "Audit");
  const cashier = await createStaff(request, "cashier", "Audit");
  await page.context().clearCookies();
  await signInAs(page, accountant);
  await page.goto("/audit");
  await expect(page.getByRole("region", { name: "Audit entries" })).toBeVisible();
  await page.context().clearCookies();
  await signInAs(page, cashier);
  await page.goto("/products");
  await expect(page.getByRole("link", { name: "Audit" })).toHaveCount(0);
  await page.goto("/audit");
  await expect(page.getByText(/the audit log/i).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Audit entries" })).toHaveCount(0);
});
