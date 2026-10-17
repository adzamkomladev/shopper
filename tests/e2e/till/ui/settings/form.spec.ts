import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { calls } from "../sale/harness";
import { devices, openSettings, save, savedCall } from "./harness";

test("settings save with only the keyboard and confirm with a toast", async ({ page }) => {
  await openSettings(page);
  await page.getByRole("main", { name: "Settings" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("textbox", { name: "Store name" })).toBeFocused();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("Osu Mart Annex");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("switch", { name: "Print receipts automatically" })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("switch", { name: "Print receipts automatically" }),
  ).not.toBeChecked();
  await page.keyboard.press("ControlOrMeta+S");
  await expect(page.getByText("Register settings saved")).toBeVisible();
  const call = await savedCall(page);
  expect(call?.args[1]).toBe(4);
  expect(call?.args[0]).toMatchObject({
    storeName: "Osu Mart Annex",
    registerName: "Front till",
    printAutomatically: false,
    paperMm: 80,
    printer: { model: "epson", connection: { kind: "network", host: "192.168.1.50", port: 9100 } },
  });
  await expect(page.getByRole("textbox", { name: "Store name" })).toHaveValue("Osu Mart Annex");
});

test("Esc discards unsaved edits", async ({ page }) => {
  await openSettings(page);
  const store = page.getByRole("textbox", { name: "Store name" });
  await store.fill("Changed");
  await page.keyboard.press("Escape");
  await expect(store).toHaveValue("Osu Mart");
  expect(await calls(page, "saveSettings")).toHaveLength(0);
});

test("names are required and a bad host or port is explained next to its field", async ({
  page,
}) => {
  await openSettings(page);
  await page.getByRole("textbox", { name: "Store name" }).fill("   ");
  await page.getByRole("textbox", { name: "Register name" }).fill("");
  await page.keyboard.press("Alt+E");
  const host = page.getByRole("textbox", { name: "IP address or host name" });
  const port = page.getByRole("textbox", { name: "Port" });
  await host.fill("not a host!");
  await port.fill("70000");
  await page.keyboard.press("ControlOrMeta+S");
  await expect(page.getByText("Enter the store name")).toBeVisible();
  await expect(page.getByText("Enter the register name")).toBeVisible();
  await expect(
    page.getByText("Enter an IP address like 192.168.1.50 or a host name"),
  ).toBeVisible();
  await expect(page.getByText("Enter a port from 1 to 65535")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Store name" })).toBeFocused();
  expect(await calls(page, "saveSettings")).toHaveLength(0);
  await expectNoSeriousAxe(page);

  await page.getByRole("textbox", { name: "Store name" }).fill("Osu Mart");
  await page.getByRole("textbox", { name: "Register name" }).fill("Front till");
  await host.fill("printer-1.local");
  await port.fill("9100");
  await page.keyboard.press("ControlOrMeta+S");
  await expect(page.getByText("Register settings saved")).toBeVisible();
  expect((await savedCall(page))?.args[0]).toMatchObject({
    printer: { connection: { host: "printer-1.local", port: 9100 } },
  });
});

test("Edit printer changes the model, host and port and saves with the page", async ({ page }) => {
  await openSettings(page);
  const edit = devices(page).getByRole("button", { name: /^Edit printer/ });
  await expect(edit).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Alt+E");
  await expect(edit).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("combobox", { name: "Printer model" }).click();
  await page.getByRole("option", { name: "Xprinter" }).click();
  await page.getByRole("textbox", { name: "IP address or host name" }).fill("10.0.0.20");
  await page.getByRole("textbox", { name: "Port" }).fill("9101");
  // Test print and Open drawer talk to the saved printer, so they wait for the save.
  await expect(devices(page).getByRole("button", { name: /^Test print/ })).toBeDisabled();
  await expect(devices(page)).toContainText("Save changes to test this printer");
  await save(page).click();
  await expect(page.getByText("Register settings saved")).toBeVisible();
  expect((await savedCall(page))?.args[0]).toMatchObject({
    printer: { model: "xprinter", connection: { kind: "network", host: "10.0.0.20", port: 9101 } },
  });
});

test("a register without a printer offers Add printer, and the printer can be removed again", async ({
  page,
}) => {
  await openSettings(page, "settings-noprinter");
  await expect(devices(page)).toContainText("No printer set up");
  await expect(devices(page).getByRole("button", { name: /^Test print/ })).toHaveCount(0);
  await devices(page)
    .getByRole("button", { name: /^Add printer/ })
    .click();
  await expect(page.getByRole("combobox", { name: "Printer model" })).toContainText("Epson");
  await page.getByRole("textbox", { name: "IP address or host name" }).fill("192.168.1.60");
  await expect(page.getByRole("textbox", { name: "Port" })).toHaveValue("9100");
  await page.keyboard.press("ControlOrMeta+S");
  await expect(page.getByText("Register settings saved")).toBeVisible();
  expect((await savedCall(page))?.args[0]).toMatchObject({
    printer: { model: "epson", connection: { host: "192.168.1.60", port: 9100 } },
  });

  await page.keyboard.press("Alt+E");
  await page.getByRole("button", { name: /^Remove printer/ }).click();
  await expect(devices(page)).toContainText("No printer set up");
  await page.keyboard.press("ControlOrMeta+S");
  await expect(async () =>
    expect((await savedCall(page))?.args[0]).toMatchObject({ printer: null }),
  ).toPass();
});

test("Escape closes an open list without discarding the edits behind it", async ({ page }) => {
  await openSettings(page);
  const store = page.getByRole("textbox", { name: "Store name" });
  await store.fill("Kept");
  await page.getByRole("combobox", { name: "Receipt paper width" }).click();
  await expect(page.getByRole("option", { name: /58 mm/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("option", { name: /58 mm/ })).toHaveCount(0);
  await expect(store).toHaveValue("Kept");
});
