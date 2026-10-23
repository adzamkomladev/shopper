import { expect, test, type Page } from "@playwright/test";
import { createStaff, signInAs } from "../../../support/admin/people";
import { orgId, setOrgSettings } from "../../../support/customers/portal";
import { shoot } from "../../../support/customers/shots";
import { BOX_API, expectNoSeriousAxe } from "../../../support/e2e";

// The owner of E2E Mart is signed in. The org's loyalty settings are put back before each test.
const heading = (page: Page, name: string, level = 1) => page.getByRole("heading", { name, level });
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });
const tiers = (page: Page) => page.getByRole("region", { name: "Tiers" });

test.beforeEach(async ({ request }) => {
  await setOrgSettings(await orgId(request), {
    loyalty_enabled: false,
    loyalty_earn_bps: 100,
    loyalty_point_value: 100,
    loyalty_expiry_days: 0,
    tier_notice_days: 14,
  });
});

test("saves the settings with the keyboard, turning % and GH₵ into basis points and money", async ({
  page,
  request,
}, info) => {
  await page.goto("/settings/loyalty");
  await expect(heading(page, "Loyalty")).toBeVisible();
  await expect(field(page, "Earn rate (%)")).toHaveValue("1.00");
  await expect(field(page, "Value of one point (GH₵)")).toHaveValue("0.01");
  await expectNoSeriousAxe(page);
  await shoot(page, info, "settings-loyalty");

  await page.getByRole("switch", { name: "Loyalty points" }).focus();
  await page.keyboard.press("Space");
  await field(page, "Earn rate (%)").fill("2.5");
  await field(page, "Value of one point (GH₵)").fill("0.05");
  await field(page, "Points expire after (days)").fill("365");
  await field(page, "Tier change notice (days)").fill("7");
  await page.keyboard.press("Control+Enter");
  await expect(page.getByText("Loyalty settings saved")).toBeVisible();

  const saved = await (
    await request.get(`${BOX_API}/settings/loyalty`, {
      headers: { "X-Shopper-Org": await orgId(request) },
    })
  ).json();
  expect(saved).toEqual({
    enabled: true,
    earnBps: 250,
    pointValue: 500,
    expiryDays: 365,
    tierNoticeDays: 7,
  });
  await page.reload();
  await expect(field(page, "Earn rate (%)")).toHaveValue("2.50");
  await expect(field(page, "Value of one point (GH₵)")).toHaveValue("0.05");
});

test("refuses an earn rate with more than two decimals or a point worth nothing, and says which field", async ({
  page,
}) => {
  await page.goto("/settings/loyalty");
  await field(page, "Earn rate (%)").fill("2.555");
  await page.keyboard.press("Control+Enter");
  await expect(page.getByText("Enter a rate like 2.5")).toBeVisible();
  await expect(field(page, "Earn rate (%)")).toBeFocused();
  await field(page, "Earn rate (%)").fill("2.5");
  await field(page, "Value of one point (GH₵)").fill("0");
  await page.keyboard.press("Control+Enter");
  await expect(page.getByText("Enter an amount above zero, like 0.05")).toBeVisible();
});

test("adds, edits and archives a tier from the keyboard", async ({ page }, info) => {
  const name = `Gold ${Date.now().toString(36)}`;
  await page.goto("/settings/loyalty");
  await expect(heading(page, "Loyalty")).toBeVisible();
  await page.keyboard.press("n");
  const sheet = page.getByRole("dialog", { name: "New tier" });
  await expect(sheet.getByLabel("Name")).toBeFocused();
  await sheet.getByLabel("Name").fill(name);
  await sheet.getByLabel("Minimum spend (GH₵)").fill("5000");
  await sheet.getByLabel("Earn rate (%)").fill("3");
  await shoot(page, info, "settings-loyalty-tier", {
    sizes: [
      [1440, 900],
      [390, 844],
    ],
  });
  await page.keyboard.press("Control+Enter");
  await expect(sheet).toHaveCount(0);
  const row = tiers(page).getByRole("row", { name: new RegExp(name) });
  await expect(row).toContainText("GH₵ 5,000.00");
  await expect(row).toContainText("3.00%");

  await row.getByRole("button", { name: `Edit ${name}` }).click();
  await page.getByRole("dialog", { name: "Edit tier" }).getByLabel("Earn rate (%)").fill("3.5");
  await page.keyboard.press("Control+Enter");
  await expect(row).toContainText("3.50%");

  await row.getByRole("button", { name: `Archive ${name}` }).click();
  await page
    .getByRole("dialog", { name: /^Archive / })
    .getByRole("button", { name: "Archive tier" })
    .click();
  await expect(tiers(page).getByRole("row", { name: new RegExp(name) })).toHaveCount(0);
});

test("with the server unreachable the page says so and Try again recovers", async ({ page }) => {
  let failures = 1;
  await page.route("**/api/settings/loyalty", (route) =>
    failures-- > 0 ? route.abort("failed") : route.fallback(),
  );
  await page.goto("/settings/loyalty");
  await expect(page.getByText("Can't reach the server")).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(heading(page, "Loyalty")).toBeVisible();
});

test("offline, Save says it needs a connection", async ({ page, context }) => {
  await page.goto("/settings/loyalty");
  await expect(heading(page, "Loyalty")).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByRole("button", { name: /Save loyalty settings/ })).toBeDisabled();
  await expect(page.getByRole("main")).toContainText("You're offline");
  await context.setOffline(false);
});

test("a cashier is told the page needs permission", async ({ page, request }, info) => {
  const cashier = await createStaff(request, "cashier", "Loyal");
  await page.context().clearCookies();
  await signInAs(page, cashier);
  await page.goto("/settings/loyalty");
  await expect(heading(page, "You don't have permission")).toBeVisible();
  await shoot(page, info, "settings-loyalty-no-permission", { sizes: [[1440, 900]] });
});
