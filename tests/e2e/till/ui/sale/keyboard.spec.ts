import { expect, test } from "@playwright/test";
import { calls, openSale } from "./harness";

const field = (page: import("@playwright/test").Page) => page.getByRole("combobox");

test("the scan field has focus on arrival and F2 brings it back", async ({ page }) => {
  await openSale(page, "lines");
  await expect(field(page)).toBeFocused();
  await page.keyboard.press("F3");
  await expect(page.getByRole("list", { name: "Basket lines" })).toBeFocused();
  await page.keyboard.press("F2");
  await expect(field(page)).toBeFocused();
});

test("search: type, Up and Down choose, Enter adds the highlighted result, Escape clears", async ({
  page,
}) => {
  await openSale(page, "results");
  await field(page).pressSequentially("milo", { delay: 90 });
  const options = page.getByRole("option");
  await expect(options).toHaveCount(3);
  await expect(options.nth(0)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(options.nth(2)).toHaveAttribute("aria-selected", "true");
  await expect(field(page)).toHaveAttribute("aria-activedescendant", "sale-results-2");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  expect((await calls(page, "add")).map((call) => call.args)).toEqual([[{ productId: "p-m2" }]]);
  await expect(field(page)).toHaveValue("");

  await field(page).pressSequentially("milo", { delay: 90 });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  // The pack barcode adds by code so it keeps its 24-unit quantity.
  expect((await calls(page, "add")).at(-1)?.args).toEqual([{ code: "6161100491234" }]);

  await field(page).pressSequentially("mi", { delay: 90 });
  await page.keyboard.press("Escape");
  await expect(field(page)).toHaveValue("");
  await expect(field(page)).toBeFocused();
});

test("basket: F3, Up and Down select, F4 edits the quantity, Delete removes the line", async ({
  page,
}) => {
  await openSale(page, "lines");
  const list = page.getByRole("list", { name: "Basket lines" });
  await page.keyboard.press("F3");
  await expect(list.getByRole("listitem").nth(3)).toHaveAttribute("aria-current", "true");
  await page.keyboard.press("ArrowUp");
  await expect(list.getByRole("listitem").nth(2)).toHaveAttribute("aria-current", "true");

  await page.keyboard.press("F4");
  const quantity = page.getByRole("textbox", { name: "Quantity of Gari, white" });
  await expect(quantity).toBeFocused();
  await quantity.fill("1.25");
  await page.keyboard.press("Enter");
  expect((await calls(page, "setQuantity")).map((call) => call.args)).toEqual([["l3", 1250]]);
  await expect(field(page)).toBeFocused();

  await page.keyboard.press("F4");
  await page.getByRole("textbox", { name: /Quantity of/ }).fill("abc");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("textbox", { name: /Quantity of/ })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("textbox", { name: /Quantity of/ })).toHaveCount(0);
  expect(await calls(page, "setQuantity")).toHaveLength(1);

  await page.keyboard.press("F3");
  await page.keyboard.press("Delete");
  expect((await calls(page, "removeLine")).map((call) => call.args)).toEqual([["l3"]]);
  await expect(list).toBeFocused();
});

test("Delete in the scan field edits text and never removes a line", async ({ page }) => {
  await openSale(page, "lines");
  await field(page).pressSequentially("ab", { delay: 90 });
  await page.keyboard.press("Home");
  await page.keyboard.press("Delete");
  await expect(field(page)).toHaveValue("b");
  expect(await calls(page, "removeLine")).toEqual([]);
});

test("F8 syncs and the buttons carry their shortcut", async ({ page }) => {
  await openSale(page, "lines");
  await expect(page.getByRole("button", { name: /Sync now/ })).toHaveAttribute(
    "aria-keyshortcuts",
    "F8",
  );
  await page.keyboard.press("F8");
  await page.getByRole("button", { name: /Sync now/ }).click();
  expect(await calls(page, "syncNow")).toHaveLength(2);
});

test("while the host is disconnected every edit is disabled and Reconnect explains and acts", async ({
  page,
}) => {
  await openSale(page, "disconnected");
  await expect(field(page)).toBeDisabled();
  await expect(field(page)).toHaveAttribute("aria-describedby", "sale-banner");
  await expect(
    page.getByRole("button", { name: "Remove Fan Milk Vanilla ice cream" }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: /Sync now/ })).toBeDisabled();
  await page.keyboard.press("F4");
  await expect(page.getByRole("textbox", { name: /Quantity of/ })).toHaveCount(0);
  await page.keyboard.press("F9");
  await page.getByRole("button", { name: /Reconnect/ }).click();
  expect(await calls(page, "reconnect")).toHaveLength(2);
});

test("while a basket call is in flight edits wait", async ({ page }) => {
  await openSale(page, "busy");
  await page.keyboard.press("F4");
  await expect(page.getByRole("textbox", { name: /Quantity of/ })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Increase quantity of Fan Milk Vanilla ice cream" }),
  ).toBeDisabled();
});

test("a failed basket disables edits and storage errors offer a retry", async ({ page }) => {
  await openSale(page, "storage");
  await expect(field(page)).toBeDisabled();
  await page.getByRole("button", { name: /Retry/ }).click();
  expect(await calls(page, "reconnect")).toHaveLength(1);
});
