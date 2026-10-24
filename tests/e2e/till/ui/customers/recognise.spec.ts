// A regular is recognised at a real register by her phone number, on the keyboard alone, with and without the server.
import { mkdirSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { startCustomerScenario } from "../../../../support/till/customers/scenario";
import { installScanClock, scanCode } from "../sale/scanner";

// Set SHOPPER_SCREENSHOTS_DIR to keep the 1366x768 shots (docs/plans/day17/screenshots/till).
const shots = process.env.SHOPPER_SCREENSHOTS_DIR;
let scenario: Awaited<ReturnType<typeof startCustomerScenario>> | undefined;

test.beforeEach(async ({ page }, testInfo) => {
  // A server, a database and a host start before the page does.
  test.setTimeout(180_000);
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string") throw new Error("Playwright baseURL is required");
  scenario = await startCustomerScenario(new URL(baseURL).origin);
  await page.setViewportSize({ width: 1366, height: 768 });
  await installScanClock(page);
});
test.afterEach(async () => scenario?.stop());

const chip = (page: Page) => page.getByRole("group", { name: "Customer", exact: true });
const dialog = (page: Page) => page.getByRole("dialog", { name: "Add customer" });

/** Alt+U, the number, Enter to look up, Enter to attach: the whole job without touching the mouse. */
async function attachAma(page: Page) {
  await page.keyboard.press("Alt+U");
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.type("024 123 4567");
  await page.keyboard.press("Enter");
  await expect(dialog(page).getByRole("option", { name: /Ama Mensah/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toHaveCount(0);
  await expect(chip(page)).toContainText("Ama Mensah");
}

/** Scan, Ctrl+Enter to the tender step, cash, F5 to charge. */
async function chargeCash(page: Page) {
  await page.keyboard.press("F2");
  await scanCode(page, scenario!.barcode);
  await expect(page.getByRole("list", { name: "Basket lines" }).getByRole("listitem")).toHaveCount(
    1,
  );
  await page.keyboard.press("Control+Enter");
  await page.keyboard.press("Alt+1");
  await page.keyboard.press("F5");
  await expect(page.getByRole("region", { name: "Sale receipt" })).toBeVisible();
}

test("A regular customer is recognised at the till by phone number", async ({ page }, testInfo) => {
  await page.goto(scenario!.url);
  await expect(page.getByRole("region", { name: "Host connection" })).toContainText("Connected");
  await page.keyboard.press("S");
  await expect(page.getByRole("heading", { name: "Checkout", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: /Scan/ })).toBeFocused();

  // Her number is spaced the way a cashier types it; the register finds her on its own copy.
  await page.keyboard.press("Alt+U");
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.type("024 123 4567");
  await page.keyboard.press("Enter");
  await expect(dialog(page).getByRole("option", { name: /Ama Mensah/ })).toBeVisible();
  await expectNoSeriousAxe(page);
  await shoot(page, testInfo, "recognise-dialog-1366");
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toHaveCount(0);
  await expect(chip(page)).toContainText("Ama Mensah");
  await expect(chip(page)).toContainText("024 ••• 4567");
  await expectNoSeriousAxe(page);
  await shoot(page, testInfo, "recognise-chip-1366");

  await chargeCash(page);
  await expect
    .poll(() => scenario!.serverSales(), { timeout: 30_000 })
    .toEqual([scenario!.ama, scenario!.ama]);

  // The server goes away; she is still found, and her sale waits to upload with her name on it.
  scenario!.upstream.setAvailable(false);
  scenario!.upstream.setPullAvailable(false);
  scenario!.upstream.setLiveAvailable(false);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Basket is empty")).toBeVisible();
  await attachAma(page);
  await chargeCash(page);
  await expect(page.getByText("Server offline · 1 sale waiting to upload")).toBeVisible({
    timeout: 30_000,
  });
  expect(await scenario!.serverSales()).toHaveLength(2);

  scenario!.upstream.setAvailable(true);
  await expect
    .poll(() => scenario!.serverSales(), { timeout: 60_000, intervals: [1_000] })
    .toEqual([scenario!.ama, scenario!.ama, scenario!.ama]);
});

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  const path = shots ? `${shots}/${name}.png` : testInfo.outputPath(`${name}.png`);
  if (shots) mkdirSync(shots, { recursive: true });
  await page.screenshot({ path });
}
