import { expect, test } from "@playwright/test";
import { captureSizes, enrolDevice, unique } from "../../../support/admin";
import {
  createCustomRole,
  createStaff,
  dialog,
  row,
  signInAs,
} from "../../../support/admin/people";
import { ANNEX, BRANCH_NAME, expectNoSeriousAxe, signInWithKeyboard } from "../../../support/e2e";
import { branchIdNamed } from "../../../support/admin/devices";

// Runs on the saved E2E Mart owner session; tills are enrolled through the real two-step API flow.
test.describe("as the owner of E2E Mart", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/devices");
    await expect(page.getByRole("heading", { name: "Devices", level: 1 })).toBeVisible();
  });

  test("lists each device with its branch, status and the date it was added", async ({
    page,
    request,
  }) => {
    const name = `Till ${unique()}`;
    await enrolDevice(request, await branchIdNamed(request, BRANCH_NAME), name);
    await page.reload();
    await expect(row(page, name)).toContainText(BRANCH_NAME);
    await expect(row(page, name)).toContainText("Active");
    await expect(row(page, name)).toContainText(/\d{1,2} \w{3} \d{4}/);
  });

  test("revoking asks first: Escape keeps the device, confirming revokes it", async ({
    page,
    request,
  }) => {
    const name = `Till ${unique()}`;
    await enrolDevice(request, await branchIdNamed(request, BRANCH_NAME), name);
    await page.reload();
    const trigger = page.getByRole("button", { name: `Revoke ${name}` });
    await trigger.click();
    await expect(dialog(page).getByRole("heading", { name: `Revoke ${name}?` })).toBeVisible();
    await expect(dialog(page)).toContainText("can no longer sign in");
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(row(page, name)).toContainText("Active");

    await trigger.click();
    await dialog(page).getByRole("button", { name: "Revoke device" }).click();
    await expect(page.getByText("Device revoked")).toBeVisible();
    await expect(row(page, name)).toContainText("Revoked");
    await expect(page.getByRole("button", { name: `Revoke ${name}` })).toHaveCount(0);
  });

  test("when the server can't be reached the list says so and Try again recovers", async ({
    page,
  }, info) => {
    let failures = 1;
    await page.route("**/api/devices", async (route) =>
      failures-- > 0 ? route.abort("failed") : route.fallback(),
    );
    await page.reload();
    await expect(page.getByText("Can't reach the server")).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "devices-unavailable", async () => {
      await expect(page.getByText("Can't reach the server")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("heading", { name: "Devices", level: 1 })).toBeVisible();
  });

  test("a slow list shows a skeleton shaped like the page", async ({ page }, info) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/devices", async (route) => {
      await gate;
      return route.fallback();
    });
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Devices" })
      .click();
    try {
      const loading = page.getByRole("main").getByRole("status", { name: "Loading" });
      await expect(loading).toBeVisible();
      await captureSizes(page, info, "devices-loading", async () => {
        await expect(loading).toBeVisible();
        await expectNoSeriousAxe(page);
      });
    } finally {
      release();
    }
    await expect(page.getByRole("heading", { name: "Devices", level: 1 })).toBeVisible();
  });

  test("branch lookup errors invite a refresh instead of falsely denying permission", async ({
    page,
  }, info) => {
    await page.route("**/api/branches", (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"busy"}' }),
    );
    await page.reload();
    const message = page.getByText(/branch choices couldn.t load.*refresh/i);
    await expect(message).toBeVisible();
    await expect(page.getByText(/ask an owner to enrol/i)).toHaveCount(0);
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "devices-branch-choices-error", async () => {
      await expect(message).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });

  test("member lookup errors in the PIN sheet invite a refresh, not an owner override", async ({
    page,
  }, info) => {
    await page.route("**/api/users", (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"busy"}' }),
    );
    await page.reload();
    await page.getByRole("button", { name: "Set cashier PIN" }).click();
    const message = dialog(page).getByText(/couldn't load the member list.*refresh/i);
    await expect(message).toBeVisible();
    await expect(dialog(page).getByText(/ask an owner to set the PIN/i)).toHaveCount(0);
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "devices-pin-member-list-error", async () => {
      await expect(message).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });

  test("missing branch and member read permissions are named accurately", async ({
    page,
    request,
  }, info) => {
    const role = await createCustomRole(request, `DeviceOperator${unique()}`, [
      "device.read",
      "device.enroll",
      "cashier.pin.assign",
    ]);
    const operator = await createStaff(request, role.name, "Esi");
    await page.context().clearCookies();
    await signInAs(page, operator);
    await page.goto("/devices");
    await expect(page.getByRole("heading", { name: "Devices", level: 1 })).toBeVisible();
    const branchMessage = page.getByText(/need to be able to see branches.*ask an owner/i);
    await expect(branchMessage).toBeVisible();
    await expect(page.getByText(/branch choices couldn.t load/i)).toHaveCount(0);
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "devices-branch-read-forbidden", async () => {
      await expect(branchMessage).toBeVisible();
      await expectNoSeriousAxe(page);
    });

    await page.getByRole("button", { name: "Set cashier PIN" }).click();
    const memberMessage = dialog(page).getByText(/you can.t see the member list.*ask an owner/i);
    await expect(memberMessage).toBeVisible();
    await expect(dialog(page).getByText(/couldn.t load the member list/i)).toHaveCount(0);
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "devices-member-read-forbidden", async () => {
      await expect(memberMessage).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });

  test("offline disables Revoke device with the reason", async ({
    page,
    request,
    context,
  }, info) => {
    const name = `Till ${unique()}`;
    await enrolDevice(request, await branchIdNamed(request, BRANCH_NAME), name);
    await page.reload();
    await page.getByRole("button", { name: `Revoke ${name}` }).click();
    const confirm = dialog(page).getByRole("button", { name: "Revoke device" });
    await context.setOffline(true);
    await expect(confirm).toBeDisabled();
    await expect(dialog(page)).toContainText(/offline/i);
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "devices-revoke-offline", async () => {
      await expect(confirm).toBeDisabled();
      await expectNoSeriousAxe(page);
    });
    await context.setOffline(false);
  });

  test("the devices page has no serious axe violations and renders at three sizes", async ({
    page,
    request,
  }, info) => {
    await enrolDevice(request, await branchIdNamed(request, BRANCH_NAME), `Till ${unique()}`);
    await page.reload();
    await expect(page.getByRole("row").nth(1)).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "devices", async () => {
      await expect(page.getByRole("heading", { name: "Devices", level: 1 })).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });
});

test.describe("a shop with no devices", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("explains what a device is and tells the owner to add a branch first", async ({
    page,
  }, info) => {
    await signInWithKeyboard(page, ANNEX);
    await page.goto("/devices");
    await expect(page.getByRole("heading", { name: "No devices yet" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to branches" })).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "devices-empty", async () => {
      await expect(page.getByRole("heading", { name: "No devices yet" })).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });
});

test.describe("a member without device.read", () => {
  test("sees no Devices link and gets the no-permission page", async ({ page, request }, info) => {
    const cashier = await createStaff(request, "cashier", "Nana");
    await page.context().clearCookies();
    await signInAs(page, cashier);
    await expect(page.getByRole("link", { name: "Devices" })).toHaveCount(0);
    await page.goto("/devices");
    await expect(
      page.getByRole("heading", { name: "You don't have permission", level: 1 }),
    ).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "devices-no-permission", async () => {
      await expect(
        page.getByRole("heading", { name: "You don't have permission", level: 1 }),
      ).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });
});
