// The settings screen against a real register host: save a printer, then Test print reaches the virtual printer.
import { expect, test, type TestInfo } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { freePort, startPrinter, type Printer } from "../../../../support/hardware/printer";
import { startSaleScenario } from "../../../../support/till/sale/scenario";
import { devices, shoot } from "./harness";

let scenario: Awaited<ReturnType<typeof startSaleScenario>> | undefined;
let printer: Printer | undefined;

test.beforeEach(async ({ page }, testInfo) => {
  scenario = await startSaleScenario(appOrigin(testInfo), ["register.settings"]);
  printer = await startPrinter();
  await page.setViewportSize({ width: 1366, height: 768 });
});
test.afterEach(async () => {
  await printer?.stop();
  await scenario?.stop();
});

test("a cashier with register.settings saves a printer and a test print reaches it", async ({
  page,
}, testInfo) => {
  await page.goto(scenario!.url);
  await expect(page.getByRole("region", { name: "Host connection" })).toContainText("Connected");
  await page.keyboard.press("S");
  await page.keyboard.press("Alt+T");
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(devices(page)).toContainText("No printer set up");
  await expect(page.getByRole("textbox", { name: "Store name" })).toHaveValue(/\S/);

  await devices(page)
    .getByRole("button", { name: /^Add printer/ })
    .click();
  await page.getByRole("textbox", { name: "IP address or host name" }).fill("127.0.0.1");
  await page.getByRole("textbox", { name: "Port" }).fill(String(printer!.port));
  await page.keyboard.press("ControlOrMeta+S");
  await expect(page.getByText("Register settings saved")).toBeVisible();
  await expect(devices(page)).toContainText(`127.0.0.1:${printer!.port}`);
  await expect(devices(page).getByText("Not checked")).toBeVisible();

  await page.keyboard.press("Alt+R");
  await expect(page.getByRole("status")).toContainText("Test page sent to the printer");
  const [job] = await printer!.waitForJobs(1);
  expect(job!.page).toContain("Printer test");
  await expect(devices(page).getByText("Connected", { exact: true })).toBeVisible();

  await page.keyboard.press("Alt+D");
  await expect(page.getByRole("status")).toContainText("Drawer opened");
  const jobs = await printer!.waitForJobs(2);
  expect(jobs[1]!.kicks).toBe(1);
  await expectNoSeriousAxe(page);
  await shoot(page, testInfo, "settings-live");

  // The host owns the saved settings: a reloaded register shows them without the browser's help.
  await page.goto(scenario!.url);
  await page.keyboard.press("S");
  await page.keyboard.press("Alt+T");
  await expect(devices(page)).toContainText(`127.0.0.1:${printer!.port}`);
});

test("an unreachable printer shows Offline on the badge after Test print", async ({ page }) => {
  await page.goto(scenario!.url);
  await expect(page.getByRole("region", { name: "Host connection" })).toContainText("Connected");
  await page.keyboard.press("S");
  await page.keyboard.press("Alt+T");
  await devices(page)
    .getByRole("button", { name: /^Add printer/ })
    .click();
  await page.getByRole("textbox", { name: "IP address or host name" }).fill("127.0.0.1");
  await page.getByRole("textbox", { name: "Port" }).fill(String(await freePort()));
  await page.keyboard.press("ControlOrMeta+S");
  await expect(page.getByText("Register settings saved")).toBeVisible();
  await page.keyboard.press("Alt+R");
  await expect(page.getByRole("alert").filter({ hasText: "Test print failed" })).toBeVisible();
  await expect(devices(page).getByText("Offline", { exact: true })).toBeVisible();
});

function appOrigin(testInfo: TestInfo) {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string") throw new Error("Playwright baseURL is required");
  return new URL(baseURL).origin;
}
