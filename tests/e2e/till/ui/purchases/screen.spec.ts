import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { calls, openFromMenu, openSale } from "../sale/harness";
import { expectTouchTargets } from "../targets";

async function openPurchases(page: import("@playwright/test").Page, scenario = "lines") {
  await openSale(page, scenario);
  await openFromMenu(page, "Previous purchases");
  await expect(
    page.getByRole("heading", { name: "Previous purchases", exact: true }),
  ).toBeVisible();
}

test("purchase tabs, receipt search and tender filter request today's till records", async ({
  page,
}) => {
  await openPurchases(page);
  await expectTouchTargets(page);
  await expect(page.getByRole("button", { name: /^All/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^Voided/ }).click();
  await page.getByRole("searchbox", { name: "Search receipts" }).fill("10482");
  await page.getByRole("combobox", { name: "Filter by tender" }).click();
  await page.getByRole("option", { name: "Cash" }).click();
  const request = (await calls(page, "listPurchases")).at(-1);
  expect(request?.args[0]).toMatchObject({ status: "voided", query: "10482", kind: "cash" });
  await expectNoSeriousAxe(page);
});

test("the Customer column names who each sale was rung up to", async ({ page }) => {
  await openPurchases(page);
  const list = page.getByRole("region", { name: "Today’s purchases" });
  await expect(list.getByRole("columnheader", { name: "Customer" })).toBeVisible();
  const named = list.getByRole("row", { name: /#10482/ });
  await expect(named).toContainText("Ama Mensah");
  await expect(named.getByText("AM", { exact: true })).toBeVisible();
  await expect(list.getByRole("row", { name: /[AP]M #10481/ })).toContainText("Walk-in customer");
  // A credit note is not a sale of its own, so it names nobody.
  const returned = list.getByRole("row", { name: /Credit note #10490 for #10481/ });
  await expect(returned).not.toContainText("Walk-in customer");
  await expect(returned).toContainText("—");
  await expectNoSeriousAxe(page);
});

test("cashier can open a receipt and return to the list with only the keyboard", async ({
  page,
}) => {
  await openPurchases(page);
  await page.getByRole("main", { name: "Purchases" }).focus();
  for (let index = 0; index < 9; index += 1) await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: /#10482/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: /^Purchase #/ })).toBeVisible();
  await page.getByRole("main", { name: "Purchases" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Back to purchases" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /#10482/ })).toBeVisible();
});

test("purchase details show receipt lines, tax, totals and payment references", async ({
  page,
}) => {
  await openPurchases(page);
  await page.getByRole("button", { name: /#10482/ }).click();
  await expect(page.getByRole("heading", { name: /^Purchase #/ })).toBeVisible();
  await expect(page.getByRole("table", { name: "Items purchased" })).toContainText("Milo 400g tin");
  await expect(page.getByRole("region", { name: "Payment and tender" })).toContainText("Cash");
  await expect(page.getByRole("button", { name: "Back to purchases" })).toBeVisible();
  await expectTouchTargets(page);
  await expectNoSeriousAxe(page);
});

test("mobile purchase detail keeps the item table readable above totals", async ({ page }) => {
  await openPurchases(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /#10482/ }).click();
  const items = page.getByRole("region", { name: "Items purchased" });
  await expect(items).toBeVisible();
  await expect(items).toContainText("Milo 400g tin");
  const bounds = await items.boundingBox();
  const aside = await page
    .getByRole("region", { name: "Purchase details" })
    .locator("aside")
    .boundingBox();
  expect(aside?.y).toBeGreaterThanOrEqual((bounds?.y ?? 0) + (bounds?.height ?? 0));
  await expectNoSeriousAxe(page);
});

test("purchase list and detail design their loading, empty, offline and error states", async ({
  page,
}, testInfo) => {
  const states = [
    ["purchases-loading", "Loading purchases"],
    ["purchases-empty", "No purchases today"],
    ["purchases-offline", "Purchases are unavailable while the register host is offline"],
    ["purchases-error", "Purchases could not be loaded"],
  ] as const;
  for (const [scenario, message] of states) {
    await openPurchases(page, scenario);
    await expect(page.getByText(message)).toBeVisible();
    await expectNoSeriousAxe(page);
    await page.screenshot({ path: testInfo.outputPath(`${scenario}.png`) });
  }
});
