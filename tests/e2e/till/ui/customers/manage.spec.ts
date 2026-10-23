// The customer on the sale: edit, remove, duplicates, offline and no permission.
import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { calls, openSale } from "../sale/harness";
import { ama, chip, dialog, kofiTraders, lookup, phone, shoot } from "./harness";

test("Alt+E edits the attached customer and Alt+R removes them", async ({ page }) => {
  await openSale(page, "customers-attached");
  await expect(chip(page)).toContainText("Ama Mensah");
  await page.keyboard.press("Alt+E");
  const edit = dialog(page, "Edit customer");
  await expect(edit).toBeVisible();
  await expect(edit.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("Ama Mensah");
  await expect(edit.getByRole("textbox", { name: "Customer phone", exact: true })).toHaveValue(
    "0241234567",
  );
  await edit.getByRole("textbox", { name: "Name", exact: true }).fill("Ama Mensah-Boateng");
  await page.keyboard.press("Control+Enter");
  await expect(edit).toHaveCount(0);
  const [saved] = await calls(page, "saveCustomer");
  expect(saved!.args).toEqual([
    {
      name: "Ama Mensah-Boateng",
      phone: "0241234567",
      kind: "individual",
      businessName: null,
      tin: null,
    },
    ama,
  ]);
  await expect(chip(page)).toContainText("Ama Mensah-Boateng");
  await page.keyboard.press("Alt+R");
  await expect(chip(page)).toHaveCount(0);
  expect((await calls(page, "attachCustomer")).map((call) => call.args).at(-1)).toEqual([null]);
  await expect(page.getByRole("combobox", { name: /Scan/ })).toBeFocused();
});

test("the chip's own buttons edit and remove too, and show their keys", async ({ page }) => {
  await openSale(page, "customers-business");
  await expect(chip(page)).toContainText("Kofi Traders Ltd");
  await expect(chip(page)).toContainText("TIN C0012345678");
  const edit = chip(page).getByRole("button", { name: "Edit customer" });
  await expect(edit).toHaveAttribute("aria-keyshortcuts", "Alt+E");
  await edit.click();
  await expect(dialog(page, "Edit customer")).toBeVisible();
  await page.keyboard.press("Escape");
  await chip(page).getByRole("button", { name: "Remove customer" }).click();
  await expect(chip(page)).toHaveCount(0);
});

test("two customers on one number are listed, and the arrow keys choose between them", async ({
  page,
}) => {
  await openSale(page, "customers");
  await page.keyboard.press("Alt+U");
  await lookup(page, "0240000002");
  await expect(dialog(page)).toContainText("2 customers use this number");
  const options = dialog(page).getByRole("option");
  await expect(options).toHaveCount(2);
  await expect(options.nth(0)).toHaveAttribute("aria-selected", "true");
  await expect(options.nth(1)).toContainText("Kofi Traders Ltd");
  await expect(options.nth(1)).toContainText("TIN C0012345678");
  await expect(options.nth(1)).toContainText("Not uploaded yet");
  await page.keyboard.press("ArrowDown");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  expect((await calls(page, "attachCustomer")).map((call) => call.args)).toEqual([[kofiTraders]]);
  await expect(chip(page)).toContainText("Kofi Traders Ltd");
});

test("typing another number starts over: the old matches and form go away", async ({ page }) => {
  await openSale(page, "customers");
  await page.keyboard.press("Alt+U");
  await lookup(page, "0241234567");
  await expect(dialog(page).getByRole("option")).toHaveCount(1);
  await page.keyboard.press("Backspace");
  await expect(dialog(page).getByRole("option")).toHaveCount(0);
  await page.keyboard.type("1");
  await page.keyboard.press("Enter");
  await expect(dialog(page).getByRole("option")).toHaveCount(0);
  await expect(dialog(page)).toContainText("No customer uses this number");
});

test("offline: the dialog still finds and creates, and says when it will upload", async ({
  page,
}) => {
  await openSale(page, "customers-offline");
  await page.keyboard.press("Alt+U");
  await expect(dialog(page)).toContainText("New customers upload when the register reconnects");
  await lookup(page, "0241234567");
  await expect(dialog(page).getByRole("option", { name: /Ama Mensah/ })).toBeVisible();
  await expectNoSeriousAxe(page);
});

test("without customer access the tiles are disabled with the reason and the keys do nothing", async ({
  page,
}) => {
  await openSale(page, "customers-nopermission");
  for (const [name, key] of [
    ["Add customer", "Alt+U"],
    ["Create invoice", "Alt+I"],
  ] as const) {
    const tile = page.getByRole("button", { name });
    await expect(tile).toBeDisabled();
    await expect(tile).toContainText("Needs customer access");
    await page.keyboard.press(key);
  }
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expectNoSeriousAxe(page);
  await shoot(page, "customers-nopermission");
});

test("a cashier who can look but not write finds customers and is told why they cannot add one", async ({
  page,
}) => {
  await openSale(page, "customers-readonly");
  await page.keyboard.press("Alt+U");
  await lookup(page, "0249999999");
  await expect(dialog(page)).toContainText("No customer uses this number");
  await expect(dialog(page)).toContainText("You don't have permission to add customers");
  await expect(dialog(page).getByRole("textbox", { name: "Name", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Add customer" }).click();
  await lookup(page, "0241234567");
  await expect(dialog(page).getByRole("option")).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(chip(page)).toContainText("Ama Mensah");
  await expect(chip(page).getByRole("button", { name: "Edit customer" })).toHaveCount(0);
  await page.keyboard.press("Alt+E");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a failed lookup says so and the number can be tried again", async ({ page }) => {
  await openSale(page, "customers");
  await page.keyboard.press("Alt+U");
  await lookup(page, "0240000500");
  await expect(dialog(page).getByRole("alert")).toContainText(
    "The register could not look that up",
  );
  await expect(phone(page)).toBeFocused();
  await page.keyboard.press("Enter");
  expect(await calls(page, "findCustomers")).toHaveLength(2);
});
