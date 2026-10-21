// Opening a shift on the till: the closed register, the float dialog, and the screens that need a shift.
import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { expectTouchTargets } from "../targets";
import {
  count,
  dialog,
  expectFits,
  open,
  openBlockedSale,
  openSale,
  openShiftScreen,
  shiftCalls,
  shoot,
  sizes,
} from "./harness";

const scan = (page: import("@playwright/test").Page) =>
  page.getByRole("combobox", { name: "Scan barcode or search items" });

test("a register with no shift cannot sell and offers Open shift with its key", async ({
  page,
}) => {
  await openBlockedSale(page, "shift-none");
  await expect(
    page.getByRole("main", { name: "Sale" }).getByText("Open a shift to start selling"),
  ).toBeVisible();
  await expect(scan(page)).toHaveCount(0);
  const action = page.getByRole("button", { name: /^Open shift/ });
  await expect(action).toHaveAttribute("aria-keyshortcuts", "Alt+O");
  await expectNoSeriousAxe(page);
  await page.keyboard.press("F2");
  await expect(scan(page)).toHaveCount(0);
});

test("the float is counted by denomination with a live total, then the shift opens", async ({
  page,
}, testInfo) => {
  await openBlockedSale(page, "shift-none");
  await page.keyboard.press("Alt+O");
  const form = dialog(page, "Open shift");
  await expect(form).toBeVisible();
  await expect(count(page, "200")).toBeFocused();
  await expect(form).toContainText("Counted GH₵ 0.00");
  await count(page, "200").fill("1");
  await count(page, "0.50").fill("3");
  await expect(form).toContainText("Counted GH₵ 201.50");
  await expectNoSeriousAxe(page);
  await expectTouchTargets(page);
  await shoot(page, testInfo, "open-float-1366");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(form).toHaveCount(0);
  expect(await shiftCalls(page, "shiftOpen")).toEqual([[{ counts: { "2000000": 1, "5000": 3 } }]]);
  await expect(scan(page)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Register closed" })).toHaveCount(0);
});

test("Enter in a count box moves to the next one and never sends the float", async ({ page }) => {
  await openBlockedSale(page, "shift-none");
  await page.keyboard.press("Alt+O");
  const form = dialog(page, "Open shift");
  await expect(count(page, "200")).toBeFocused();
  await page.keyboard.type("1");
  await page.keyboard.press("Enter");
  await expect(count(page, "100")).toBeFocused();
  await page.keyboard.type("2");
  await page.keyboard.press("Enter");
  await expect(count(page, "50")).toBeFocused();
  expect(await shiftCalls(page, "shiftOpen")).toEqual([]);
  await expect(form).toBeVisible();
});

test("an empty count is not a float, and the amount 0 is", async ({ page }) => {
  await openBlockedSale(page, "shift-none");
  await page.keyboard.press("Alt+O");
  const form = dialog(page, "Open shift");
  await expect(form).toContainText("Count at least one note or coin, or enter 0 as an amount");
  await expect(form.getByRole("button", { name: /^Open shift/ })).toBeDisabled();
  await page.keyboard.press("ControlOrMeta+Enter");
  expect(await shiftCalls(page, "shiftOpen")).toEqual([]);
  await form.getByRole("button", { name: /^Enter an amount/ }).click();
  await page.getByRole("textbox", { name: "Float amount (GH₵)" }).fill("0");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(form).toHaveCount(0);
  expect(await shiftCalls(page, "shiftOpen")).toEqual([[{ float: 0 }]]);
});

test("the float can be one amount typed in cedis", async ({ page }) => {
  await openBlockedSale(page, "shift-none");
  await page.keyboard.press("Alt+O");
  const form = dialog(page, "Open shift");
  await form.getByRole("button", { name: /^Enter an amount/ }).click();
  const amount = form.getByRole("textbox", { name: "Float amount (GH₵)" });
  await expect(amount).toBeFocused();
  await amount.fill("abc");
  await expect(amount).toHaveValue("");
  await amount.fill("150.5");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(form).toHaveCount(0);
  expect(await shiftCalls(page, "shiftOpen")).toEqual([[{ float: 1_505_000 }]]);
});

test("Esc cancels the float dialog and records nothing", async ({ page }) => {
  await openBlockedSale(page, "shift-none");
  await page.keyboard.press("Alt+O");
  await count(page, "100").fill("2");
  await page.keyboard.press("Escape");
  await expect(dialog(page, "Open shift")).toHaveCount(0);
  expect(await shiftCalls(page, "shiftOpen")).toEqual([]);
  await expect(page.getByRole("button", { name: /^Open shift/ })).toBeFocused();
});

test("a refused open stays in the dialog with the host's words", async ({ page }) => {
  await openBlockedSale(page, "shift-open-refused");
  await page.keyboard.press("Alt+O");
  await count(page, "100").fill("2");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(dialog(page, "Open shift").getByRole("alert")).toHaveText(
    "This register already has an open shift",
  );
});

test("after the count the register is Counting and points to the close", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page, "shift-counting");
  await expect(page.getByRole("heading", { name: "Drawer counted", exact: true })).toBeVisible();
  await expect(
    page.getByRole("main", { name: "Sale" }).getByText("The drawer is counted. Close the shift"),
  ).toBeVisible();
  await expect(scan(page)).toHaveCount(0);
  await page.getByRole("button", { name: /^Close shift/ }).click();
  await expect(page.getByRole("heading", { name: "Shift", exact: true })).toBeVisible();
  await expectNoSeriousAxe(page);
});

test("the Shift screen of a closed register has the open entry and the last Z upload state", async ({
  page,
}) => {
  await openShiftScreen(page, "shift-none");
  await expect(
    page.getByRole("main", { name: "Shift" }).getByText("Open a shift to start selling"),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Last shift" })).toHaveCount(0);
  await page.keyboard.press("Alt+O");
  await expect(dialog(page, "Open shift")).toBeVisible();
});

for (const [scenario, text] of [
  ["shift-last-pending", "Waiting to upload"],
  ["shift-last-accepted", "Uploaded"],
  ["shift-last-rejected", "Rejected: Declared cash does not match its counts"],
] as const)
  test(`the last Z shows its upload state: ${scenario}`, async ({ page }) => {
    await openShiftScreen(page, scenario);
    const last = page.getByRole("region", { name: "Last shift" });
    await expect(last).toContainText(text);
    await expect(last.getByRole("button", { name: /^Reprint Z/ })).toHaveAttribute(
      "aria-keyshortcuts",
      "Alt+R",
    );
    await expectNoSeriousAxe(page);
  });

test("the Menu and the keys reach the shift screens, and a user without shift.write has none", async ({
  page,
}) => {
  await openSale(page, "shift-open");
  await page.getByRole("button", { name: /^Menu/ }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu.getByRole("button", { name: /^Shift/ })).toHaveAttribute(
    "aria-keyshortcuts",
    "Alt+H",
  );
  await expect(menu.getByRole("button", { name: /^Cash drop/ })).toHaveAttribute(
    "aria-keyshortcuts",
    "Alt+K",
  );
  await expect(menu.getByRole("button", { name: /^No sale/ })).toHaveAttribute(
    "aria-keyshortcuts",
    "Alt+J",
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Alt+H");
  await expect(page.getByRole("heading", { name: "Shift", exact: true })).toBeVisible();

  await open(page, "shift-open", "&permissions=sale.create,shift.read");
  await page.getByRole("button", { name: /^Menu/ }).click();
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^(Shift|Cash drop|No sale)/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Alt+H");
  await expect(page.getByRole("heading", { name: "Shift", exact: true })).toHaveCount(0);
});

for (const size of sizes)
  test(`at ${size.name}: the closed register and the float dialog fit`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(size);
    await open(page, "shift-none");
    await expect(page.getByRole("heading", { name: "Register closed", exact: true })).toBeVisible();
    await expectFits(page);
    await shoot(page, testInfo, `closed-${size.name}`);
    await page.getByRole("button", { name: /^Open shift/ }).click();
    await expect(dialog(page, "Open shift")).toBeVisible();
    await expectFits(page);
    await expectTouchTargets(page);
    await expectNoSeriousAxe(page);
    await shoot(page, testInfo, `float-${size.name}`);
  });
