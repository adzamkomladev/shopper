import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { expectTouchTargets } from "../targets";
import { expectFits, mockRegister, openShell, shoot, sizes, type QueueRow } from "./api";

const panel = (page: Page) => page.locator('[data-slot="register-inventory"]');
const search = (page: Page) =>
  panel(page).getByRole("textbox", { name: "Scan barcode or search products" });
const queue = (page: Page) => panel(page).getByRole("region", { name: "Queue" });

const row = (over: Partial<QueueRow>): QueueRow => ({
  id: "d1",
  kind: "count",
  status: "queued",
  createdAt: "2026-10-18T08:30:00.000Z",
  blockedReason: null,
  payload: { lines: [{}, {}] },
  ...over,
});

/** Scans a product by typing its code and Enter, then types its quantity. */
async function scan(page: Page, code: string, quantity: string) {
  await search(page).fill(code);
  await search(page).press("Enter");
  const input = panel(page).getByRole("textbox", { name: /for / }).last();
  await expect(input).toBeFocused();
  await input.fill(quantity);
}

for (const size of sizes) {
  test(`at ${size.name}: switch, search, lines and the queue fit`, async ({ page }) => {
    await page.setViewportSize(size);
    await mockRegister(page, {
      stock: [
        row({
          id: "d3",
          status: "rejected",
          blockedReason: "Stock count is older than the last count",
        }),
        row({ id: "d2", kind: "receipt", status: "sent" }),
        row({ id: "d1" }),
      ],
    });
    await openShell(page, "Inventory");
    await expect(panel(page).getByRole("button", { name: "Stock count" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(queue(page).getByText("Rejected")).toBeVisible();
    await expect(queue(page).getByText("Stock count is older than the last count")).toBeVisible();
    await expect(queue(page).getByText("Sent")).toBeVisible();
    await expect(queue(page).getByText("Queued")).toBeVisible();
    await shoot(page, `inventory-empty-${size.name}`);
    await scan(page, "milo", "12");
    await search(page).fill("rice");
    await expect(panel(page).getByRole("button", { name: /Loose rice/ })).toBeVisible();
    await shoot(page, `inventory-search-${size.name}`);
    await panel(page)
      .getByRole("button", { name: /Loose rice/ })
      .click();
    await panel(page)
      .getByRole("textbox", { name: /for Loose rice/ })
      .fill("4.5");
    await expectFits(page);
    await expectTouchTargets(page);
    await expectNoSeriousAxe(page);
    await shoot(page, `inventory-count-${size.name}`);
  });
}

test("count: scan, quantity, Enter back to search, Ctrl+Enter queues it, then it shows Queued", async ({
  page,
}) => {
  const register = await mockRegister(page);
  await openShell(page, "Inventory");
  await expect(panel(page).getByText("No products counted yet")).toBeVisible();
  await expect(queue(page).getByText(/Nothing queued/)).toBeVisible();
  await scan(page, "MILO-400", "12");
  await page.keyboard.press("Enter");
  await expect(search(page)).toBeFocused();
  await scan(page, "rice", "0");
  await page.keyboard.press("Control+Enter");
  await expect(panel(page).getByRole("status").filter({ hasText: "Count queued" })).toBeVisible();
  expect(register.posted).toEqual([
    {
      kind: "count",
      lines: [
        { productId: "p1", countedThousandths: 12_000 },
        { productId: "p2", countedThousandths: 0 },
      ],
      countedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    },
  ]);
  await expect(queue(page).getByText("Stock count · 2 products")).toBeVisible();
  await expect(queue(page).getByText("Queued")).toBeVisible();
  await expect(panel(page).getByText("No products counted yet")).toBeVisible();
  await shoot(page, "inventory-queued");
  register.stock[0]!.status = "sent";
  await expect(queue(page).getByText("Sent")).toBeVisible({ timeout: 10_000 });
});

test("receiving: supplier and reference go with the delivery; its drafts survive the switch", async ({
  page,
}) => {
  const register = await mockRegister(page);
  await openShell(page, "Inventory");
  await scan(page, "milo", "3");
  await panel(page).getByRole("button", { name: "Receiving" }).click();
  await expect(panel(page).getByText("No products received yet")).toBeVisible();
  await scan(page, "rice", "20.5");
  await panel(page).getByLabel("Supplier (optional)").fill("Kumasi Wholesale");
  await panel(page).getByLabel("Delivery note or invoice (optional)").fill("INV-204");
  await shoot(page, "inventory-receiving");
  await panel(page).getByRole("button", { name: "Stock count" }).click();
  await expect(panel(page).getByRole("textbox", { name: /for Milo/ })).toHaveValue("3");
  await panel(page).getByRole("button", { name: "Receiving" }).click();
  await panel(page)
    .getByRole("button", { name: /Queue delivery/ })
    .click();
  await expect(
    panel(page).getByRole("status").filter({ hasText: "Delivery queued" }),
  ).toBeVisible();
  expect(register.posted).toEqual([
    {
      kind: "receipt",
      supplier: "Kumasi Wholesale",
      reference: "INV-204",
      lines: [{ productId: "p2", quantityThousandths: 20_500 }],
      receivedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    },
  ]);
  await expect(queue(page).getByText("Delivery received · 1 product")).toBeVisible();
});

test("validation: a missing quantity is flagged and focused; receiving needs more than 0", async ({
  page,
}) => {
  const register = await mockRegister(page);
  await openShell(page, "Inventory");
  await search(page).fill("milo");
  await search(page).press("Enter");
  const quantity = panel(page).getByRole("textbox", { name: /for Milo/ });
  await expect(quantity).toBeFocused();
  await page.keyboard.press("Control+Enter");
  await expect(panel(page).getByText("Enter the quantity counted, like 12 or 2.5")).toBeVisible();
  await expect(quantity).toBeFocused();
  await expect(quantity).toHaveAttribute("aria-invalid", "true");
  await expectNoSeriousAxe(page);
  await shoot(page, "inventory-invalid");
  await panel(page).getByRole("button", { name: "Receiving" }).click();
  await scan(page, "milo", "0");
  await page.keyboard.press("Control+Enter");
  await expect(panel(page).getByText("Enter a quantity above 0")).toBeVisible();
  expect(register.posted).toEqual([]);
});

test("submitting an empty document asks for a product and removing a line works", async ({
  page,
}) => {
  await mockRegister(page);
  await openShell(page, "Inventory");
  await panel(page).getByRole("button", { name: "Queue count" }).click();
  await expect(panel(page).getByText("Add a product first")).toBeVisible();
  await scan(page, "milo", "1");
  await panel(page).getByRole("button", { name: "Remove Milo 400g tin" }).click();
  await expect(panel(page).getByText("No products counted yet")).toBeVisible();
});

test("a search with no match says so", async ({ page }) => {
  await mockRegister(page);
  await openShell(page, "Inventory");
  await search(page).fill("zzzz");
  await expect(panel(page).getByText('No product matches "zzzz".')).toBeVisible();
});

test("a failed submit shows the host's reason and keeps the lines", async ({ page }) => {
  await mockRegister(page);
  await openShell(page, "Inventory");
  await page.route("**/api/register/stock", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 403, contentType: "application/json", body: '{"error":"no"}' })
      : route.fallback(),
  );
  await scan(page, "milo", "2");
  await page.keyboard.press("Control+Enter");
  await expect(panel(page).getByText("Your account can't enter stock.")).toBeVisible();
  await expect(panel(page).getByRole("textbox", { name: /for Milo/ })).toHaveValue("2");
});

test("a queue that cannot load explains it and Try again recovers", async ({ page }) => {
  const register = await mockRegister(page, { stockStatus: 500 });
  await openShell(page, "Inventory");
  await expect(panel(page).getByText("Couldn't load the queue")).toBeVisible();
  await shoot(page, "inventory-queue-error");
  register.stockStatus = 200;
  await panel(page).getByRole("button", { name: "Try again" }).click();
  await expect(queue(page).getByText(/Nothing queued/)).toBeVisible();
});

test("offline: counts wait on the register", async ({ page }) => {
  await mockRegister(page);
  await openShell(page, "Inventory", "&offline");
  await expect(panel(page).getByRole("status").filter({ hasText: "Offline" })).toBeVisible();
  await scan(page, "milo", "5");
  await page.keyboard.press("Control+Enter");
  await expect(panel(page).getByRole("status").filter({ hasText: "Count queued" })).toBeVisible();
  await shoot(page, "inventory-offline");
});

test("stock.read without stock.write sees the queue but no form", async ({ page }) => {
  await mockRegister(page, { permissions: ["stock.read"], stock: [row({})] });
  await openShell(page, "Inventory", "&permissions=stock.read");
  await expect(panel(page).getByText("You can see the queue but not enter stock")).toBeVisible();
  await expect(queue(page).getByText("Queued")).toBeVisible();
  await expect(search(page)).toHaveCount(0);
  await expectNoSeriousAxe(page);
  await shoot(page, "inventory-readonly");
});

test("without stock.read the user is told so and nothing is requested", async ({ page }) => {
  const register = await mockRegister(page, { permissions: ["report.read"] });
  await openShell(page, "Inventory");
  await expect(panel(page).getByText("You don't have permission to view inventory")).toBeVisible();
  expect(register.requests.some((r) => r.startsWith("/register/stock"))).toBe(false);
  await expectNoSeriousAxe(page);
  await shoot(page, "inventory-nopermission");
});
