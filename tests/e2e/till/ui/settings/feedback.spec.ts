import { expect, test } from "@playwright/test";
import { calls } from "../sale/harness";
import { devices, openSettings, save } from "./harness";

test("Test print and Open drawer show printing, printed and offline feedback", async ({ page }) => {
  await openSettings(page, "settings-connected");
  await expect(devices(page)).toContainText("Last print succeeded");
  await page.keyboard.press("Alt+R");
  await expect(page.getByRole("status").filter({ hasText: "Test page sent" })).toBeVisible();
  // The result is also a toast, so it is seen even when the device card is scrolled out of view.
  await expect(page.locator("[data-sonner-toast]")).toContainText("Test page sent to the printer");
  expect(await calls(page, "testPrint")).toHaveLength(1);
  await page.keyboard.press("Alt+D");
  await expect(
    page.locator("[data-sonner-toast]").filter({ hasText: "Drawer opened" }),
  ).toBeVisible();
  expect(await calls(page, "openDrawer")).toHaveLength(1);

  await openSettings(page, "settings-printfail");
  await devices(page)
    .getByRole("button", { name: /^Test print/ })
    .click();
  await expect(page.getByRole("alert").filter({ hasText: "Test print failed" })).toContainText(
    "Printer is offline",
  );
  await expect(page.locator("[data-sonner-toast]")).toContainText("Test print failed");
});

test("a slow save shows Saving and blocks a second submit", async ({ page }) => {
  await openSettings(page, "settings-slow");
  await page.getByRole("textbox", { name: "Store name" }).fill("Osu Mart 2");
  await save(page).click();
  await expect(page.getByRole("button", { name: /^Saving/ })).toBeDisabled();
  await page.keyboard.press("ControlOrMeta+S");
  await expect(page.getByText("Register settings saved")).toBeVisible();
  expect(await calls(page, "saveSettings")).toHaveLength(1);
});

test("a save from another screen asks the cashier to reload instead of overwriting", async ({
  page,
}) => {
  await openSettings(page, "settings-stale");
  // Alt+L only reloads once there is something to reload.
  await page.keyboard.press("Alt+L");
  expect(await calls(page, "reloadSettings")).toHaveLength(0);
  await page.getByRole("textbox", { name: "Store name" }).fill("Mine");
  await save(page).click();
  const alert = page.getByRole("alert").filter({ hasText: "Settings changed on another screen" });
  await expect(alert).toBeVisible();
  // Saving waits for the reload, and the notice is the reason.
  await expect(save(page)).toBeDisabled();
  await expect(save(page)).toHaveAccessibleDescription(/Reload settings/);
  await alert.getByRole("button", { name: /Reload settings/ }).click();
  expect(await calls(page, "reloadSettings")).toHaveLength(1);
  await expect(alert).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Store name" })).toHaveValue("Other screen");
});

test("a storage error keeps the edits and Retry saves them", async ({ page }) => {
  await openSettings(page, "settings-storage");
  await page.getByRole("textbox", { name: "Store name" }).fill("Kept edit");
  await save(page).click();
  const alert = page.getByRole("alert").filter({ hasText: "Settings could not be saved" });
  await expect(alert).toContainText("Register storage is unavailable");
  await expect(page.getByRole("textbox", { name: "Store name" })).toHaveValue("Kept edit");
  await alert.getByRole("button", { name: /^Retry/ }).click();
  await expect(page.getByText("Register settings saved")).toBeVisible();
  expect(await calls(page, "saveSettings")).toHaveLength(2);
});

test("buttons are disabled and relabelled while a printer job runs", async ({ page }) => {
  await openSettings(page, "settings-slowdevice");
  await page.keyboard.press("Alt+R");
  const test = devices(page).getByRole("button", { name: /^Printing/ });
  await expect(test).toBeDisabled();
  await expect(devices(page).getByRole("button", { name: /^Open drawer/ })).toBeDisabled();
  await page.keyboard.press("Alt+D");
  expect(await calls(page, "openDrawer")).toHaveLength(0);
  await expect(devices(page).getByRole("button", { name: /^Test print/ })).toBeEnabled();
  expect(await calls(page, "testPrint")).toHaveLength(1);
});

test("an offline printer tells the cashier what to check", async ({ page }) => {
  await openSettings(page, "settings-offline");
  await expect(devices(page)).toContainText(
    "Last print failed: connection refused (192.168.1.50:9100). Check the printer is on and on the same network.",
  );
});
