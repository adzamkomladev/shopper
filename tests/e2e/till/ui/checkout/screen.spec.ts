import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { calls, openCheckout, openSale } from "../sale/harness";

// Set SHOPPER_SCREENSHOTS_DIR to keep the screenshots (docs/plans/day13/screenshots).
const shots = process.env.SHOPPER_SCREENSHOTS_DIR;
const sizes = [
  { name: "1920", width: 1920, height: 1080 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1366", width: 1366, height: 768 },
  { name: "1024", width: 1024, height: 768 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
] as const;

const cart = (page: Page) => page.getByRole("region", { name: "Basket" });
const tender = (page: Page) => page.getByRole("region", { name: "Tender" });
const checkoutButton = (page: Page) => page.getByRole("button", { name: /^Checkout/ });
const rows = (page: Page) => page.getByRole("list", { name: "Basket lines" }).getByRole("listitem");

async function expectFits(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    width,
  );
}

async function shoot(page: Page, name: string) {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: `${shots}/checkout-${name}.png` });
}

for (const size of sizes) {
  test.describe(`at ${size.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
    });

    test("empty: the next action is scanning, and nothing can be checked out", async ({ page }) => {
      await openSale(page, "empty");
      await page.setViewportSize({ width: size.width, height: size.height });
      await expect(page.getByRole("combobox")).toBeFocused();
      await expect(cart(page)).toContainText("Basket is empty");
      await expect(cart(page)).toContainText("0 items");
      await expect(cart(page)).toContainText("GH₵ 0.00");
      await expect(checkoutButton(page)).toBeDisabled();
      await expect(page.getByRole("button", { name: "Clear cart" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Hold sale" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Scan product" })).toBeEnabled();
      // The customer tiles are there; modules that are not built have no tile.
      for (const present of ["Add customer", "Create invoice"])
        await expect(page.getByRole("button", { name: present })).toBeVisible();
      await expect(page.getByRole("button", { name: "Arrange delivery" })).toHaveCount(0);
      await expectFits(page, size.width);
      await expectNoSeriousAxe(page);
      await shoot(page, `empty-${size.name}`);
    });

    test("items: numbered lines, the selected one highlighted, total and count", async ({
      page,
    }) => {
      await openSale(page, "lines");
      await page.setViewportSize({ width: size.width, height: size.height });
      await expect(rows(page)).toHaveCount(4);
      await expect(rows(page).nth(0)).toContainText("1");
      await expect(rows(page).nth(0)).toContainText("Milo 400g tin");
      await expect(rows(page).nth(3)).toHaveAttribute("aria-current", "true");
      await expect(cart(page)).toContainText("4 items");
      await expect(cart(page)).toContainText("GH₵ 126.50");
      await expect(checkoutButton(page)).toBeEnabled();
      await rows(page).nth(0).click();
      await expect(rows(page).nth(0)).toHaveAttribute("aria-current", "true");
      await expectFits(page, size.width);
      await expectNoSeriousAxe(page);
      await shoot(page, `items-${size.name}`);
    });

    test("search results take the place of the tiles", async ({ page }) => {
      await openSale(page, "results");
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.getByRole("combobox").pressSequentially("milo", { delay: 90 });
      await expect(page.getByRole("option")).toHaveCount(3);
      await expect(page.getByRole("list", { name: "Sale actions" })).toHaveCount(0);
      await expectFits(page, size.width);
      await expectNoSeriousAxe(page);
      await shoot(page, `search-${size.name}`);
    });

    test("Checkout opens the tender step and Cart returns to the basket", async ({ page }) => {
      await openSale(page, "lines");
      await page.setViewportSize({ width: size.width, height: size.height });
      await checkoutButton(page).click();
      await expect(tender(page)).toBeVisible();
      await expect(cart(page)).toHaveCount(0);
      await expect(page.getByRole("textbox", { name: "Amount tendered" })).toHaveValue("126.50");
      await expectFits(page, size.width);
      await expectNoSeriousAxe(page);
      await shoot(page, `tender-${size.name}`);
      await page.getByRole("button", { name: /^Cart/ }).click();
      await expect(cart(page)).toBeVisible();
      await expect(tender(page)).toHaveCount(0);
    });
  });
}

test("the quantity buttons change the selected line", async ({ page }) => {
  await openSale(page, "lines");
  await page
    .getByRole("button", { name: "Increase quantity of Fan Milk Vanilla ice cream" })
    .click();
  await page
    .getByRole("button", { name: "Decrease quantity of Fan Milk Vanilla ice cream" })
    .click();
  expect((await calls(page, "setQuantity")).map((call) => call.args)).toEqual([
    ["l4", 3000],
    ["l4", 1000],
  ]);
  await rows(page).nth(0).click();
  await expect(
    page.getByRole("button", { name: "Decrease quantity of Milo 400g tin" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Remove Milo 400g tin" }).click();
  expect((await calls(page, "removeLine")).map((call) => call.args)).toEqual([["l1"]]);
});

test("Clear cart asks for a reason before it clears the basket", async ({ page }) => {
  await openSale(page, "lines");
  await page.getByRole("button", { name: "Clear cart" }).click();
  const dialog = page.getByRole("dialog", { name: "Void sale" });
  await dialog.getByRole("textbox", { name: "Reason" }).fill("Customer left");
  await dialog.getByRole("button", { name: "Void sale" }).click();
  expect((await calls(page, "voidSale")).map((call) => call.args[0])).toEqual(["Customer left"]);
});

test("the keyboard path: scan, pick a line, change it, Checkout, back, hold", async ({ page }) => {
  await openSale(page, "lines");
  const scan = page.getByRole("combobox");
  await expect(scan).toBeFocused();
  await page.keyboard.press("F3");
  await expect(page.getByRole("list", { name: "Basket lines" })).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(rows(page).nth(2)).toHaveAttribute("aria-current", "true");
  await page.keyboard.press("F4");
  await page.getByRole("textbox", { name: "Quantity of Gari, white" }).fill("2");
  await page.keyboard.press("Enter");
  expect((await calls(page, "setQuantity")).map((call) => call.args)).toEqual([["l3", 2000]]);
  await expect(scan).toBeFocused();

  await page.keyboard.press("Control+Enter");
  await expect(tender(page)).toBeVisible();
  await expect(scan).toBeFocused();
  await page.keyboard.press("Alt+C");
  await expect(cart(page)).toBeVisible();

  await page.keyboard.press("F6");
  expect(await calls(page, "holdSale")).toHaveLength(1);
  await page.keyboard.press("F7");
  await expect(page.getByRole("dialog", { name: "Held sales" })).toBeVisible();
});

test("F5 still charges from the basket without opening Checkout", async ({ page }) => {
  await openSale(page, "lines");
  await page.keyboard.press("F5");
  expect(await calls(page, "charge")).toEqual([
    { type: "charge", args: [{ kind: "cash", amount: 1_265_000 }] },
  ]);
});

test("every shortcut on a tile is shown and reaches the same action", async ({ page }) => {
  await openSale(page, "lines");
  const tiles = page.getByRole("list", { name: "Sale actions" });
  for (const [name, key] of [
    ["Scan product", "F2"],
    ["Hold sale", "F6"],
    ["Held sales", "F7"],
    ["Add customer", "Alt+U"],
    ["Create invoice", "Alt+I"],
  ] as const) {
    const tile = tiles.getByRole("button", { name });
    await expect(tile).toHaveAttribute("aria-keyshortcuts", key);
    await expect(tile).toContainText(key);
  }
  await page.getByRole("button", { name: "Hold sale" }).click();
  expect(await calls(page, "holdSale")).toHaveLength(1);
  await openCheckout(page);
  await expect(page.getByRole("button", { name: /Charge/ })).toBeVisible();
});
