import { expect, test, type Request } from "@playwright/test";
import { createStaff, signInAs } from "../../../support/admin/people";
import { shoot } from "../../../support/customers/shots";
import { busyReconciliation } from "../../../support/payments/manage";
import { SIZES, heading, replay } from "../../../support/payments/screens";

// The owner of E2E Mart is signed in. A busy day is replayed to draw the mismatch; the real API answers the rest.
test.describe.configure({ timeout: 180_000 });

test("a settlement mismatch is flagged on the reconciliation screen", async ({ page }, info) => {
  await replay(page, "/reconciliation", busyReconciliation);
  await page.goto("/payments/reconciliation?day=2026-10-27");
  await expect(heading(page, "Payments")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Reconciliation" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const mismatches = page.getByRole("table", { name: "Settlement mismatches" });
  const row = mismatches.getByRole("row").filter({ hasText: "SHP-MOMO-7F3A21" });
  await expect(row).toContainText("Amount mismatch");
  await expect(row).toContainText("OSU1-T01-000481");
  await expect(page.getByRole("table", { name: "By tender" })).toContainText("Cash");
  await expect(page.getByRole("table", { name: "By shift" })).toBeVisible();
  await shoot(page, info, "payments-reconciliation-busy", { sizes: SIZES });
});

test("] and [ step the day, and R refreshes the settlement once", async ({ page }) => {
  const posted: Request[] = [];
  await replay(page, "/reconciliation/settlements/refresh", { started: true }, posted);
  await page.goto("/payments/reconciliation?day=2026-10-27");
  await expect(heading(page, "Payments")).toBeVisible();
  await page.keyboard.press("]");
  await expect(page).toHaveURL(/day=2026-10-28/);
  await page.keyboard.press("[");
  await page.keyboard.press("[");
  await expect(page).toHaveURL(/day=2026-10-26/);
  await expect(page.getByRole("button", { name: /Refresh settlement/ })).toBeEnabled();
  await page.keyboard.press("r");
  await expect.poll(() => posted.length).toBe(1);
  await expect(page.getByText(/Fetching the day's Paystack settlements/)).toBeVisible();
  expect(posted).toHaveLength(1);
});

test("a refresh the server refuses says so", async ({ page }) => {
  await page.route(
    (url) => url.pathname.endsWith("/api/reconciliation/settlements/refresh"),
    (route) => route.fulfill({ status: 503, json: { error: "Paystack is not configured" } }),
  );
  await page.goto("/payments/reconciliation?day=2026-10-27");
  await expect(heading(page, "Payments")).toBeVisible();
  await page.getByRole("button", { name: /Refresh settlement/ }).click();
  await expect(page.getByText(/Couldn't start the settlement refresh/)).toBeVisible();
});

test("a quiet day shows its empty tables", async ({ page }, info) => {
  await page.goto("/payments/reconciliation?day=2020-01-01");
  await expect(heading(page, "Payments")).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("Amount mismatch");
  await shoot(page, info, "payments-reconciliation-quiet", {
    sizes: [
      [1440, 900],
      [390, 844],
    ],
  });
});

test("without report.read there is no link and the page says why", async ({ page, request }) => {
  const clerk = await createStaff(request, "inventory", "Recon");
  await page.context().clearCookies();
  await signInAs(page, clerk);
  await expect(page.getByRole("link", { name: "Payments" })).toHaveCount(0);
  await page.goto("/payments/reconciliation");
  await expect(page.getByRole("main")).toContainText("You don't have permission");
});
