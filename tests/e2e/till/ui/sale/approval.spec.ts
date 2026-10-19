import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { calls, openSale } from "./harness";

const voidDialog = (page: Page) => page.getByRole("dialog", { name: "Void sale" });
const priceDialog = (page: Page) => page.getByRole("dialog", { name: "Override price" });
const alert = (page: Page) => page.getByRole("alert");

/** Reason, then the approval fields, with the keyboard only: Tab to the manager, Arrow keys and Enter to choose. */
async function approveWithKeyboard(page: Page, pin: string) {
  const manager = page.getByRole("combobox", { name: "Manager" });
  await expect(manager).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("option", { name: "Kofi Mensah" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("option", { name: "Abena Owusu" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(manager).toContainText("Abena Owusu");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Manager PIN")).toBeFocused();
  await page.keyboard.type(pin);
}

test("voiding a sale after cash was taken takes a manager and PIN, keyboard only", async ({
  page,
}) => {
  await openSale(page, "void-cash");
  await page.keyboard.press("F11");
  const dialog = voidDialog(page);
  await expect(dialog).toContainText("Cash was taken. A manager must approve this void.");
  await expect(dialog.getByRole("textbox", { name: "Reason" })).toBeFocused();
  await page.keyboard.type("Customer left the queue");
  await page.keyboard.press("Tab");
  await approveWithKeyboard(page, "4321");
  const pin = page.getByLabel("Manager PIN");
  await expect(pin).toHaveAttribute("type", "password");
  await expect(pin).toHaveAttribute("inputmode", "numeric");
  await expectNoSeriousAxe(page);
  await page.keyboard.press("Enter");

  await expect(dialog).toHaveCount(0);
  const [call] = await calls(page, "voidSale");
  expect(call?.args[0]).toBe("Customer left the queue");
  expect(call?.args[3]).toEqual({
    approverId: "10000000-0000-7000-8000-000000000021",
    pin: "4321",
  });
  await expect(page.getByRole("combobox", { name: "Scan barcode or search items" })).toBeFocused();
});

test("a cashier without the void permission is asked for a manager instead of being refused", async ({
  page,
}) => {
  await openSale(page, "no-void-permission");
  await page.keyboard.press("F11");
  const dialog = voidDialog(page);
  await expect(dialog).toContainText("A manager must approve this void.");
  await expect(dialog.getByRole("button", { name: /^Void sale/ })).toBeDisabled();
  await page.keyboard.type("Wrong customer");
  await page.keyboard.press("Tab");
  await approveWithKeyboard(page, "4321");
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  expect((await calls(page, "voidSale"))[0]?.args[3]).toMatchObject({ pin: "4321" });
});

test("a manager voiding an untouched sale is not asked for a PIN", async ({ page }) => {
  await openSale(page, "lines");
  await page.keyboard.press("F11");
  const dialog = voidDialog(page);
  await expect(dialog.getByRole("combobox", { name: "Manager" })).toHaveCount(0);
  await dialog.getByRole("textbox", { name: "Reason" }).fill("Customer changed their mind");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  const [call] = await calls(page, "voidSale");
  expect(call?.args[0]).toBe("Customer changed their mind");
  expect(call?.args[3] ?? null).toBeNull();
});

test("a price override takes a manager and PIN, keyboard only, and the cart shows the list price", async ({
  page,
}) => {
  await openSale(page, "lines");
  await expect(page.getByRole("button", { name: "Override price" })).toHaveAttribute(
    "aria-keyshortcuts",
    "Alt+O",
  );
  await page.keyboard.press("Alt+O");
  const dialog = priceDialog(page);
  await expect(dialog).toContainText("Fan Milk Vanilla ice cream");
  const price = dialog.getByRole("textbox", { name: "New unit price" });
  await expect(price).toBeFocused();
  await expect(price).toHaveValue("6.50");
  await page.keyboard.type("5.00");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Damaged carton");
  await page.keyboard.press("Tab");
  await approveWithKeyboard(page, "4321");
  await expectNoSeriousAxe(page);
  await page.keyboard.press("Enter");

  await expect(dialog).toHaveCount(0);
  expect(await calls(page, "priceLine")).toEqual([
    {
      type: "priceLine",
      args: [
        {
          lineId: "l4",
          unitPrice: 50_000,
          reason: "Damaged carton",
          approval: { approverId: "10000000-0000-7000-8000-000000000021", pin: "4321" },
        },
      ],
    },
  ]);
  const line = page.locator('[data-line="l4"]');
  await expect(line).toContainText("Price override");
  await expect(line.locator("s:visible")).toHaveText("GH₵ 6.50");
  await expect(line).toContainText("GH₵ 5.00");
});

test("a manager overrides a price without approval fields", async ({ page }) => {
  await openSale(page, "price-manager");
  await page.keyboard.press("Alt+O");
  const dialog = priceDialog(page);
  await expect(dialog.getByRole("combobox", { name: "Manager" })).toHaveCount(0);
  await page.keyboard.type("5");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Price match");
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  expect((await calls(page, "priceLine"))[0]?.args).toEqual([
    { lineId: "l4", unitPrice: 50_000, reason: "Price match" },
  ]);
});

test("a price equal to the list price is refused before it is sent", async ({ page }) => {
  await openSale(page, "price-manager");
  await page.keyboard.press("Alt+O");
  const dialog = priceDialog(page);
  await dialog.getByRole("textbox", { name: "Reason" }).fill("Same price");
  await expect(dialog.getByText("List price GH₵ 6.50. Enter a different price.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^Set price/ })).toBeDisabled();
});

test("a price-labelled line cannot be overridden and says why", async ({ page }) => {
  await openSale(page, "price-label");
  const button = page.getByRole("button", { name: "Override price" });
  await expect(button).toBeDisabled();
  await expect(page.getByText("Price-labelled items cannot be overridden")).toBeVisible();
  await page.keyboard.press("Alt+O");
  await expect(priceDialog(page)).toHaveCount(0);
});

test("a wrong PIN says how many tries are left and keeps the dialog open", async ({ page }) => {
  await openSale(page, "void-cash");
  await page.keyboard.press("F11");
  await page.keyboard.type("Customer left");
  await page.keyboard.press("Tab");
  await approveWithKeyboard(page, "0000");
  await page.keyboard.press("Enter");
  await expect(alert(page)).toHaveText("Wrong PIN. 4 tries left");
  const pin = page.getByLabel("Manager PIN");
  await expect(pin).toHaveValue("");
  await expect(pin).toBeFocused();
  await page.keyboard.type("1111");
  await page.keyboard.press("Enter");
  await expect(alert(page)).toHaveText("Wrong PIN. 3 tries left");
  await page.keyboard.type("4321");
  await page.keyboard.press("Enter");
  await expect(voidDialog(page)).toHaveCount(0);
});

test("a locked manager and a manager without the permission are told so", async ({ page }) => {
  await openSale(page, "void-locked");
  await page.keyboard.press("F11");
  await page.keyboard.type("Customer left");
  await page.keyboard.press("Tab");
  await approveWithKeyboard(page, "4321");
  await page.keyboard.press("Enter");
  await expect(alert(page)).toHaveText("Too many attempts. Try again in 15 minutes.");
  await expect(voidDialog(page)).toBeVisible();

  await openSale(page, "void-forbidden");
  await page.keyboard.press("F11");
  await page.keyboard.type("Customer left");
  await page.keyboard.press("Tab");
  await approveWithKeyboard(page, "4321");
  await page.keyboard.press("Enter");
  await expect(alert(page)).toHaveText("This person cannot approve that");
});

test("with no managers synced or a stale list the dialog says to connect and cannot be sent", async ({
  page,
}) => {
  await openSale(page, "void-no-approvers");
  await page.keyboard.press("F11");
  const dialog = voidDialog(page);
  await expect(dialog.getByText("Connect to load manager approvals")).toBeVisible();
  await page.keyboard.type("Customer left");
  await expect(dialog.getByRole("button", { name: /^Void sale/ })).toBeDisabled();
  await expectNoSeriousAxe(page);

  await openSale(page, "void-stale-approvers");
  await page.keyboard.press("F11");
  await expect(
    dialog.getByText("The manager list is out of date. Connect to refresh it."),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^Void sale/ })).toBeDisabled();
});

test("managers that are loading or failed to load show their own state", async ({ page }) => {
  await openSale(page, "void-approvers-loading");
  await page.keyboard.press("F11");
  await expect(voidDialog(page).getByText("Loading managers")).toBeVisible();

  await openSale(page, "void-approvers-failed");
  await page.keyboard.press("F11");
  await expect(voidDialog(page).getByText("Managers could not be loaded.")).toBeVisible();
  await voidDialog(page).getByRole("button", { name: "Try again" }).click();
  expect((await calls(page, "loadApprovers")).length).toBe(2);
});

for (const [name, width, height] of [
  ["till", 1366, 768],
  ["laptop", 1440, 900],
  ["mobile", 390, 844],
] as const) {
  test(`the approval dialogs fit the ${name} screen`, async ({ page }, testInfo) => {
    for (const [scenario, key, dialog] of [
      ["void-cash", "F11", voidDialog(page)],
      ["lines", "Alt+O", priceDialog(page)],
    ] as const) {
      await openSale(page, scenario);
      await page.setViewportSize({ width, height });
      await page.keyboard.press(key);
      await expect(dialog).toBeVisible();
      await dialog.evaluate((node) => Promise.all(node.getAnimations().map((a) => a.finished)));
      const box = await dialog.boundingBox();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(height);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      await page.screenshot({ path: testInfo.outputPath(`${key.replace("+", "")}-${name}.png`) });
    }
  });
}
