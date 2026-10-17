// The completion view's print status against a real register host and the virtual printer.
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { startPrinter, type Printer } from "../../../../support/hardware/printer";
import { startSaleScenario } from "../../../../support/till/sale/scenario";
import { devices, shoot } from "../settings/harness";
import { installScanClock, scanCode } from "./scanner";

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

const receipt = (page: Page) => page.getByRole("region", { name: "Sale receipt" });

async function addPrinter(page: Page, autoPrint: boolean) {
  await page.goto(scenario!.url);
  await expect(page.getByRole("region", { name: "Host connection" })).toContainText("Connected");
  await page.keyboard.press("S");
  await page.keyboard.press("Alt+T");
  await devices(page)
    .getByRole("button", { name: /^Add printer/ })
    .click();
  await page.getByRole("textbox", { name: "IP address or host name" }).fill("127.0.0.1");
  await page.getByRole("textbox", { name: "Port" }).fill(String(printer!.port));
  if (!autoPrint) await page.getByRole("switch", { name: "Print receipts automatically" }).click();
  await page.keyboard.press("ControlOrMeta+S");
  await expect(page.getByText("Register settings saved")).toBeVisible();
  await page.keyboard.press("Alt+S");
}

async function sellCash(page: Page) {
  await scanCode(page, scenario!.products[0]!.barcode);
  await page.getByRole("button", { name: /^Charge / }).click();
  await expect(receipt(page)).toBeVisible();
}

async function testPrint(page: Page) {
  await page.keyboard.press("Alt+T");
  await page.keyboard.press("Alt+R");
  await expect(page.getByRole("status").filter({ hasText: "Test page sent" })).toBeVisible();
  await page.keyboard.press("Alt+S");
  await expect(receipt(page)).toBeVisible();
}

test("with auto-print off a cash sale is Not printed, whatever the drawer and a test print did", async ({
  page,
}, testInfo) => {
  await addPrinter(page, false);
  await sellCash(page);
  // The drawer kick was a printer job, but not a receipt.
  await expect(receipt(page).getByRole("status")).toContainText("Not printed");
  await expect(receipt(page).getByRole("button", { name: /^Print receipt/ })).toBeVisible();
  await shoot(page, testInfo, "live-not-printed");

  await testPrint(page);
  await expect(receipt(page).getByRole("status")).toContainText("Not printed");

  await page.keyboard.press("Alt+R");
  await expect(receipt(page).getByText("Receipt printed")).toBeVisible();
  const jobs = await printer!.waitForJobs(3);
  // Kick, test page, then the first copy of the receipt: no REPRINT banner.
  expect(jobs[2]!.page).toContain("TOTAL");
  expect(jobs[2]!.page).not.toContain("REPRINT");
});

test("a printed receipt stays printed after a test print", async ({ page }) => {
  await addPrinter(page, true);
  await sellCash(page);
  await expect(receipt(page).getByText("Receipt printed")).toBeVisible();
  await testPrint(page);
  await expect(receipt(page).getByText("Receipt printed")).toBeVisible();
  await expect(receipt(page).getByRole("button", { name: /Print|Reprint/ })).toHaveCount(0);
});

test("a print the host never reports becomes unknown after 15 seconds and can be reprinted", async ({
  page,
}, testInfo) => {
  // The host's job reports are dropped on the way to the browser, so the browser never sees an outcome.
  await page.routeWebSocket(
    (url) => url.pathname.endsWith("/bridge"),
    (route) => {
      const host = route.connectToServer();
      route.onMessage((message) => host.send(message));
      host.onMessage((message) =>
        route.send(String(message).replace(/"lastJob":\{[^}]*\}/g, '"lastJob":null')),
      );
    },
  );
  await addPrinter(page, true);
  await sellCash(page);
  await expect(receipt(page).getByRole("status")).toContainText("Printing receipt…");
  // Real time: the wait is 15 seconds.
  await expect(receipt(page).getByRole("status")).toContainText("Print status unknown", {
    timeout: 25_000,
  });
  await shoot(page, testInfo, "live-unknown");
  await page.keyboard.press("Alt+R");
  await expect(receipt(page).getByText("Receipt printed")).toBeVisible();
  // The first copy had printed, so this one is the reprint.
  const jobs = await printer!.waitForJobs(2);
  expect(jobs[1]!.page).toContain("*** REPRINT ***");
});

function appOrigin(testInfo: TestInfo) {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string") throw new Error("Playwright baseURL is required");
  return new URL(baseURL).origin;
}
