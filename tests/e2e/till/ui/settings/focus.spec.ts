import { expect, test, type Page } from "@playwright/test";
import { calls, openSale } from "../sale/harness";

const scan = (page: Page) => page.getByRole("combobox", { name: "Scan barcode or search items" });

// "results" gives the harness catalogue matches, so a typed search can be added with Enter.
async function expectScanWorks(page: Page) {
  await expect(scan(page)).toBeFocused();
  await page.keyboard.type("milo", { delay: 90 });
  await page.keyboard.press("Enter");
  expect((await calls(page, "add")).length).toBeGreaterThan(0);
}

for (const [from, key] of [
  ["Settings", "Alt+T"],
  ["Purchases", "Alt+P"],
] as const) {
  test(`Alt+S from ${from} puts the cursor back in the scan field`, async ({ page }) => {
    await openSale(page, "results");
    await page.keyboard.press(key);
    await expect(page.getByRole("heading", { name: from, exact: true })).toBeVisible();
    await page.keyboard.press("Alt+S");
    await expect(page.getByRole("heading", { name: "Sale", exact: true })).toBeVisible();
    await expectScanWorks(page);
  });

  test(`clicking the Sale tab from ${from} puts the cursor back in the scan field`, async ({
    page,
  }) => {
    await openSale(page, "results");
    await page.getByRole("button", { name: new RegExp(`^${from}`) }).click();
    await expect(page.getByRole("heading", { name: from, exact: true })).toBeVisible();
    await page.getByRole("button", { name: /^Sale/ }).click();
    await expectScanWorks(page);
  });
}

test("shortcuts still work after leaving Settings by the keyboard", async ({ page }) => {
  await openSale(page, "settings");
  await page.keyboard.press("Alt+T");
  await page.keyboard.press("Alt+S");
  await page.keyboard.press("F2");
  await expect(scan(page)).toBeFocused();
  await page.keyboard.press("Alt+T");
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
});
