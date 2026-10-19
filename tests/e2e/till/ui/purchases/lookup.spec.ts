import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { calls } from "../sale/harness";
import { expectTouchTargets } from "../targets";
import { openPurchases, receiptRow, startReturn } from "./harness";

const tab = (page: Page, name: RegExp) => page.getByRole("button", { name });
const search = (page: Page) => page.getByRole("searchbox", { name: "Search receipts" });
const serverRow = (page: Page) => page.getByRole("region", { name: "Find on server" });
const lookups = async (page: Page) =>
  (await calls(page, "lookupPurchase")).map((call) => call.args);

test("the tabs carry their counts and Returns lists refunds as negative totals", async ({
  page,
}) => {
  await openPurchases(page);
  for (const name of [/^All 5$/, /^Completed 2$/, /^Returns 1$/, /^Voided 1$/, /^Pending 1$/])
    await expect(tab(page, name)).toBeVisible();
  await expect(tab(page, /^All/)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Partly refunded")).toBeVisible();

  await tab(page, /^Returns/).click();
  expect((await calls(page, "listPurchases")).at(-1)?.args[0]).toMatchObject({
    status: "returned",
  });
  const row = page.getByRole("row", { name: /Return of #10481/ });
  await expect(row).toHaveCount(1);
  await expect(row.getByText("Returned", { exact: true })).toBeVisible();
  const total = row.getByRole("cell").last();
  await expect(total).toHaveText("−GH₵ 35.00");
  expect(await total.evaluate((cell) => getComputedStyle(cell).textAlign)).toBe("right");
  await expectTouchTargets(page);
  await expectNoSeriousAxe(page);
});

test("Enter on a Returns row opens the sale it returned", async ({ page }) => {
  await openPurchases(page);
  await tab(page, /^Returns/).click();
  await page.getByRole("button", { name: /Return of #10481/ }).focus();
  await page.keyboard.press("Enter");
  expect(await lookups(page)).toEqual([["10481"]]);
  await expect(page.getByRole("heading", { name: "Purchase #10481" })).toBeVisible();
});

test("a search looks through every day and says so", async ({ page }) => {
  await openPurchases(page);
  await expect(page.getByText("5 purchases · Today")).toBeVisible();
  await search(page).fill("10481");
  expect((await calls(page, "listPurchases")).at(-1)?.args[0]).toMatchObject({ query: "10481" });
  await expect(page.getByText("2 purchases · All days")).toBeVisible();
  await expect(receiptRow(page, "10481")).toBeVisible();
  await expect(tab(page, /^All 2$/)).toBeVisible();
});

test("a receipt nothing local matches can be found on the server with Enter", async ({ page }) => {
  await openPurchases(page, "find-server");
  await search(page).fill("20555");
  await expect(serverRow(page)).toContainText("No receipt 20555 on this register");
  await expect(serverRow(page).getByRole("button", { name: /^Find on server/ })).toContainText(
    "Enter",
  );
  await expectNoSeriousAxe(page);
  await page.keyboard.press("Enter");
  expect(await lookups(page)).toEqual([["20555"]]);
  await expect(page.getByRole("heading", { name: "Purchase #20555" })).toBeVisible();
  await expect(page.getByText("Sold on another register")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Reprint/ })).toHaveCount(0);
  await expect(startReturn(page)).toBeEnabled();
  await expectNoSeriousAxe(page);
});

test("a receipt the server does not know is reported", async ({ page }) => {
  await openPurchases(page, "find-missing");
  await search(page).fill("99999");
  await page.keyboard.press("Enter");
  await expect(serverRow(page)).toContainText("No sale with receipt 99999 in this store");
  await expectNoSeriousAxe(page);
});

test("offline, the server search says to connect", async ({ page }) => {
  await openPurchases(page, "find-offline");
  await search(page).fill("20555");
  await expect(serverRow(page)).toContainText("Connect to find sales from other registers");
  await expect(serverRow(page).getByRole("button")).toBeDisabled();
  await page.keyboard.press("Enter");
  expect(await lookups(page)).toEqual([]);
  await expectNoSeriousAxe(page);
});

test("a server lookup that fails offers a retry", async ({ page }) => {
  await openPurchases(page, "find-failed");
  await search(page).fill("20555");
  await page.keyboard.press("Enter");
  await expect(serverRow(page).getByRole("alert")).toContainText("The server could not be reached");
  await expect(serverRow(page).getByRole("button", { name: /^Find on server/ })).toBeEnabled();
});
