import { expect, test } from "@playwright/test";
import { calls, openSale } from "./harness";

test("receipt completion locks scans and charges until the cashier starts a new sale", async ({
  page,
}) => {
  await openSale(page, "lines");
  await page.getByRole("textbox", { name: "Amount tendered" }).fill("200.00");
  await page.keyboard.press("F5");
  const receipt = page.getByRole("region", { name: "Sale receipt" });
  await expect(receipt).toBeVisible();
  await expect(receipt.getByText("Change due")).toBeVisible();
  await expect(page.getByRole("region", { name: "Basket" })).toContainText("Sale complete");
  await expect(page.getByRole("region", { name: "Basket" })).not.toContainText(
    "Basket unavailable",
  );
  await expect(page.getByRole("combobox")).toBeDisabled();

  await page.keyboard.press("F5");
  await page.keyboard.press("F2");
  await page.keyboard.type("104820000001");
  expect(await calls(page, "charge")).toHaveLength(1);
  expect(await calls(page, "complete")).toEqual([]);
  expect(await calls(page, "add")).toEqual([]);
  await expect(receipt).toBeVisible();

  await page.keyboard.press("Enter");
  expect(await calls(page, "newSale")).toHaveLength(1);
  await expect(page.getByRole("combobox")).toBeEnabled();
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
