import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../../support/e2e";
import { calls } from "../../sale/harness";
import { expectTouchTargets } from "../../targets";
import { devices, expectNoOverflow, openSettings, pick, save, savedCall, shoot } from "../harness";

test("a serial device without a port opens its editor and focuses the field", async ({ page }) => {
  await openSettings(page, "settings-noports");
  await page.keyboard.press("Alt+B");
  await pick(page, "Scanner connection", "Serial port");
  await page.keyboard.press("Alt+B");
  await page.keyboard.press("ControlOrMeta+S");
  await expect(page.getByText("Enter the port, like COM3 or /dev/ttyUSB0")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Port", exact: true })).toBeFocused();
  expect(await calls(page, "saveSettings")).toHaveLength(0);
});

test("an empty list falls back to typing the port and USB printer name", async ({
  page,
}, testInfo) => {
  await openSettings(page, "settings-noports");
  await page.keyboard.press("Alt+E");
  await pick(page, "Connection", "USB");
  await expect(page.getByRole("textbox", { name: "Printer name" })).toBeVisible();
  await expect(
    page.getByText("No printers found. Type the name as Windows lists it."),
  ).toBeVisible();
  await expect(page.getByText("USB printers work on Windows.")).toBeVisible();
  await shoot(page, testInfo, "settings-usb-empty");
  await page.getByRole("textbox", { name: "Printer name" }).fill("Front receipt printer");
  await pick(page, "Connection", "Serial port");
  const port = page.getByRole("textbox", { name: "Port", exact: true });
  await expect(port).toBeVisible();
  await expect(
    page.getByText("No serial ports found. Plug the device in, then refresh."),
  ).toBeVisible();
  await port.fill("/dev/ttyUSB0");
  await expectNoSeriousAxe(page);
  await shoot(page, testInfo, "settings-serial-empty");
  await page.keyboard.press("ControlOrMeta+S");
  await expect(page.getByText("Register settings saved")).toBeVisible();
  expect((await savedCall(page))?.args[0]).toMatchObject({
    printer: { connection: { kind: "serial", path: "/dev/ttyUSB0", baudRate: 9600 } },
  });
});

test("a list the host could not read says so and Refresh asks again", async ({
  page,
}, testInfo) => {
  await openSettings(page, "settings-portsfail");
  await page.keyboard.press("Alt+E");
  await pick(page, "Connection", "Serial port");
  await expect(page.getByText("Could not read the list from this register.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Port", exact: true })).toBeVisible();
  await shoot(page, testInfo, "settings-ports-failed");
  expect(await calls(page, "listPorts")).toHaveLength(1);
  await page.keyboard.press("Alt+N");
  await expect(async () => expect(await calls(page, "listPorts")).toHaveLength(2)).toPass();
  await page.getByRole("button", { name: /^Refresh list/ }).click();
  await expect(async () => expect(await calls(page, "listPorts")).toHaveLength(3)).toPass();
});

test("while the host looks for ports the field is a skeleton, not an empty box", async ({
  page,
}, testInfo) => {
  await openSettings(page, "settings-portsloading");
  await page.keyboard.press("Alt+E");
  await pick(page, "Connection", "Serial port");
  await expect(page.getByRole("status")).toContainText("Looking for port options");
  await expect(page.getByRole("combobox", { name: "Port", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Refresh list/ })).toHaveCount(0);
  await expectNoSeriousAxe(page);
  await shoot(page, testInfo, "settings-ports-loading");
});

test("a saved port the host no longer lists stays selectable and marked", async ({ page }) => {
  await openSettings(page, "settings-serial-gone");
  await page.keyboard.press("Alt+E");
  await expect(page.getByRole("combobox", { name: "Port", exact: true })).toContainText(
    "COM9 · not detected",
  );
  await page.getByRole("combobox", { name: "Port", exact: true }).click();
  await expect(page.getByRole("option")).toHaveText([
    "COM3 · FTDI",
    "COM4 · Prolific",
    "COM5",
    "COM9 · not detected",
  ]);
});

test("without register.settings serial devices are shown but cannot be edited", async ({
  page,
}, testInfo) => {
  await openSettings(page, "settings-serial-readonly");
  await expect(devices(page)).toContainText("Serial · COM3 @ 9600");
  await expect(devices(page)).toContainText("Serial · COM4 @ 19200");
  await expect(devices(page)).toContainText("Pole display · COM5 @ 9600");
  for (const name of [/^Edit printer/, /^Edit scanner/, /^Edit display/])
    await expect(devices(page).getByRole("button", { name })).toBeDisabled();
  await page.keyboard.press("Alt+B");
  await page.keyboard.press("Alt+M");
  await page.keyboard.press("Alt+E");
  await expect(page.getByRole("combobox", { name: "Scanner connection" })).toHaveCount(0);
  expect(await calls(page, "listPorts")).toHaveLength(0);
  await expect(save(page)).toBeDisabled();
  await expectNoSeriousAxe(page);
  await shoot(page, testInfo, "settings-serial-readonly");
});

for (const [width, height, label] of [
  [1366, 768, "till"],
  [768, 1024, "tablet"],
  [390, 844, "mobile"],
] as const) {
  test(`every device editor fits ${label} ${width}×${height} with 44px targets`, async ({
    page,
  }, testInfo) => {
    await openSettings(page, "settings-serial");
    await page.setViewportSize({ width, height });
    await page.keyboard.press("Alt+E");
    await page.keyboard.press("Alt+B");
    await page.keyboard.press("Alt+M");
    await expect(page.getByRole("combobox", { name: "Display connection" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Port", exact: true })).toHaveCount(3);
    await expectNoOverflow(page);
    await expectTouchTargets(page);
    await expectNoSeriousAxe(page);
    await shoot(page, testInfo, `settings-devices-${label}`);
  });
}
