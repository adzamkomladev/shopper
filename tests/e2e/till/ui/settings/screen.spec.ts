import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { calls, openSale } from "../sale/harness";
import { expectTouchTargets } from "../targets";
import { devices, expectNoOverflow, openSettings, save, shoot } from "./harness";

test("Alt+T opens Settings from the nav and shows this register's saved values", async ({
  page,
}) => {
  await openSale(page, "settings");
  await page.keyboard.press("Alt+T");
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { selected: true })).toHaveCount(0);
  await expect(page.getByText("Register ID: REG-001 · Currency: GHS")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Store name" })).toHaveValue("Osu Mart");
  await expect(page.getByRole("textbox", { name: "Register name" })).toHaveValue("Front till");
  await expect(page.getByRole("switch", { name: "Print receipts automatically" })).toBeChecked();
  await expect(page.getByRole("combobox", { name: "Receipt paper width" })).toContainText(
    "80 mm · Standard thermal",
  );
  await expect(page.getByRole("switch", { name: "Clear cart after a sale" })).toBeChecked();
  await expect(page.getByRole("switch", { name: "Require PIN for returns" })).not.toBeChecked();
  await expect(page.getByText("Changes apply to this register only.")).toBeVisible();
  await page.keyboard.press("Alt+S");
  await expect(page.getByRole("heading", { name: "Checkout", exact: true })).toBeVisible();
});

test("the printer badge is derived from the last real job and never invented", async ({ page }) => {
  await openSettings(page, "settings");
  await expect(devices(page)).toContainText("Epson");
  await expect(devices(page)).toContainText("192.168.1.50:9100");
  await expect(devices(page)).toContainText("80 mm");
  await expect(devices(page).getByText("Not checked")).toBeVisible();
  await expect(devices(page).getByText("Connected", { exact: true })).toHaveCount(0);
  await expect(devices(page)).toContainText("Barcode scanner");
  await expect(devices(page)).toContainText("USB keyboard input");

  await openSettings(page, "settings-connected");
  await expect(devices(page).getByText("Connected", { exact: true })).toHaveCount(1);
  await expect(devices(page).getByText("Not checked")).toHaveCount(0);

  await openSettings(page, "settings-offline");
  await expect(devices(page).getByText("Offline", { exact: true })).toBeVisible();
  await expect(devices(page)).toContainText("connection refused");
});

test("without register.settings the screen is read-only and says who can change it", async ({
  page,
}) => {
  await openSettings(page, "settings-readonly");
  await expect(page.getByText("Ask a manager to change register settings").first()).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Store name" })).toBeEditable({ editable: false });
  await expect(page.getByRole("switch", { name: "Clear cart after a sale" })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Receipt paper width" })).toBeDisabled();
  await expect(save(page)).toBeDisabled();
  await expect(devices(page).getByRole("button", { name: /^Test print/ })).toBeDisabled();
  await expect(devices(page).getByRole("button", { name: /^Open drawer/ })).toBeDisabled();
  await page.keyboard.press("Alt+R");
  expect(await calls(page, "testPrint")).toHaveLength(0);
  await expectNoSeriousAxe(page);
});

test("settings design the loading and disconnected states", async ({ page }, testInfo) => {
  await openSettings(page, "settings-loading");
  await expect(page.getByRole("status")).toContainText("Loading register settings");
  await expectNoSeriousAxe(page);
  await shoot(page, testInfo, "settings-loading");
  await openSettings(page, "settings-disconnected");
  await expect(page.getByText("Register host disconnected")).toBeVisible();
  await page.getByRole("button", { name: /^Reconnect/ }).click();
  expect(await calls(page, "reloadSettings")).toHaveLength(1);
  await expectNoSeriousAxe(page);
  await shoot(page, testInfo, "settings-disconnected");
});

for (const [width, height, label] of [
  [1366, 768, "till"],
  [1440, 900, "laptop"],
  [390, 844, "mobile"],
] as const) {
  test(`settings fit ${label} ${width}×${height} with 44px targets and no serious axe violations`, async ({
    page,
  }, testInfo) => {
    await openSettings(page, "settings-connected");
    await page.setViewportSize({ width, height });
    await expect(devices(page)).toBeVisible();
    await expectNoOverflow(page);
    await expectTouchTargets(page);
    await expectNoSeriousAxe(page);
    await shoot(page, testInfo, `settings-${label}`);
    await page.keyboard.press("Alt+E");
    await expectNoOverflow(page);
    await expectTouchTargets(page);
    await shoot(page, testInfo, `settings-${label}-edit`);
  });
}
