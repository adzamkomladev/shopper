import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { calls } from "../sale/harness";
import { devices, openSettings, pick, savedCall, shoot } from "./harness";

const reasons = "Each serial device needs its own port";

test("the printer connection switches to USB, lists Windows printers and saves the chosen one", async ({
  page,
}, testInfo) => {
  await openSettings(page);
  await page.keyboard.press("Alt+E");
  await expect(page.getByRole("combobox", { name: "Connection" })).toContainText("Network");
  await pick(page, "Connection", "USB");
  const name = page.getByRole("combobox", { name: "Printer name" });
  await expect(name).toBeVisible();
  await expect(page.getByText("USB printers work on Windows.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "IP address or host name" })).toHaveCount(0);
  await name.click();
  await expect(page.getByRole("option")).toHaveText(["EPSON TM-T20III Receipt", "Xprinter XP-80C"]);
  await page.getByRole("option", { name: "EPSON TM-T20III Receipt" }).click();
  await expect(devices(page)).toContainText("USB · EPSON TM-T20III Receipt");
  await expectNoSeriousAxe(page);
  await shoot(page, testInfo, "settings-usb");
  await page.keyboard.press("ControlOrMeta+S");
  await expect(page.getByText("Register settings saved")).toBeVisible();
  expect((await savedCall(page))?.args[0]).toMatchObject({
    printer: {
      model: "epson",
      connection: { kind: "usb", printerName: "EPSON TM-T20III Receipt" },
    },
  });
});

test("a USB printer without a name is explained next to the field and keeps the host untouched", async ({
  page,
}) => {
  await openSettings(page);
  await page.keyboard.press("Alt+E");
  await pick(page, "Connection", "USB");
  await expect(page.getByRole("combobox", { name: "Printer name" })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+S");
  await expect(page.getByText("Enter the printer name as Windows lists it")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Printer name" })).toBeFocused();
  expect(await calls(page, "saveSettings")).toHaveLength(0);
  await expectNoSeriousAxe(page);
});

test("a serial printer picks a port and baud rate, and saves the baud rate as a number", async ({
  page,
}, testInfo) => {
  await openSettings(page);
  await page.keyboard.press("Alt+E");
  await pick(page, "Connection", "Serial port");
  await pick(page, "Port", /^COM4 · Prolific/);
  await pick(page, "Baud rate", "38400");
  await expect(devices(page)).toContainText("Serial · COM4 @ 38400");
  await expectNoSeriousAxe(page);
  await shoot(page, testInfo, "settings-serial");
  await page.keyboard.press("ControlOrMeta+S");
  await expect(page.getByText("Register settings saved")).toBeVisible();
  expect((await savedCall(page))?.args[0]).toMatchObject({
    printer: { connection: { kind: "serial", path: "COM4", baudRate: 38400 } },
  });
});

test("a scanner and a customer display switch to serial with only the keyboard", async ({
  page,
}, testInfo) => {
  await openSettings(page);
  await expect(devices(page)).toContainText("Second screen when one is connected");
  await page.keyboard.press("Alt+B");
  await expect(page.getByRole("combobox", { name: "Scanner connection" })).toBeFocused();
  await expect(page.getByRole("combobox", { name: "Scanner connection" })).toContainText(
    "Keyboard (USB)",
  );
  await page.keyboard.press("Enter");
  await expect(page.getByRole("option", { name: "Keyboard (USB)" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("option", { name: "Serial port" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("combobox", { name: "Scanner connection" })).toContainText(
    "Serial port",
  );
  await pick(page, "Port", /^COM4/);
  await pick(page, "Baud rate", "19200");
  await page.keyboard.press("Alt+M");
  await expect(page.getByRole("combobox", { name: "Display connection" })).toBeFocused();
  await pick(page, "Display connection", "Pole display (serial)");
  await page.getByRole("combobox", { name: "Port", exact: true }).last().click();
  await page.getByRole("option", { name: /^COM5/ }).click();
  await expect(devices(page)).toContainText("Serial · COM4 @ 19200");
  await expect(devices(page)).toContainText("Pole display · COM5 @ 9600");
  await expect(devices(page).getByRole("button", { name: /^Edit scanner/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expectNoSeriousAxe(page);
  await shoot(page, testInfo, "settings-scanner-display");
  await page.keyboard.press("ControlOrMeta+S");
  await expect(page.getByText("Register settings saved")).toBeVisible();
  expect((await savedCall(page))?.args[0]).toMatchObject({
    scanner: { kind: "serial", path: "COM4", baudRate: 19200 },
    display: { kind: "serial", path: "COM5", baudRate: 9600 },
  });
  // Saving starts the form again from the host's copy, so the editors are closed.
  const edit = devices(page).getByRole("button", { name: /^Edit scanner/ });
  await expect(edit).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Alt+B");
  await expect(page.getByRole("combobox", { name: "Scanner connection" })).toBeFocused();
  await page.keyboard.press("Alt+B");
  await expect(edit).toBeFocused();
  await expect(edit).toHaveAttribute("aria-expanded", "false");
});

test("going back to the keyboard scanner clears the serial port", async ({ page }) => {
  await openSettings(page, "settings-serial");
  await page.keyboard.press("Alt+B");
  await pick(page, "Scanner connection", "Keyboard (USB)");
  await expect(devices(page)).toContainText("USB keyboard input");
  await page.keyboard.press("ControlOrMeta+S");
  await expect(page.getByText("Register settings saved")).toBeVisible();
  expect((await savedCall(page))?.args[0]).toMatchObject({ scanner: null });
});

test("two serial devices on one port are refused next to both fields", async ({
  page,
}, testInfo) => {
  await openSettings(page, "settings-serial");
  await page.keyboard.press("Alt+M");
  await pick(page, "Port", "COM3 · FTDI");
  await page.keyboard.press("ControlOrMeta+S");
  await expect(page.getByText(reasons)).toHaveCount(2);
  await expect(page.getByRole("combobox", { name: "Port", exact: true }).first()).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(await calls(page, "saveSettings")).toHaveLength(0);
  await expectNoSeriousAxe(page);
  await shoot(page, testInfo, "settings-shared-port");
  await pick(page, "Display connection", "Second screen");
  await page.keyboard.press("ControlOrMeta+S");
  await expect(page.getByText("Register settings saved")).toBeVisible();
  expect((await savedCall(page))?.args[0]).toMatchObject({
    printer: { connection: { path: "COM3" } },
    scanner: { path: "COM4" },
    display: null,
  });
});
