import { expect, test, type Page } from "@playwright/test";
import { createStaff, signInAs } from "../../../support/admin/people";
import { orgId, setOrgSettings } from "../../../support/customers/portal";
import { shoot } from "../../../support/customers/shots";
import { BOX_API, expectNoSeriousAxe } from "../../../support/e2e";

// The owner of E2E Mart is signed in. The credit settings are put back before each test.
const heading = (page: Page, name: string, level = 1) => page.getByRole("heading", { name, level });
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });

test.beforeEach(async ({ request }) => {
  await setOrgSettings(await orgId(request), { credit_terms_days: 30, credit_interest_bps: 0 });
});

test("saves the terms and a monthly interest rate, keeping % as basis points", async ({
  page,
  request,
}, info) => {
  await page.goto("/settings/credit");
  await expect(heading(page, "Credit")).toBeVisible();
  await expect(field(page, "Payment terms (days)")).toHaveValue("30");
  await expect(field(page, "Monthly interest (%)")).toHaveValue("0.00");
  await expect(page.getByText("0 turns interest off")).toBeVisible();
  await expectNoSeriousAxe(page);
  await shoot(page, info, "settings-credit");

  await field(page, "Payment terms (days)").fill("14");
  await field(page, "Monthly interest (%)").fill("1.5");
  await page.keyboard.press("Control+Enter");
  await expect(page.getByText("Credit settings saved")).toBeVisible();
  const saved = await (
    await request.get(`${BOX_API}/settings/credit`, {
      headers: { "X-Shopper-Org": await orgId(request) },
    })
  ).json();
  expect(saved).toEqual({ termsDays: 14, interestBps: 150 });
  await page.reload();
  await expect(field(page, "Monthly interest (%)")).toHaveValue("1.50");
});

test("refuses terms above a year and interest above 100%", async ({ page }) => {
  await page.goto("/settings/credit");
  await field(page, "Payment terms (days)").fill("400");
  await field(page, "Monthly interest (%)").fill("101");
  await page.keyboard.press("Control+Enter");
  await expect(page.getByText("Enter 0 to 365 days")).toBeVisible();
  await expect(field(page, "Payment terms (days)")).toBeFocused();
  await expect(page.getByText("Enter a rate from 0 to 100")).toBeVisible();
});

test("with the server unreachable the page says so and Try again recovers", async ({ page }) => {
  let failures = 1;
  await page.route("**/api/settings/credit", (route) =>
    failures-- > 0 ? route.abort("failed") : route.fallback(),
  );
  await page.goto("/settings/credit");
  await expect(page.getByText("Can't reach the server")).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(heading(page, "Credit")).toBeVisible();
});

test("offline, Save says it needs a connection", async ({ page, context }, info) => {
  await page.goto("/settings/credit");
  await expect(heading(page, "Credit")).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByRole("button", { name: /Save credit settings/ })).toBeDisabled();
  await expect(page.getByRole("main")).toContainText("You're offline");
  await shoot(page, info, "settings-credit-offline", { sizes: [[1440, 900]] });
  await context.setOffline(false);
});

test("a cashier is told the page needs permission", async ({ page, request }) => {
  const cashier = await createStaff(request, "cashier", "Credit");
  await page.context().clearCookies();
  await signInAs(page, cashier);
  await page.goto("/settings/credit");
  await expect(heading(page, "You don't have permission")).toBeVisible();
});
