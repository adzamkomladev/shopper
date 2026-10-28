// The Day 25 milestone: a supermarket goes from sign-up to its first sale without calling anyone. Signup and the
// emailed link, the wizard with a real spreadsheet import and a till code, a fresh browser-mode till that enrols with
// that code, the owner signing in and ringing up a cash sale, and the shop showing as trading.
import { expect, test, type Page } from "@playwright/test";
import { e2eRun } from "../../../../tooling/e2e/run";
import { checkFile, cleanRows, writeSheet } from "../../../support/import";
import {
  NEW_PASSWORD,
  newRegistration,
  submitPassword,
  submitSignup,
  verifyFromEmail,
} from "../../../support/publicauth/flow";
import { startFreshTill } from "../../../support/till/enrol/scenario";

const tillUi = e2eRun.url(5184);
let till: Awaited<ReturnType<typeof startFreshTill>> | undefined;
test.afterEach(async () => till?.stop());

test("a new shop signs up, sets up, enrols a till and makes its first sale", async ({
  page,
  request,
  context,
}, info) => {
  test.setTimeout(600_000);
  const data = newRegistration();
  await submitSignup(page, data);
  await verifyFromEmail(page, request, data);
  await submitPassword(page);
  await expect(page.getByRole("heading", { name: "You're signed in" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Get your shop ready" })).toBeVisible();

  await page.getByRole("button", { name: "Add store" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Main store");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expectStep(page, "Branch");
  await page.getByRole("button", { name: "Add branch" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Osu");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expectStep(page, "Tax");
  await page.getByLabel("Business TIN").fill("C0012345678");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expectStep(page, "Products");

  // A real spreadsheet, sent straight to storage and imported.
  const rows = cleanRows(data.shopCode, 3);
  const product = rows[0]!;
  await page.getByRole("link", { name: "Import spreadsheet" }).click();
  await checkFile(page, writeSheet(info, rows, "csv"));
  await page.getByRole("button", { name: "Import 3 products" }).click();
  await expect(page.getByRole("link", { name: "View products" })).toBeVisible({ timeout: 30_000 });
  // Until the first sale every screen keeps the way back into setup.
  await page.getByRole("link", { name: "View products" }).click();
  await expect(page.getByRole("region", { name: "Shop setup" })).toBeVisible();

  await page.goto("/setup?step=till");
  await expectStep(page, "Till");
  await page.getByRole("button", { name: "Create enrolment code" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Branch").click();
  await page.getByRole("option", { name: "Osu" }).click();
  await page.keyboard.press("ControlOrMeta+Enter");
  const code = (await dialog.getByLabel("Enrolment code").textContent())!.replace(/\D/g, "");
  await expect(dialog.getByText(`Shop code ${data.shopCode}`)).toBeVisible();

  // The till, fresh from the installer, talks to the same API the portal does.
  till = await startFreshTill(e2eRun.url(3102), new URL(tillUi).origin);
  const register = await context.newPage();
  await register.setViewportSize({ width: 1366, height: 768 });
  await register.goto(till.url);
  await register.getByLabel("Shop code").fill(data.shopCode);
  await register.getByLabel("Enrolment code").fill(code);
  await register.getByLabel("Till name").fill("Front till");
  await register.keyboard.press("Enter");
  await expect(register.getByText(/Front till is set up for/)).toBeVisible({ timeout: 30_000 });
  await register.getByRole("textbox", { name: "Username" }).fill(data.email);
  await register.getByLabel("Password").fill(NEW_PASSWORD);
  await register.keyboard.press("Enter");

  // The register opens with a counted float, then sells the imported product for cash.
  await expect(register.getByRole("heading", { name: "Register closed", exact: true })).toBeVisible(
    {
      timeout: 30_000,
    },
  );
  await register.keyboard.press("Alt+O");
  await register.getByRole("textbox", { name: "Count of GH₵ 200", exact: true }).fill("1");
  await register.keyboard.press("ControlOrMeta+Enter");
  const search = register.getByRole("combobox", { name: "Scan barcode or search items" });
  await expect(search).toBeFocused();
  await search.fill(String(product.SKU));
  await register.getByRole("option", { name: String(product.Name) }).click({ timeout: 60_000 });
  await register.getByRole("button", { name: /^Checkout/ }).click();
  await register.getByRole("textbox", { name: "Amount tendered" }).fill("1000.00");
  await register.keyboard.press("F5");
  await expect(register.getByRole("region", { name: "Sale receipt" })).toBeVisible();

  // Once the sale reaches the server the shop is trading, and the setup banner is gone.
  await expect(async () => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: "Products", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Shop setup" })).toHaveCount(0);
  }).toPass({ timeout: 120_000 });
});

async function expectStep(page: Page, name: string) {
  await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
}
