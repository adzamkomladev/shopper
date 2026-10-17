import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { expectNoOverflow, shoot } from "../settings/harness";
import { calls, openSale } from "./harness";

// Set SHOPPER_SCREENSHOTS_DIR=docs/plans/day12/screenshots/sale to keep the shots.
async function complete(page: Page, scenario: string) {
  await openSale(page, scenario);
  await page.getByRole("textbox", { name: "Amount tendered" }).fill("200.00");
  await page.keyboard.press("F5");
  return page.getByRole("region", { name: "Sale receipt" });
}

const message = "Sale complete. Press Enter or New sale, then scan again.";

/** Time stands still between keys: gaps under 60 ms make a scan, longer ones are typing, whatever the runner's speed. */
async function keys(page: Page, text: string, gap: number, enter = true) {
  await page.clock.install({ time: new Date("2026-10-14T09:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-14T09:01:00Z"));
  for (const key of [...text.split(""), ...(enter ? ["Enter"] : [])]) {
    await page.clock.runFor(gap);
    await page.keyboard.press(key);
  }
}

test("with clear cart off, a scan or a keyed code on the completion view starts nothing and says so", async ({
  page,
}) => {
  await openSale(page, "lines-keep");
  await page.getByRole("textbox", { name: "Amount tendered" }).fill("200.00");
  await page.keyboard.press("F5");
  const receipt = page.getByRole("region", { name: "Sale receipt" });
  await expect(receipt).toBeVisible();
  const basket = page.getByRole("region", { name: "Basket" });
  await expect(basket).toContainText("Press Enter or New sale to start another basket");
  await expect(page.getByRole("combobox")).toBeEnabled();
  await expect(basket.getByRole("alert")).toHaveCount(0);

  await keys(page, "5012", 20);
  await expect(basket.getByRole("alert")).toHaveText(message);
  await expect(page.getByRole("combobox")).toHaveValue("");
  expect(await calls(page, "add")).toEqual([]);
  expect(await calls(page, "newSaleWith")).toEqual([]);
  expect(await calls(page, "newSale")).toEqual([]);
  await expect(receipt).toBeVisible();

  // A keyed code gets the same answer instead of vanishing.
  await page.reload();
  await page.getByRole("heading", { name: "Sale", exact: true }).waitFor();
  await page.getByRole("textbox", { name: "Amount tendered" }).fill("200.00");
  await page.keyboard.press("F5");
  await expect(receipt).toBeVisible();
  await keys(page, "abc", 100);
  await expect(basket.getByRole("alert")).toHaveText(message);
  expect(await calls(page, "newSaleWith")).toEqual([]);
  await expect(receipt).toBeVisible();

  await page.clock.resume();
  await page.getByRole("combobox").fill("");
  await page.keyboard.press("Enter");
  expect(await calls(page, "newSale")).toHaveLength(1);
  await expect(page.getByRole("combobox")).toBeEnabled();
});

test("charges stay locked on the completion view", async ({ page }) => {
  await openSale(page, "lines-keep");
  await page.getByRole("textbox", { name: "Amount tendered" }).fill("200.00");
  await page.keyboard.press("F5");
  await expect(page.getByRole("region", { name: "Sale receipt" })).toBeVisible();
  await page.keyboard.press("F5");
  expect(await calls(page, "charge")).toHaveLength(1);
  expect(await calls(page, "complete")).toEqual([]);
});

test("Enter on a purchase receipt opens details without starting a new sale", async ({ page }) => {
  await openSale(page, "lines");
  await page.getByRole("textbox", { name: "Amount tendered" }).fill("200.00");
  await page.keyboard.press("F5");
  await expect(page.getByRole("region", { name: "Sale receipt" })).toBeVisible();

  await page.keyboard.press("Alt+P");
  const receipt = page.getByRole("button", { name: /Receipt/ }).first();
  await receipt.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "Purchase details" })).toBeVisible();
  expect(await calls(page, "newSale")).toEqual([]);
});

test("with clear cart on, the next scan starts a new sale with that item in it", async ({
  page,
}) => {
  const receipt = await complete(page, "lines");
  await expect(receipt.getByText("Receipt printed")).toBeVisible();
  await expect(page.getByRole("combobox")).toBeEnabled();
  await expect(page.getByRole("combobox")).toBeFocused();
  await expect(page.getByRole("region", { name: "Basket" })).toContainText("Scan the next item");

  // Time stands still between keys, so the burst is a scan whatever the runner's speed.
  await page.clock.install({ time: new Date("2026-10-14T09:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-14T09:01:00Z"));
  for (const key of ["5", "0", "1", "2", "Enter"]) {
    await page.clock.runFor(20);
    await page.keyboard.press(key);
  }
  expect(await calls(page, "newSaleWith")).toEqual([
    { type: "newSaleWith", args: [{ code: "5012" }] },
  ]);
  expect(await calls(page, "complete")).toHaveLength(0);
  await expect(page.getByRole("region", { name: "Sale receipt" })).toHaveCount(0);
});

test("with clear cart on, a keyed code and Enter starts a new sale with that code", async ({
  page,
}) => {
  await complete(page, "lines");
  await keys(page, "abc", 100);
  expect(await calls(page, "newSaleWith")).toEqual([
    { type: "newSaleWith", args: [{ code: "abc" }] },
  ]);
  expect(await calls(page, "newSale")).toHaveLength(1);
});

test("with clear cart on, Enter alone starts a new sale", async ({ page }) => {
  await complete(page, "lines");
  await page.keyboard.press("Enter");
  expect(await calls(page, "newSale")).toHaveLength(1);
  expect(await calls(page, "newSaleWith")).toHaveLength(0);
});

test("the receipt prints automatically and the status line follows the job", async ({
  page,
}, testInfo) => {
  const receipt = await complete(page, "lines-slowprint");
  await expect(receipt.getByRole("status")).toContainText("Printing receipt…");
  await expectNoSeriousAxe(page);
  await shoot(page, testInfo, "complete-printing");
  await expect(receipt.getByRole("status")).toContainText("Receipt printed");
  await expect(receipt.getByRole("button", { name: /Reprint|Print receipt/ })).toHaveCount(0);
  await expectNoSeriousAxe(page);
  await shoot(page, testInfo, "complete-printed");
});

test("an offline printer offers Reprint, by click and Alt+R, and says what failed", async ({
  page,
}, testInfo) => {
  const receipt = await complete(page, "lines-offline");
  await expect(receipt.getByRole("status")).toContainText(
    "Print failed: connection refused (192.168.1.50:9100). Check the printer is on and on the same network.",
  );
  const reprint = receipt.getByRole("button", { name: /^Reprint/ });
  await expect(reprint).toContainText("Alt+R");
  await expectNoSeriousAxe(page);
  await shoot(page, testInfo, "complete-offline");
  await reprint.click();
  const printing = receipt.getByRole("button", { name: /^Printing…/ });
  await expect(printing).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator("[data-sonner-toast]")).toContainText(
    "Check the printer is on and on the same network.",
  );
  await expect(receipt.getByRole("status")).toContainText("Print failed");
  await page.keyboard.press("Alt+R");
  await expect.poll(async () => (await calls(page, "print")).length).toBe(2);
});

test("with auto-print off the cashier prints the receipt with Alt+R", async ({
  page,
}, testInfo) => {
  const receipt = await complete(page, "lines-manual");
  const print = receipt.getByRole("button", { name: /^Print receipt/ });
  await expect(print).toContainText("Alt+R");
  await expect(receipt.getByRole("status")).toContainText("Not printed");
  await expect(receipt).not.toContainText("Printing receipt…");
  await shoot(page, testInfo, "complete-manual");
  await page.keyboard.press("Alt+R");
  await expect(receipt.getByText("Receipt printed")).toBeVisible();
  expect(await calls(page, "print")).toHaveLength(1);
  await page.keyboard.press("Alt+R");
  expect(await calls(page, "print")).toHaveLength(1);
});

test("with no printer the completion view points to Settings and offers no print", async ({
  page,
}, testInfo) => {
  const receipt = await complete(page, "lines-noprinter");
  await expect(receipt.getByRole("status")).toContainText("No printer set up");
  await expect(receipt.getByRole("button", { name: /Print|Reprint/ })).toHaveCount(0);
  await page.keyboard.press("Alt+R");
  expect(await calls(page, "print")).toHaveLength(0);
  await shoot(page, testInfo, "complete-noprinter");
});

test("the completion view fits the mobile width", async ({ page }, testInfo) => {
  await complete(page, "lines-offline");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("region", { name: "Sale receipt" })).toBeVisible();
  await expectNoOverflow(page);
  await expectNoSeriousAxe(page);
  await page.getByRole("button", { name: /^New sale/ }).scrollIntoViewIfNeeded();
  await shoot(page, testInfo, "complete-mobile");
});

test("Enter on Reprint prints and keeps the completion view and focus", async ({ page }) => {
  const receipt = await complete(page, "lines-offline");
  const reprint = receipt.getByRole("button", { name: /^Reprint/ });
  await reprint.focus();
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await calls(page, "print")).length).toBe(1);
  expect(await calls(page, "newSale")).toEqual([]);
  await expect(receipt).toBeVisible();
  await expect(receipt.getByRole("button", { name: /^Reprint/ })).toBeFocused();
});

test("Enter on Print receipt prints and keeps the completion view", async ({ page }) => {
  const receipt = await complete(page, "lines-manual");
  await receipt.getByRole("button", { name: /^Print receipt/ }).focus();
  await page.keyboard.press("Enter");
  await expect(receipt.getByText("Receipt printed")).toBeVisible();
  expect(await calls(page, "print")).toHaveLength(1);
  expect(await calls(page, "newSale")).toEqual([]);
  await expect(receipt).toBeVisible();
});

test("a print that never reports back is shown as unknown with Reprint", async ({
  page,
}, testInfo) => {
  const receipt = await complete(page, "lines-stuck");
  await expect(receipt.getByRole("status")).toContainText("Print status unknown");
  await expect(receipt.getByRole("button", { name: /^Reprint/ })).toContainText("Alt+R");
  await expectNoSeriousAxe(page);
  await shoot(page, testInfo, "complete-unknown");
  await page.keyboard.press("Alt+R");
  await expect(receipt.getByText("Receipt printed")).toBeVisible();
});
