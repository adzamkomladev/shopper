// Reprint against a real register host and the virtual printer: the second captured job is the REPRINT copy.
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { startPrinter, type Printer } from "../../../../support/hardware/printer";
import { startSaleScenario } from "../../../../support/till/sale/scenario";
import { devices, shoot } from "../settings/harness";
import { openCheckout } from "../sale/harness";
import { installScanClock, scanCode } from "../sale/scanner";

let scenario: Awaited<ReturnType<typeof startSaleScenario>> | undefined;
let printer: Printer | undefined;

test.beforeEach(async ({ page }, testInfo) => {
  scenario = await startSaleScenario(appOrigin(testInfo), ["register.settings"]);
  printer = await startPrinter();
  await page.setViewportSize({ width: 1366, height: 768 });
  await installScanClock(page);
});
test.afterEach(async () => {
  await printer?.stop();
  await scenario?.stop();
});

async function addPrinter(page: Page) {
  await page.keyboard.press("Alt+T");
  await devices(page)
    .getByRole("button", { name: /^Add printer/ })
    .click();
  await page.getByRole("textbox", { name: "IP address or host name" }).fill("127.0.0.1");
  await page.getByRole("textbox", { name: "Port" }).fill(String(printer!.port));
  await page.keyboard.press("ControlOrMeta+S");
  await expect(page.getByText("Register settings saved")).toBeVisible();
}

test("Reprint on a purchase prints a REPRINT copy and the card counts it", async ({
  page,
}, testInfo) => {
  await page.goto(scenario!.url);
  await expect(page.getByRole("region", { name: "Host connection" })).toContainText("Connected");
  await page.keyboard.press("S");
  await addPrinter(page);
  await page.keyboard.press("Alt+S");
  await scanCode(page, scenario!.products[0]!.barcode);
  await openCheckout(page);
  await page.getByRole("button", { name: /^Charge / }).click();
  const receipt = page.getByRole("region", { name: "Sale receipt" });
  await expect(receipt.getByText("Receipt printed")).toBeVisible();
  const [first] = await printer!.waitForJobs(1);
  expect(first!.page).not.toContain("REPRINT");

  await page.keyboard.press("Alt+P");
  await page
    .getByRole("button", { name: /[AP]M #/ })
    .first()
    .click();
  const card = page.getByRole("region", { name: "Receipt metadata" });
  await expect(card).toContainText("Printed");
  await expect(card).not.toContainText("reprinted");
  await page.keyboard.press("Alt+R");
  await expect(card).toContainText("Printed · reprinted 1×");
  const jobs = await printer!.waitForJobs(2);
  expect(jobs[1]!.page).toContain("*** REPRINT ***");
  expect(jobs[1]!.kicks).toBe(0);

  await page.keyboard.press("Alt+V");
  await expect(page.getByRole("region", { name: "Receipt preview" })).toContainText(
    scenario!.products[0]!.name,
  );
  await expectNoSeriousAxe(page);
  await shoot(page, testInfo, "live-reprint");
});

function appOrigin(testInfo: TestInfo) {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string") throw new Error("Playwright baseURL is required");
  return new URL(baseURL).origin;
}
