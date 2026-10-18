// The sale screen against a real register host and till SQLite: scans, search, edits and a reopened basket.
import { mkdirSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { add, formatGHS, money, mulQty } from "@shopper/money";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { startSaleScenario } from "../../../../support/till/sale/scenario";
import { openCheckout } from "./harness";

// Set SHOPPER_SCREENSHOTS_DIR to keep the 1366x768 shots (docs/plans/day10/screenshots/till).
const shots = process.env.SHOPPER_SCREENSHOTS_DIR;
let scenario: Awaited<ReturnType<typeof startSaleScenario>> | undefined;

test.beforeEach(async ({ page }, testInfo) => {
  scenario = await startSaleScenario(appOrigin(testInfo));
  await page.setViewportSize({ width: 1366, height: 768 });
  // The scan detector reads KeyboardEvent.timeStamp. A loaded machine can stretch real key gaps past
  // 60 ms, so scans stamp their keys from a test clock; the keys themselves are real presses.
  await page.addInitScript(() => {
    let now: number | null = null;
    const real = Object.getOwnPropertyDescriptor(Event.prototype, "timeStamp")!;
    Object.defineProperty(Event.prototype, "timeStamp", {
      get() {
        return now ?? real.get!.call(this);
      },
    });
    document.addEventListener(
      "keydown",
      () => {
        if (now !== null) now += 10;
      },
      true,
    );
    Object.assign(window, { scanClock: (value: number | null) => (now = value) });
  });
});
test.afterEach(async () => scenario?.stop());

const field = (page: Page) => page.getByRole("combobox");
const lines = (page: Page) =>
  page.getByRole("list", { name: "Basket lines" }).getByRole("listitem");

async function openSale(page: Page) {
  await page.goto(scenario!.url);
  await expect(page.getByRole("region", { name: "Host connection" })).toContainText("Connected");
  await page.keyboard.press("S");
  await expect(page.getByRole("heading", { name: "Checkout", exact: true })).toBeVisible();
  await expect(field(page)).toBeFocused();
}

test("thirty keyboard scans land in under a minute and the basket outlives the page", async ({
  page,
}, testInfo) => {
  await delayFirstReply(page, "add", 1500);
  await openSale(page);
  await expect(page.getByText("Basket is empty")).toBeVisible();
  const products = scenario!.products;
  const started = Date.now();
  for (let index = 0; index < 30; index += 1)
    await scan(page, products[index % products.length]!.barcode);
  await expect(lines(page)).toHaveCount(10);
  for (const product of products) {
    const line = lines(page).filter({ hasText: product.name });
    await expect(line).toContainText(product.sku);
    await expect(line).toContainText(`3${formatGHS(money(product.amount))}`);
    await expect(line).toContainText(formatGHS(mulQty(money(product.amount), 3000)));
  }
  const total = formatGHS(
    products.map((product) => mulQty(money(product.amount), 3000)).reduce(add),
  );
  await expect(page.getByRole("region", { name: "Basket" })).toContainText(total);
  expect(Date.now() - started).toBeLessThan(60_000);
  await expect(page.getByText("Saved on this register", { exact: true })).toBeVisible();
  await expectNoSeriousAxe(page);
  await shoot(page, testInfo, "live");

  // The capability stays valid for this host run; reopening the register shows the same basket.
  await page.goto("about:blank");
  await openSale(page);
  await expect(lines(page)).toHaveCount(10);
  await expect(page.getByRole("region", { name: "Basket" })).toContainText(total);
});

test("search adds by name, F4 sets a quantity, Delete removes and an unknown scan explains", async ({
  page,
}) => {
  await openSale(page);
  await field(page).pressSequentially("sardines", { delay: 90 });
  await expect(page.getByRole("option", { name: /Titus sardines 125g/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(lines(page)).toHaveCount(1);
  await expect(field(page)).toHaveValue("");

  await page.keyboard.press("F3");
  await page.keyboard.press("F4");
  const quantity = page.getByRole("textbox", { name: "Quantity of Titus sardines 125g" });
  await expect(quantity).toBeFocused();
  await quantity.fill("4");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Basket" })).toContainText(
    formatGHS(mulQty(money(180_000), 4000)),
  );

  await page.keyboard.press("F3");
  await page.keyboard.press("Delete");
  await expect(page.getByText("Basket is empty")).toBeVisible();

  await page.keyboard.press("F2");
  await scan(page, "4000000000006");
  await expect(page.getByText("Barcode 4000000000006 was not found")).toBeVisible();
  // Codes merged into one long burst are an unknown barcode, not a dropped connection.
  await scan(page, "6".repeat(70));
  await expect(page.getByText(`Barcode ${"6".repeat(70)} was not found`)).toBeVisible();
  await expect(page.getByText("Register host disconnected")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366);
  await scan(page, scenario!.products[0]!.barcode);
  await expect(lines(page)).toHaveCount(1);
  await page.keyboard.press("F10");
  await expect(page.getByRole("heading", { name: "Register connection" })).toBeVisible();
});

test("a real till splits cash, completes the balance and finds its receipt in Purchases", async ({
  page,
}) => {
  const completion = await delayFirstReply(page, "sale.complete", 1500);
  await openSale(page);
  await scan(page, scenario!.products[0]!.barcode);
  await openCheckout(page);
  await page.getByRole("textbox", { name: "Amount tendered" }).fill("100.00");
  await page.getByRole("button", { name: "Split" }).click();
  await expect(page.getByRole("region", { name: "Tender" })).toContainText("GH₵ 325.00");
  await expect(page.getByRole("textbox", { name: "Amount tendered" })).toHaveValue("325.00");
  await page.keyboard.press("F5");
  await completion.started;
  await page.keyboard.press("F2");
  await expect(field(page)).toBeFocused();
  await scan(page, scenario!.products[1]!.barcode);
  await expect(page.getByRole("region", { name: "Sale receipt" })).toContainText("GH₵ 0.00");
  await expectNoSeriousAxe(page);
  await shoot(page, test.info(), "completed-sale");

  await page.keyboard.press("Enter");
  await expect(page.getByText("Basket is empty")).toBeVisible();
  await page.keyboard.press("F2");
  await expect(field(page)).toBeFocused();
  await scan(page, scenario!.products[2]!.barcode);
  await expect(lines(page)).toHaveCount(1);
  await expect(lines(page).filter({ hasText: scenario!.products[2]!.name })).toHaveCount(1);
  await expect(lines(page).filter({ hasText: scenario!.products[1]!.name })).toHaveCount(0);
  await page.getByRole("button", { name: "Purchases" }).click();
  await expect(page.getByRole("heading", { name: "Purchases", exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: /Receipt/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Purchase details" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Items purchased" })).toContainText("Milo 400g tin");
  await expectNoSeriousAxe(page);
});

let clock = 1_000_000;
/** A scanner burst: every key, Enter included, 10 ms after the last on the page's event clock. */
async function scan(page: Page, code: string) {
  clock += 1_000;
  await page.evaluate(
    (value) => (window as unknown as { scanClock: (v: number) => void }).scanClock(value),
    clock,
  );
  await page.keyboard.type(code);
  await page.keyboard.press("Enter");
  await page.evaluate(() =>
    (window as unknown as { scanClock: (v: null) => void }).scanClock(null),
  );
}

async function delayFirstReply(page: Page, requestType: string, delayMs: number) {
  let signal = () => {};
  const started = new Promise<void>((resolve) => (signal = resolve));
  await page.routeWebSocket(
    (url) => url.pathname.endsWith("/bridge"),
    (route) => {
      const host = route.connectToServer();
      let delayedRequest: string | undefined;
      let delayed = false;
      route.onMessage((message) => {
        const request = JSON.parse(String(message)) as { id: string; type: string };
        if (request.type === requestType && !delayed) {
          delayed = true;
          delayedRequest = request.id;
        }
        host.send(message);
      });
      host.onMessage((message) => {
        const reply = JSON.parse(String(message)) as { id?: string };
        if (reply.id === delayedRequest) {
          delayedRequest = undefined;
          signal();
          setTimeout(() => route.send(message), delayMs);
        } else route.send(message);
      });
    },
  );
  return { started };
}

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  const path = shots ? `${shots}/${name}.png` : testInfo.outputPath(`${name}.png`);
  if (shots) mkdirSync(shots, { recursive: true });
  await page.screenshot({ path });
}

function appOrigin(testInfo: TestInfo) {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string") throw new Error("Playwright baseURL is required");
  return new URL(baseURL).origin;
}
