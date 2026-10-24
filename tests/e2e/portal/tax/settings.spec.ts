import { expect, test, type Page } from "@playwright/test";
import { createStaff, signInAs } from "../../../support/admin/people";
import { orgId, setOrgSettings } from "../../../support/customers/portal";
import { shoot } from "../../../support/customers/shots";
import { BOX_API } from "../../../support/e2e";

// The tax settings and the summary tab. Settings are put back before each test.
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });

// Screenshots at five sizes, each with an axe pass, take longer than the default minute.
test.describe.configure({ timeout: 180_000 });

test.beforeEach(async ({ request }) => {
  await setOrgSettings(await orgId(request), {
    tin: null,
    vat_registered_from: "2000-01-01",
    price_mode: "inclusive",
    cash_rounding: "10p",
  });
});

test("the owner gives the TIN, keeps the shop registered and switches to exclusive prices", async ({
  page,
  request,
}, info) => {
  await page.goto("/tax/settings");
  await expect(page.getByRole("tab", { name: "Settings" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("switch", { name: "VAT-registered" })).toBeChecked();
  await page.getByRole("button", { name: /Save tax settings/ }).click();
  await expect(page.getByText(/Enter the TIN as on the VAT certificate/)).toBeVisible();
  await expect(field(page, "Business TIN")).toBeFocused();
  await field(page, "Business TIN").fill("c0012345678");
  await page.getByRole("combobox", { name: "Shelf prices" }).click();
  await page.getByRole("option", { name: "VAT and levies are added to shelf prices" }).click();
  await shoot(page, info, "tax-settings");
  await field(page, "Business TIN").focus();
  await page.keyboard.press("Control+Enter");
  await expect(page.getByText("Tax settings saved")).toBeVisible();
  const saved = await (
    await request.get(`${BOX_API}/settings/tax`, {
      headers: { "X-Shopper-Org": await orgId(request) },
    })
  ).json();
  expect(saved).toEqual({
    tin: "C0012345678",
    vatRegisteredFrom: "2000-01-01",
    priceMode: "exclusive",
    cashRounding: "10p",
  });
});

test("turning registration off hides the TIN and date", async ({ page }) => {
  await page.goto("/tax/settings");
  await page.getByRole("switch", { name: "VAT-registered" }).click();
  await expect(field(page, "Business TIN")).toHaveCount(0);
  await page.getByRole("button", { name: /Save tax settings/ }).click();
  await expect(page.getByText("Tax settings saved")).toBeVisible();
});

test("an accountant sees the settings but cannot change them", async ({ page, request }, info) => {
  const accountant = await createStaff(request, "accountant", "TaxSettings");
  await page.context().clearCookies();
  await signInAs(page, accountant);
  await page.goto("/tax/settings");
  await expect(page.getByText("Only a super admin can change the tax settings.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Save tax settings/ })).toHaveCount(0);
  await shoot(page, info, "tax-settings-read-only", {
    sizes: [
      [1440, 900],
      [390, 844],
    ],
  });
});

test("the summary for a quiet range says there were no sales", async ({ page }, info) => {
  await page.goto("/tax?from=2025-01-01&to=2025-01-31&group=month");
  await expect(page.getByRole("tab", { name: "Summary" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("No sales in 2025-01-01 to 2025-01-31")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Month" })).toBeChecked();
  await shoot(page, info, "tax-summary-empty");
});
