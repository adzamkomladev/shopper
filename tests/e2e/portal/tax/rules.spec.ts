import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { E2E_DATABASE_URL } from "../../../../tooling/database/e2e";
import { createStaff, signInAs } from "../../../support/admin/people";
import { orgId } from "../../../support/customers/portal";
import { shoot } from "../../../support/customers/shots";

// The dated rates. The owner (a super admin) schedules, edits and removes rates that start in the future;
// everyone else with tax.read only reads them. Scheduled rows left by earlier runs are cleared first.
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });
const inDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

// Screenshots at five sizes, each with an axe pass, take longer than the default minute.
test.describe.configure({ timeout: 180_000 });

test.beforeEach(async ({ request }) => {
  const client = new Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  await client.query("DELETE FROM tax_rule WHERE org_id = $1 AND effective_from > current_date", [
    await orgId(request),
  ]);
  await client.end();
});

test("the owner schedules new rates with the keyboard, edits them and removes them", async ({
  page,
}, info) => {
  await page.goto("/tax/rules");
  await expect(page.getByRole("tab", { name: "Rates" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("region", { name: "Tax rates" })).toContainText("In force");
  await page.getByRole("heading", { name: "Tax", level: 1 }).focus();
  await page.keyboard.press("n");
  const dialog = page.getByRole("dialog", { name: "Schedule new rates" });
  await expect(field(page, "Starts on")).toBeFocused();
  await field(page, "Starts on").fill(inDays(30));
  await field(page, "VAT (%)").fill("12.5");
  await field(page, "Source").fill("Budget statement");
  await shoot(page, info, "tax-rule-dialog", {
    sizes: [
      [1440, 900],
      [390, 844],
    ],
  });
  await page.keyboard.press("Control+Enter");
  await expect(page.getByText("Rule scheduled")).toBeVisible();
  await expect(dialog).toBeHidden();
  const row = page.getByRole("row").filter({ hasText: inDays(30) });
  await expect(row).toContainText("12.50%");
  await expect(row).toContainText("Scheduled");
  await shoot(page, info, "tax-rules");

  await row.getByRole("button", { name: /Edit/ }).click();
  await field(page, "VAT (%)").fill("13");
  await page.getByRole("button", { name: /Save rates/ }).click();
  await expect(row).toContainText("13.00%");
  await expect(row.getByRole("button", { name: /Edit/ })).toBeFocused();

  await row.getByRole("button", { name: /Remove/ }).click();
  await page.getByRole("button", { name: /Remove rates/ }).click();
  await expect(page.getByText("Rule removed")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: inDays(30) })).toHaveCount(0);
});

test("a rate cannot start today", async ({ page }) => {
  await page.goto("/tax/rules");
  await page.getByRole("button", { name: /Schedule new rates/ }).click();
  await field(page, "Starts on").fill(inDays(0));
  await field(page, "Source").fill("Too soon");
  await page.getByRole("button", { name: /Schedule rates/ }).click();
  await expect(page.getByRole("dialog")).toContainText("A rule must start after today");
});

test("an accountant reads the rates but cannot schedule them", async ({ page, request }, info) => {
  const accountant = await createStaff(request, "accountant", "Rates");
  await page.context().clearCookies();
  await signInAs(page, accountant);
  await page.goto("/tax/rules");
  await expect(page.getByRole("region", { name: "Tax rates" })).toContainText("In force");
  await expect(page.getByRole("button", { name: /Schedule new rates/ })).toHaveCount(0);
  await expect(page.getByText("Only a super admin can schedule new rates.")).toBeVisible();
  await shoot(page, info, "tax-rules-read-only", {
    sizes: [
      [1440, 900],
      [390, 844],
    ],
  });
});
