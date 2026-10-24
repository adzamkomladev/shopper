// The customer dialog on the harness: find by phone, quick-create, the invoice TIN and the inline errors.
import { expect, test } from "@playwright/test";
import { calls, openSale } from "../sale/harness";
import { ama, chip, dialog, lookup, phone } from "./harness";

test("Alt+U finds a regular by phone, Enter attaches, and the chip names her", async ({ page }) => {
  await openSale(page, "customers");
  await page.keyboard.press("Alt+U");
  await expect(dialog(page)).toBeVisible();
  await expect(phone(page)).toBeFocused();
  await lookup(page, "024 123 4567");
  const option = dialog(page).getByRole("option", { name: /Ama Mensah/ });
  await expect(option).toBeVisible();
  expect((await calls(page, "findCustomers")).map((call) => call.args)).toEqual([["0241234567"]]);
  await expect(dialog(page).getByText("customers use this number")).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toHaveCount(0);
  expect((await calls(page, "attachCustomer")).map((call) => call.args)).toEqual([[ama]]);
  await expect(chip(page)).toContainText("Ama Mensah");
  await expect(chip(page)).toContainText("024 ••• 4567");
  await expect(chip(page)).not.toContainText("TIN");
  await expect(page.getByRole("combobox", { name: /Scan/ })).toBeFocused();
});

test("the tile opens the same dialog with the mouse and works before the first item", async ({
  page,
}) => {
  await openSale(page, "customers-empty");
  const tile = page.getByRole("button", { name: "Add customer" });
  await expect(tile).toHaveAttribute("aria-keyshortcuts", "Alt+U");
  await expect(tile).toContainText("Alt+U");
  await expect(tile).toBeEnabled();
  await tile.click();
  await expect(dialog(page)).toBeVisible();
  await expect(phone(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: /Scan/ })).toBeFocused();
});

test("an unknown number opens quick-create; Ctrl+Enter creates an individual and attaches", async ({
  page,
}) => {
  await openSale(page, "customers");
  await page.keyboard.press("Alt+U");
  await lookup(page, "0249999999");
  await expect(dialog(page)).toContainText("No customer uses this number");
  const name = dialog(page).getByRole("textbox", { name: "Name", exact: true });
  await expect(name).toBeFocused();
  await expect(dialog(page).getByRole("button", { name: "Individual" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(dialog(page).getByRole("textbox", { name: "TIN", exact: true })).toHaveCount(0);
  await name.fill("Yaw Boateng");
  await page.keyboard.press("Control+Enter");
  await expect(dialog(page)).toHaveCount(0);
  const [saved] = await calls(page, "saveCustomer");
  expect(saved!.args).toEqual([
    { name: "Yaw Boateng", phone: "0249999999", kind: "individual", businessName: null, tin: null },
  ]);
  expect((await calls(page, "attachCustomer")).map((call) => call.args)).toHaveLength(1);
  await expect(chip(page)).toContainText("Yaw Boateng");
});

test("a business needs a name and a well-formed TIN, and each error sits on its field", async ({
  page,
}) => {
  await openSale(page, "customers");
  await page.keyboard.press("Alt+U");
  await lookup(page, "0249999999");
  await dialog(page).getByRole("textbox", { name: "Name", exact: true }).fill("Kofi Asante");
  await dialog(page).getByRole("button", { name: "Business" }).click();
  await page.keyboard.press("Control+Enter");
  const businessName = dialog(page).getByRole("textbox", { name: "Business name", exact: true });
  await expect(businessName).toHaveAttribute("aria-invalid", "true");
  await expect(dialog(page)).toContainText("Enter the business name");
  await expect(businessName).toBeFocused();
  await businessName.fill("Asante Traders Ltd");
  const tin = dialog(page).getByRole("textbox", { name: "TIN", exact: true });
  await tin.fill("bad");
  await page.keyboard.press("Control+Enter");
  await expect(tin).toHaveAttribute("aria-invalid", "true");
  await expect(dialog(page)).toContainText("A TIN is a letter and ten digits, like C0012345678");
  expect(await calls(page, "saveCustomer")).toHaveLength(0);
  await tin.fill("c0012345678");
  await page.keyboard.press("Control+Enter");
  await expect(dialog(page)).toHaveCount(0);
  const [saved] = await calls(page, "saveCustomer");
  expect(saved!.args).toEqual([
    {
      name: "Kofi Asante",
      phone: "0249999999",
      kind: "business",
      businessName: "Asante Traders Ltd",
      tin: "C0012345678",
    },
  ]);
  await expect(chip(page)).toContainText("Asante Traders Ltd");
  await expect(chip(page)).toContainText("TIN C0012345678");
});

test("a malformed phone is explained in the field and nothing is looked up", async ({ page }) => {
  await openSale(page, "customers");
  await page.keyboard.press("Alt+U");
  await lookup(page, "12345");
  await expect(phone(page)).toHaveAttribute("aria-invalid", "true");
  await expect(dialog(page)).toContainText("Enter a Ghana mobile number, like 024 123 4567");
  expect(await calls(page, "findCustomers")).toHaveLength(0);
});

test("Create invoice opens in business mode and will not save without a TIN", async ({ page }) => {
  await openSale(page, "customers");
  await page.keyboard.press("Alt+I");
  await expect(dialog(page, "Create invoice")).toBeVisible();
  await lookup(page, "0249999999");
  await expect(
    dialog(page, "Create invoice").getByRole("button", { name: "Business" }),
  ).toHaveAttribute("aria-pressed", "true");
  await dialog(page, "Create invoice")
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Efua Quaye");
  await dialog(page, "Create invoice")
    .getByRole("textbox", { name: "Business name", exact: true })
    .fill("Quaye Supplies");
  await page.keyboard.press("Control+Enter");
  const tin = dialog(page, "Create invoice").getByRole("textbox", { name: "TIN", exact: true });
  await expect(tin).toHaveAttribute("aria-invalid", "true");
  await expect(dialog(page, "Create invoice")).toContainText(
    "Enter the TIN to print on the invoice",
  );
  await expect(tin).toBeFocused();
  await tin.fill("C0098765432");
  await page.keyboard.press("Control+Enter");
  await expect(dialog(page, "Create invoice")).toHaveCount(0);
  await expect(chip(page)).toContainText("TIN C0098765432");
});

test("Create invoice on a customer without a TIN asks for it before it attaches", async ({
  page,
}) => {
  await openSale(page, "customers");
  await page.keyboard.press("Alt+I");
  await lookup(page, "0241234567");
  await expect(dialog(page, "Create invoice").getByRole("option")).toHaveCount(1);
  await page.keyboard.press("Enter");
  const invoice = dialog(page, "Create invoice");
  await expect(invoice).toContainText("Ama Mensah needs a TIN for the invoice");
  expect(await calls(page, "attachCustomer")).toHaveLength(0);
  const tin = invoice.getByRole("textbox", { name: "TIN", exact: true });
  await expect(tin).toBeFocused();
  await tin.fill("P0011223344");
  await page.keyboard.press("Control+Enter");
  await expect(invoice).toHaveCount(0);
  const [saved] = await calls(page, "saveCustomer");
  expect(saved!.args[1]).toBe(ama);
  expect((saved!.args[0] as { tin: string }).tin).toBe("P0011223344");
  await expect(chip(page)).toContainText("TIN P0011223344");
});
