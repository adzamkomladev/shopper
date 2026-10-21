// Cash drops, no-sales and the register's variance setting.
import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { openSettings, save, savedCall } from "../settings/harness";
import { expectTouchTargets } from "../targets";
import { dialog, expectFits, open, openSale, shiftCalls, shoot, sizes, toast } from "./harness";

test("Alt+K records a cash drop with its reason, keyboard only", async ({ page }, testInfo) => {
  await openSale(page, "shift-open");
  await page.keyboard.press("Alt+K");
  const form = dialog(page, "Cash drop");
  const amount = form.getByRole("textbox", { name: "Amount (GH₵)" });
  await expect(amount).toBeFocused();
  await page.keyboard.type("1000");
  await page.keyboard.press("Tab");
  await expect(form.getByRole("textbox", { name: "Reason (optional)" })).toBeFocused();
  await page.keyboard.type("Bank run");
  await expect(form.getByRole("button", { name: /^Record drop/ })).toBeEnabled();
  await expectNoSeriousAxe(page);
  await shoot(page, testInfo, "drop-1366");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(form).toHaveCount(0);
  expect(await shiftCalls(page, "shiftDrop")).toEqual([[10_000_000, "Bank run"]]);
  await expect(toast(page)).toContainText("Cash drop of GH₵ 1,000.00 recorded");
  await expect(page.getByRole("combobox", { name: "Scan barcode or search items" })).toBeFocused();
});

test("a drop needs an amount above zero and the reason is optional", async ({ page }) => {
  await openSale(page, "shift-open");
  await page.keyboard.press("Alt+K");
  const form = dialog(page, "Cash drop");
  const submit = form.getByRole("button", { name: /^Record drop/ });
  await expect(submit).toBeDisabled();
  await form.getByRole("textbox", { name: "Amount (GH₵)" }).fill("0");
  await expect(submit).toBeDisabled();
  await page.keyboard.press("ControlOrMeta+Enter");
  expect(await shiftCalls(page, "shiftDrop")).toEqual([]);
  await form.getByRole("textbox", { name: "Amount (GH₵)" }).fill("20.50");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(form).toHaveCount(0);
  expect(await shiftCalls(page, "shiftDrop")).toEqual([[205_000]]);
});

test("Alt+J opens the drawer with a no-sale that needs its reason", async ({ page }, testInfo) => {
  await openSale(page, "shift-open");
  await page.keyboard.press("Alt+J");
  const form = dialog(page, "No sale");
  const reason = form.getByRole("textbox", { name: "Reason" });
  await expect(reason).toBeFocused();
  await page.keyboard.press("ControlOrMeta+Enter");
  expect(await shiftCalls(page, "shiftNoSale")).toEqual([]);
  await expect(form.getByRole("button", { name: /^Open drawer/ })).toBeDisabled();
  await page.keyboard.type("Change for a customer");
  await expectNoSeriousAxe(page);
  await shoot(page, testInfo, "nosale-1366");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(form).toHaveCount(0);
  expect(await shiftCalls(page, "shiftNoSale")).toEqual([["Change for a customer"]]);
  await expect(toast(page)).toContainText("Drawer opened");
});

test("Esc cancels either dialog and records nothing", async ({ page }) => {
  await openSale(page, "shift-open");
  await page.keyboard.press("Alt+K");
  await page.keyboard.type("50");
  await page.keyboard.press("Escape");
  await expect(dialog(page, "Cash drop")).toHaveCount(0);
  await page.keyboard.press("Alt+J");
  await page.keyboard.type("Test");
  await page.keyboard.press("Escape");
  await expect(dialog(page, "No sale")).toHaveCount(0);
  expect(await shiftCalls(page, "shiftDrop")).toEqual([]);
  expect(await shiftCalls(page, "shiftNoSale")).toEqual([]);
});

test("the keys and menu entries work from the Shift screen too", async ({ page }) => {
  await openSale(page, "shift-open");
  await page.keyboard.press("Alt+H");
  await page.keyboard.press("Alt+K");
  await expect(dialog(page, "Cash drop")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Menu/ }).click();
  await page
    .getByRole("dialog", { name: "Menu" })
    .getByRole("button", { name: /^No sale/ })
    .click();
  await expect(dialog(page, "No sale")).toBeVisible();
});

test("a dialog owns the keys: Alt+J and Alt+H do nothing behind an open drop", async ({ page }) => {
  await openSale(page, "shift-open");
  await page.keyboard.press("Alt+K");
  await page.keyboard.type("45");
  await page.keyboard.press("Alt+J");
  await page.keyboard.press("Alt+H");
  await page.keyboard.press("Alt+T");
  await expect(dialog(page, "Cash drop")).toBeVisible();
  await expect(dialog(page, "No sale")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Amount (GH₵)" })).toHaveValue("45");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Shift", exact: true })).toHaveCount(0);
});

test("a refused drop stays in the dialog with the host's words", async ({ page }) => {
  await openSale(page, "shift-counted-drop");
  await page.keyboard.press("Alt+K");
  await page.keyboard.type("10");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(dialog(page, "Cash drop").getByRole("alert")).toHaveText(
    "The drawer is counted. Close the shift",
  );
});

test("without an open shift the keys say why nothing opened", async ({ page }) => {
  await open(page, "shift-none");
  await page.getByRole("heading", { name: "Register closed", exact: true }).waitFor();
  await page.keyboard.press("Alt+K");
  await expect(dialog(page, "Cash drop")).toHaveCount(0);
  await expect(toast(page)).toContainText("Register closed. Open a shift");
  expect(await shiftCalls(page, "shiftDrop")).toEqual([]);
});

test("the Settings drawer test is a no-sale, and a closed register explains the refusal", async ({
  page,
}) => {
  await openSettings(page, "settings-noshift");
  await page.keyboard.press("Alt+D");
  await expect(toast(page)).toContainText("Register closed. Open a shift");
  await expect(page.getByRole("alert").filter({ hasText: "Open drawer failed" })).toContainText(
    "Register closed. Open a shift",
  );
});

test("Cash variance needing a manager shows cedis and saves minor units", async ({
  page,
}, testInfo) => {
  await openSettings(page);
  const field = page.getByRole("textbox", { name: "Cash variance needing a manager" });
  await expect(field).toHaveValue("5.00");
  await expect(page.getByText(/closing with a variance above this/i)).toBeVisible();
  await field.fill("10");
  await shoot(page, testInfo, "settings-variance-1366");
  await page.keyboard.press("ControlOrMeta+S");
  await expect(page.getByText("Register settings saved")).toBeVisible();
  expect((await savedCall(page))?.args[0]).toMatchObject({ varianceThreshold: 100_000 });
  await field.fill("2000");
  await page.keyboard.press("ControlOrMeta+S");
  await expect(page.getByText("Enter an amount from GH₵ 0 to GH₵ 1,000")).toBeVisible();
  await expect(save(page)).toBeVisible();
  await expectNoSeriousAxe(page);
});

for (const size of sizes)
  test(`at ${size.name}: the drop and no-sale dialogs fit`, async ({ page }, testInfo) => {
    await page.setViewportSize(size);
    await open(page, "shift-open");
    await page.getByRole("tablist", { name: "Register sections" }).waitFor();
    for (const [key, name] of [
      ["Alt+K", "Cash drop"],
      ["Alt+J", "No sale"],
    ] as const) {
      await page.keyboard.press(key);
      await expect(dialog(page, name)).toBeVisible();
      await expectFits(page);
      await expectTouchTargets(page);
      await shoot(page, testInfo, `${name === "No sale" ? "nosale" : "drop"}-${size.name}`);
      await page.keyboard.press("Escape");
      await expect(dialog(page, name)).toHaveCount(0);
    }
  });
