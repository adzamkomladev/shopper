import { expect, test, type Page } from "@playwright/test";
import { createStaff, signInAs } from "../../../support/admin/people";
import { orgId, setOrgSettings } from "../../../support/customers/portal";
import { shoot } from "../../../support/customers/shots";
import { BOX_API, expectNoSeriousAxe } from "../../../support/e2e";

// The owner of E2E Mart is signed in. The KYC settings are put back before each test.
const heading = (page: Page, name: string, level = 1) => page.getByRole("heading", { name, level });
const accepted = (page: Page, name: string) => page.getByRole("checkbox", { name });

test.beforeEach(async ({ request }) => {
  await setOrgSettings(await orgId(request), {
    kyc_id_required: false,
    kyc_id_types: ["ghana_card", "passport", "voter_id", "drivers_licence"],
  });
});

test("saves whether an ID is required and which types are accepted", async ({
  page,
  request,
}, info) => {
  await page.goto("/settings/kyc");
  await expect(heading(page, "Identity check settings")).toBeVisible();
  await expect(page.getByRole("switch", { name: "Require an ID document" })).not.toBeChecked();
  await expect(accepted(page, "Ghana Card")).toBeChecked();
  await expectNoSeriousAxe(page);
  await shoot(page, info, "settings-kyc");

  await page.getByRole("switch", { name: "Require an ID document" }).focus();
  await page.keyboard.press("Space");
  await accepted(page, "Passport").uncheck();
  await accepted(page, "Voter ID").uncheck();
  await page.keyboard.press("Control+Enter");
  await expect(page.getByText("Identity check settings saved")).toBeVisible();
  const saved = await (
    await request.get(`${BOX_API}/settings/kyc`, {
      headers: { "X-Shopper-Org": await orgId(request) },
    })
  ).json();
  expect(saved).toEqual({ idRequired: true, idTypes: ["ghana_card", "drivers_licence"] });
  await page.reload();
  await expect(accepted(page, "Passport")).not.toBeChecked();
  await expect(page.getByRole("switch", { name: "Require an ID document" })).toBeChecked();
});

test("at least one ID type must stay accepted", async ({ page }) => {
  await page.goto("/settings/kyc");
  for (const name of ["Ghana Card", "Passport", "Voter ID", "Driver's licence"])
    await accepted(page, name).uncheck();
  await page.keyboard.press("Control+Enter");
  await expect(page.getByText("Accept at least one type of ID")).toBeVisible();
  await expect(accepted(page, "Ghana Card")).toBeFocused();
});

test("with the server unreachable the page says so and Try again recovers", async ({ page }) => {
  let failures = 1;
  await page.route("**/api/settings/kyc", (route) =>
    failures-- > 0 ? route.abort("failed") : route.fallback(),
  );
  await page.goto("/settings/kyc");
  await expect(page.getByText("Can't reach the server")).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(heading(page, "Identity check settings")).toBeVisible();
});

test("offline, Save says it needs a connection", async ({ page, context }) => {
  await page.goto("/settings/kyc");
  await expect(heading(page, "Identity check settings")).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByRole("button", { name: /Save identity check settings/ })).toBeDisabled();
  await context.setOffline(false);
});

test("a cashier is told the page needs permission", async ({ page, request }) => {
  const cashier = await createStaff(request, "cashier", "Idcheck");
  await page.context().clearCookies();
  await signInAs(page, cashier);
  await page.goto("/settings/kyc");
  await expect(heading(page, "You don't have permission")).toBeVisible();
});
