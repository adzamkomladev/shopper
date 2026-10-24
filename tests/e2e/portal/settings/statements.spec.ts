import { expect, test, type Page } from "@playwright/test";
import { orgId, setOrgSettings } from "../../../support/customers/portal";
import { shoot } from "../../../support/customers/shots";
import { BOX_API, expectNoSeriousAxe } from "../../../support/e2e";

// The owner of E2E Mart is signed in. The statement schedule is put back to off before each test.
const heading = (page: Page, name: string, level = 1) => page.getByRole("heading", { name, level });
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });

test.beforeEach(async ({ request }) => {
  await setOrgSettings(await orgId(request), {
    statement_schedule: "off",
    statement_day: 5,
    statement_channels: ["sms"],
    statement_min_balance: 0,
  });
});

test("turns on a monthly schedule, shows the next run and stores the settings", async ({
  page,
  request,
}, info) => {
  await page.goto("/settings/statements");
  await expect(heading(page, "Statements")).toBeVisible();
  await expect(page.getByText("Next run")).toHaveCount(0);
  await page.getByRole("combobox", { name: "Send statements" }).click();
  await page.getByRole("option", { name: "Monthly" }).click();
  await expect(page.getByText(/^Next run: 5 \w+ \d{4}$/)).toBeVisible();
  await field(page, "Day of the month").fill("12");
  await expect(page.getByText(/^Next run: 12 \w+ \d{4}$/)).toBeVisible();
  await page.getByRole("checkbox", { name: "Send by email" }).check();
  await field(page, "Minimum balance (GH₵)").fill("50.00");
  await expectNoSeriousAxe(page);
  await shoot(page, info, "settings-statements");
  await page.keyboard.press("Control+Enter");
  await expect(page.getByText("Statement settings saved")).toBeVisible();
  const saved = await (
    await request.get(`${BOX_API}/settings/statements`, {
      headers: { "X-Shopper-Org": await orgId(request) },
    })
  ).json();
  expect(saved).toEqual({
    schedule: "monthly",
    day: 12,
    channels: ["sms", "email"],
    minBalance: 500_000,
  });
});

test("a schedule needs a channel and a day from 1 to 28", async ({ page }) => {
  await page.goto("/settings/statements");
  await page.getByRole("combobox", { name: "Send statements" }).click();
  await page.getByRole("option", { name: "Monthly" }).click();
  await page.getByRole("checkbox", { name: "Send by SMS" }).uncheck();
  await field(page, "Day of the month").fill("31");
  await page.keyboard.press("Control+Enter");
  await expect(page.getByText("Enter a day from 1 to 28")).toBeVisible();
  await expect(page.getByText("Choose at least one channel")).toBeVisible();
  await expect(page.getByText("Statement settings saved")).toHaveCount(0);
});
