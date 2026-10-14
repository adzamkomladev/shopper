import { expect, test } from "@playwright/test";
import { captureSizes, enrolDevice, unique } from "../../../support/admin";
import { chooseByTyping, createStaff, dialog, row } from "../../../support/admin/people";
import { BRANCH_NAME, expectNoSeriousAxe } from "../../../support/e2e";
import {
  branchIdNamed,
  cashierLogin,
  listDevices,
  redeemCode,
} from "../../../support/admin/devices";

const DIGITS = /^\d{3} \d{3}$/;

// Runs on the saved E2E Mart owner session.
test.beforeEach(async ({ page }) => {
  await page.goto("/devices");
  await expect(page.getByRole("heading", { name: "Devices", level: 1 })).toBeVisible();
});

test("enrol a device from the keyboard: the code shown is real and the new till appears", async ({
  page,
  request,
}) => {
  const enrol = page.getByRole("button", { name: "Enrol device" });
  await expect(enrol).toBeVisible();
  await enrol.focus();
  await page.keyboard.press("n");
  await expect(dialog(page).getByRole("heading", { name: "Enrol a device" })).toBeVisible();
  await chooseByTyping(page, dialog(page).getByRole("combobox", { name: "Branch" }), "Accra");
  await page.keyboard.press("ControlOrMeta+Enter");
  const code = dialog(page).getByRole("status", { name: "Enrolment code" });
  await expect(code).toHaveText(DIGITS);
  await expect(dialog(page)).toContainText(/enter this code on the till/i);
  await expect(dialog(page)).toContainText(/expires/i);
  await expect(dialog(page).getByRole("button", { name: "Done" })).toBeFocused();

  const till = `Counter ${unique()}`;
  const redeemed = await redeemCode(request, (await code.innerText()).replace(" ", ""), till);
  expect(redeemed.status(), await redeemed.text()).toBe(201);
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Enrol device" })).toBeFocused();
  await page.reload();
  await expect(row(page, till)).toContainText(BRANCH_NAME);
  expect((await listDevices(request)).some((device) => device.name === till)).toBe(true);
});

test("a branch must be chosen before a code is made", async ({ page }) => {
  await page.getByRole("button", { name: "Enrol device" }).click();
  await dialog(page).getByRole("button", { name: "Create code" }).click();
  const field = dialog(page).getByRole("combobox", { name: "Branch" });
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(dialog(page)).toContainText("Choose a branch");
});

test("offline disables Create code with the reason", async ({ page, context }, info) => {
  await page.getByRole("button", { name: "Enrol device" }).click();
  const create = dialog(page).getByRole("button", { name: "Create code" });
  await context.setOffline(true);
  await expect(create).toBeDisabled();
  await expect(create).toHaveAccessibleDescription(/offline/i);
  await expectNoSeriousAxe(page);
  await captureSizes(page, info, "devices-enrol-offline", async () => {
    await expect(create).toBeDisabled();
    await expectNoSeriousAxe(page);
  });
  await context.setOffline(false);
});

test("the enrol sheet and the code view have no serious axe violations", async ({ page }, info) => {
  await page.getByRole("button", { name: "Enrol device" }).click();
  await expectNoSeriousAxe(page);
  await captureSizes(page, info, "devices-enrol-form", async () => {
    await expect(dialog(page).getByRole("combobox", { name: "Branch" })).toBeVisible();
    await expectNoSeriousAxe(page);
  });
  await dialog(page).getByRole("combobox", { name: "Branch" }).click();
  await page.getByRole("option", { name: new RegExp(BRANCH_NAME) }).click();
  await dialog(page).getByRole("button", { name: "Create code" }).click();
  await expect(dialog(page).getByRole("status", { name: "Enrolment code" })).toHaveText(DIGITS);
  await expectNoSeriousAxe(page);
  await captureSizes(page, info, "devices-enrol-code", async () => {
    await expect(dialog(page).getByRole("status", { name: "Enrolment code" })).toBeVisible();
    await expectNoSeriousAxe(page);
  });
});

test.describe("cashier PIN", () => {
  test("a reflected PIN in a non-JSON failure stays out of console logs", async ({
    page,
    request,
  }) => {
    const cashier = await createStaff(request, "cashier", "Abena");
    await page.reload();
    const setPin = page.getByRole("button", { name: "Set cashier PIN" });
    await expect(setPin).toBeVisible();
    await expect(setPin).toBeEnabled();
    const pin = "72469381";
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.route("**/api/cashiers/pin", (route) =>
      route.fulfill({
        status: 502,
        contentType: "text/plain",
        body: `upstream rejected PIN ${pin}`,
      }),
    );
    await setPin.click();
    await chooseByTyping(
      page,
      dialog(page).getByRole("combobox", { name: "Cashier" }),
      cashier.name,
    );
    const pinField = dialog(page).getByLabel("PIN", { exact: true });
    await pinField.fill(pin);
    await dialog(page).getByRole("button", { name: "Save PIN" }).click();
    const alert = dialog(page).getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).not.toContainText(pin);
    await expect.poll(() => consoleMessages.join("\n")).toContain("Response details withheld");
    expect(consoleMessages.join("\n")).not.toContain(pin);
    await pinField.fill("72469382");
    await expect(alert).toHaveCount(0);
  });

  test("a reflected PIN in a JSON error is redacted in the recoverable alert", async ({
    page,
    request,
  }) => {
    const cashier = await createStaff(request, "cashier", "Adwoa");
    await page.reload();
    const setPin = page.getByRole("button", { name: "Set cashier PIN" });
    await expect(setPin).toBeVisible();
    await expect(setPin).toBeEnabled();
    const pin = "72469381";
    await page.route("**/api/cashiers/pin", (route) =>
      route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: `PIN ${pin} was rejected` }),
      }),
    );
    await setPin.click();
    await chooseByTyping(
      page,
      dialog(page).getByRole("combobox", { name: "Cashier" }),
      cashier.name,
    );
    const pinField = dialog(page).getByLabel("PIN", { exact: true });
    await pinField.fill(pin);
    await dialog(page).getByRole("button", { name: "Save PIN" }).click();
    const alert = dialog(page).getByRole("alert");
    await expect(alert).toContainText("PIN [redacted] was rejected");
    await expect(alert).not.toContainText(pin);
    await expect(dialog(page)).toBeVisible();
    await pinField.fill("72469382");
    await expect(alert).toHaveCount(0);
  });

  test("set a PIN from the keyboard and the cashier can sign in on a till with it", async ({
    page,
    request,
  }) => {
    const cashier = await createStaff(request, "cashier", "Akos");
    const till = (await enrolDevice(
      request,
      await branchIdNamed(request, BRANCH_NAME),
      `Till ${unique()}`,
    )) as { deviceId: string; deviceToken: string };
    await page.reload();
    const setPin = page.getByRole("button", { name: "Set cashier PIN" });
    await expect(setPin).toBeEnabled();
    await setPin.focus();
    await expect(setPin).toBeFocused();
    await page.keyboard.press("p");
    await expect(dialog(page).getByRole("heading", { name: "Set cashier PIN" })).toBeVisible();
    await chooseByTyping(
      page,
      dialog(page).getByRole("combobox", { name: "Cashier" }),
      cashier.name,
    );
    await page.keyboard.press("Tab");
    await page.keyboard.type("482913");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText(`PIN saved for ${cashier.name}`)).toBeVisible();
    await expect(dialog(page)).toBeHidden();
    await expect(page.getByRole("button", { name: "Set cashier PIN" })).toBeFocused();
    expect((await cashierLogin(request, till, cashier.userId, "482913")).status()).toBe(200);
    expect(
      (await cashierLogin(request, till, cashier.userId, "111111")).status(),
    ).toBeGreaterThanOrEqual(400);
  });

  test("a PIN needs 4 to 8 digits and the PIN field says so", async ({ page }) => {
    await page.getByRole("button", { name: "Set cashier PIN" }).click();
    await dialog(page).getByLabel("PIN", { exact: true }).fill("12");
    await dialog(page).getByRole("button", { name: "Save PIN" }).click();
    const field = dialog(page).getByLabel("PIN", { exact: true });
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(dialog(page)).toContainText("4 to 8 digits");
  });

  test("offline disables Save PIN with the reason", async ({ page, context }, info) => {
    await page.getByRole("button", { name: "Set cashier PIN" }).click();
    const save = dialog(page).getByRole("button", { name: "Save PIN" });
    await context.setOffline(true);
    await expect(save).toBeDisabled();
    await expect(save).toHaveAccessibleDescription(/offline/i);
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "devices-pin-offline", async () => {
      await expect(save).toBeDisabled();
      await expectNoSeriousAxe(page);
    });
    await context.setOffline(false);
  });

  test("the PIN sheet has no serious axe violations", async ({ page }, info) => {
    await page.getByRole("button", { name: "Set cashier PIN" }).click();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "devices-pin", async () => {
      await expect(dialog(page).getByRole("heading", { name: "Set cashier PIN" })).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });
});
