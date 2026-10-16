import { expect, test, type Page } from "@playwright/test";
import { startSaleScenario } from "../../../../support/till/sale/scenario";

let scenario: Awaited<ReturnType<typeof startSaleScenario>> | undefined;
let clock = 1_000_000;

// Each test gets its own register, so receipts from one test never appear in another's list.
test.beforeEach(async ({ baseURL }) => {
  if (!baseURL) throw new Error("Playwright baseURL is required");
  scenario = await startSaleScenario(new URL(baseURL).origin);
});

test.afterEach(async () => {
  await scenario?.stop();
  scenario = undefined;
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
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

test("a rejected receipt read shows recovery and can be retried", async ({ page }) => {
  await rejectFirstPurchaseRead(page);
  await makeSale(page, currentScenario().products[0]!.barcode);
  await openPurchases(page);
  await page
    .getByRole("button", { name: /^Receipt / })
    .first()
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "This purchase is unavailable on this register",
  );
  await expect(page.getByText("Select the receipt again to retry.")).toBeVisible();
  await page
    .getByRole("button", { name: /^Receipt / })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Purchase details" })).toBeVisible();
});

test("Escape prevents a delayed receipt reply from reopening details", async ({ page }) => {
  const delayed = await holdFirstReply(page, "sales.read");
  await makeSale(page, currentScenario().products[0]!.barcode);
  await openPurchases(page);
  const receipt = page.getByRole("button", { name: /^Receipt / });
  await receipt.click();
  await delayed.started;
  await page.keyboard.press("Escape");
  await expect(receipt).toBeVisible();
  delayed.release();
  await delayed.released;
  await expect(page.getByRole("heading", { name: "Purchase details" })).toHaveCount(0);
  await expect(receipt).toBeVisible();
});

test("a newer receipt selection wins over a delayed older reply", async ({ page }) => {
  const delayed = await holdFirstReply(page, "sales.read");
  await makeSale(page, currentScenario().products[0]!.barcode);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Basket is empty")).toBeVisible();
  await page.keyboard.press("F2");
  await expect(page.getByRole("combobox", { name: "Scan barcode or search items" })).toBeFocused();
  await makeSale(page, currentScenario().products[1]!.barcode, false);
  await openPurchases(page);
  const receipts = page.getByRole("button", { name: /^Receipt / });
  await expect.poll(() => receipts.count()).toBeGreaterThan(1);
  await receipts.nth(0).click();
  await delayed.started;
  await receipts.nth(1).click();
  await expect(page.getByRole("table", { name: "Items purchased" })).toContainText("Milo 400g tin");
  delayed.release();
  await delayed.released;
  await expect(page.getByRole("table", { name: "Items purchased" })).toContainText("Milo 400g tin");
  await expect(page.getByRole("table", { name: "Items purchased" })).not.toContainText(
    "Peak milk 160g",
  );
});

test("a filter refresh prevents a delayed receipt reply from replacing the list", async ({
  page,
}) => {
  const delayed = await holdFirstReply(page, "sales.read");
  await makeSale(page, currentScenario().products[0]!.barcode);
  await openPurchases(page);
  await page
    .getByRole("button", { name: /^Receipt / })
    .first()
    .click();
  await delayed.started;
  await page.getByRole("searchbox", { name: "Search receipts" }).fill("no-such-receipt");
  await expect(page.getByText("No purchases today")).toBeVisible();
  delayed.release();
  await delayed.released;
  await expect(page.getByText("No purchases today")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Purchase details" })).toHaveCount(0);
});

test("a stale purchase list reply cannot replace newer filtered results", async ({ page }) => {
  const delayed = await holdFirstReply(page, "sales.list");
  await makeSale(page, currentScenario().products[0]!.barcode);
  await openPurchases(page, false);
  await delayed.started;
  await page.getByRole("searchbox", { name: "Search receipts" }).fill("no-such-receipt");
  await expect(page.getByText("No purchases today")).toBeVisible();
  delayed.release();
  await delayed.released;
  await expect(page.getByText("No purchases today")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Receipt / })).toHaveCount(0);
});

async function openPurchases(page: Page, waitForRows = true) {
  await page.getByRole("button", { name: "Purchases" }).click();
  await expect(page.getByRole("heading", { name: "Purchases", exact: true })).toBeVisible();
  if (waitForRows)
    await expect(page.getByRole("button", { name: /^Receipt / }).first()).toBeVisible();
}

async function makeSale(page: Page, barcode: string, navigate = true) {
  if (navigate) {
    await page.goto(currentScenario().url);
    await expect(page.getByRole("region", { name: "Host connection" })).toContainText("Connected");
    await page.getByRole("button", { name: /Start selling/ }).click();
    await expect(page.getByRole("heading", { name: "Sale", exact: true })).toBeVisible();
  }
  await scan(page, barcode);
  await page.getByRole("button", { name: /^Charge / }).click();
  await expect(
    page.getByRole("region", { name: "Sale receipt" }).getByText("Sale complete"),
  ).toBeVisible();
}

function currentScenario() {
  if (!scenario) throw new Error("The register scenario is not available");
  return scenario;
}

async function scan(page: Page, barcode: string) {
  clock += 1_000;
  await page.evaluate((value) => window.scanClock(value), clock);
  await page.keyboard.type(barcode);
  await page.keyboard.press("Enter");
  await page.evaluate(() => window.scanClock(null));
}

async function rejectFirstPurchaseRead(page: Page) {
  let rejected = false;
  await page.routeWebSocket(
    (url) => url.pathname.endsWith("/bridge"),
    (route) => {
      const host = route.connectToServer();
      route.onMessage((message) => {
        const request = JSON.parse(String(message)) as { type?: string };
        if (request.type === "sales.read" && !rejected) {
          rejected = true;
          host.send(
            JSON.stringify({
              ...JSON.parse(String(message)),
              saleId: "10000000-0000-7000-8000-000000000999",
            }),
          );
        } else host.send(message);
      });
      host.onMessage((message) => route.send(message));
    },
  );
}

async function holdFirstReply(page: Page, type: string) {
  let signalStarted!: () => void;
  let signalReleased!: () => void;
  let requestId: string | undefined;
  let held: { route: import("@playwright/test").WebSocketRoute; message: string } | undefined;
  const started = new Promise<void>((resolve) => (signalStarted = resolve));
  const released = new Promise<void>((resolve) => (signalReleased = resolve));
  await page.routeWebSocket(
    (url) => url.pathname.endsWith("/bridge"),
    (route) => {
      const host = route.connectToServer();
      route.onMessage((message) => {
        const request = JSON.parse(String(message)) as { id?: string; type?: string };
        if (request.type === type && requestId === undefined) requestId = request.id;
        host.send(message);
      });
      host.onMessage((message) => {
        const reply = JSON.parse(String(message)) as { id?: string };
        if (requestId && reply.id === requestId && held === undefined) {
          held = { route, message: String(message) };
          signalStarted();
        } else route.send(message);
      });
    },
  );
  return {
    started,
    released,
    release() {
      if (!held) throw new Error("No bridge reply is ready to release");
      held.route.send(held.message);
      signalReleased();
    },
  };
}

declare global {
  interface Window {
    scanClock(value: number | null): void;
  }
}
