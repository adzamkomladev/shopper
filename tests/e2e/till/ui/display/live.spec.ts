// The customer display against a real register host: it follows the register page's basket and sale.
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { formatGHS, money } from "@shopper/money";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { startSaleScenario } from "../../../../support/till/sale/scenario";
import { openCheckout } from "../sale/harness";
import { installScanClock, scanCode } from "../sale/scanner";

let scenario: Awaited<ReturnType<typeof startSaleScenario>> | undefined;
test.afterEach(async () => scenario?.stop());

async function openBoth(page: Page, testInfo: TestInfo, watch?: (display: Page) => void) {
  const origin = new URL(String(testInfo.project.use.baseURL)).origin;
  scenario = await startSaleScenario(origin);
  const capability = new URL(scenario.url).hash;
  await installScanClock(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(scenario.url);
  await expect(page.getByRole("region", { name: "Host connection" })).toContainText("Connected");
  await page.keyboard.press("S");
  await expect(page.getByRole("combobox")).toBeFocused();
  const display = await page.context().newPage();
  await display.setViewportSize({ width: 1920, height: 1080 });
  watch?.(display);
  await display.goto(`${origin}/?display${capability}`);
  return display;
}

test("a scan in the till page updates the display page", async ({ page }, testInfo) => {
  const display = await openBoth(page, testInfo);
  await expect(display.getByRole("heading", { level: 1 })).toContainText("Welcome to");
  const [first, second] = scenario!.products;

  await scanCode(page, first!.barcode);
  await expect(display.getByRole("list", { name: "Basket lines" })).toContainText(first!.name);
  await expect(display.getByRole("region", { name: "Total" })).toContainText("1 item");
  await scanCode(page, second!.barcode);
  const lines = display.getByRole("list", { name: "Basket lines" }).getByRole("listitem");
  await expect(lines).toHaveCount(2);
  await expect(lines.last()).toContainText(second!.name);
  await expect(lines.last()).toHaveAttribute("aria-current", "true");
  await expect(display.getByRole("region", { name: "Total" })).toContainText(
    formatGHS(money(first!.amount + second!.amount)),
  );
  await expectNoSeriousAxe(display);
  await display.screenshot({ path: testInfo.outputPath("display-live.png") });

  // Completing the sale shows the thank-you screen with the change due.
  await openCheckout(page);
  await page.getByRole("textbox", { name: "Amount tendered" }).fill("5000.00");
  await page.keyboard.press("F5");
  await expect(display.getByRole("heading", { level: 1 })).toHaveText("Thank you");
  await expect(display.getByText("Change due").locator("..")).toContainText("GH₵");
});

test("the display only reads: it never sends a mutating request", async ({ page }, testInfo) => {
  const sent: string[] = [];
  const display = await openBoth(page, testInfo, (display) =>
    display.on("websocket", (socket) =>
      socket.on("framesent", (frame) => sent.push(JSON.parse(String(frame.payload)).type)),
    ),
  );
  await expect(display.getByRole("heading", { level: 1 })).toContainText("Welcome to");
  // The sale store also reads the draft when the page connects, so readDraft can appear twice.
  expect(new Set(sent)).toEqual(new Set(["hello", "readDraft"]));
});
