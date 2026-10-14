import { expect, test } from "@playwright/test";
import { captureSizes } from "../../../support/admin";
import {
  chooseByTyping,
  createStaff,
  dialog,
  listUsers,
  row,
  signInAs,
} from "../../../support/admin/people";
import { OWNER_NAME, expectNoSeriousAxe } from "../../../support/e2e";

// Runs on the saved E2E Mart owner session; every member is created through the real invitation flow.
test.describe("as the owner of E2E Mart", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
  });

  test("lists the owner and every member with the role they hold", async ({ page, request }) => {
    const cashier = await createStaff(request, "cashier", "Ama");
    await page.reload();
    await expect(row(page, OWNER_NAME)).toContainText("Owner");
    await expect(row(page, cashier.name)).toContainText("cashier");
    await expect(row(page, cashier.name)).toContainText(cashier.email);
  });

  test("change a member's role with the keyboard, and focus returns to the button", async ({
    page,
    request,
  }) => {
    const member = await createStaff(request, "cashier", "Kofi");
    await page.reload();
    const trigger = page.getByRole("button", { name: `Change role for ${member.name}` });
    const members = page.getByRole("region", { name: "Members" });
    await members.focus();
    await page.keyboard.press("End");
    await expect(trigger).toBeVisible();
    await expect(trigger).toBeEnabled();
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog(page).getByRole("heading", { name: "Change role" })).toBeVisible();
    await chooseByTyping(page, dialog(page).getByRole("combobox", { name: "Role" }), "acc");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Role updated")).toBeVisible();
    await expect(dialog(page)).toBeHidden();
    await expect(row(page, member.name)).toContainText("accountant");
    await expect(trigger).toBeFocused();
    expect((await listUsers(request)).find((user) => user.id === member.userId)?.roleName).toBe(
      "accountant",
    );
  });

  test("the last owner can't be demoted, and the sheet says why", async ({ page }) => {
    await page.getByRole("button", { name: `Change role for ${OWNER_NAME}` }).click();
    await chooseByTyping(page, dialog(page).getByRole("combobox", { name: "Role" }), "cash");
    await dialog(page).getByRole("button", { name: "Save role" }).click();
    await expect(dialog(page).getByRole("alert")).toContainText("last owner");
    await expect(dialog(page)).toBeVisible();
  });

  test("the change-role sheet starts on the role the member holds now", async ({
    page,
    request,
  }) => {
    const member = await createStaff(request, "cashier", "Esi");
    await page.reload();
    await page.getByRole("button", { name: `Change role for ${member.name}` }).click();
    await expect(dialog(page).getByRole("combobox", { name: "Role" })).toContainText("cashier");
  });

  test("when the server can't be reached the list says so and Try again recovers", async ({
    page,
  }, info) => {
    let failures = 1;
    await page.route("**/api/users", async (route) => {
      if (failures-- > 0) return route.abort("failed");
      return route.fallback();
    });
    await page.reload();
    await expect(page.getByText("Can't reach the server")).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "users-unavailable", async () => {
      await expect(page.getByText("Can't reach the server")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("region", { name: "Members" })).toBeVisible();
  });

  test("a slow list shows a skeleton shaped like the page", async ({ page }, info) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/users", async (route) => {
      await gate;
      return route.fallback();
    });
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Users" })
      .click();
    try {
      const loading = page.getByRole("main").getByRole("status", { name: "Loading" });
      await expect(loading).toBeVisible();
      await captureSizes(page, info, "users-loading", async () => {
        await expect(loading).toBeVisible();
        await expectNoSeriousAxe(page);
      });
    } finally {
      release();
    }
    await expect(page.getByRole("region", { name: "Members" })).toBeVisible();
  });

  test("offline shows the banner and Save role is disabled with the reason", async ({
    page,
    context,
  }, info) => {
    await page.getByRole("button", { name: `Change role for ${OWNER_NAME}` }).click();
    const save = dialog(page).getByRole("button", { name: "Save role" });
    await context.setOffline(true);
    await expect(page.getByText(/offline/i).first()).toBeVisible();
    await expect(save).toBeDisabled();
    await expect(save).toHaveAccessibleDescription(/offline/i);
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "users-role-offline", async () => {
      await expect(save).toBeDisabled();
      await expectNoSeriousAxe(page);
    });
    await context.setOffline(false);
    await expect(save).toBeEnabled();
  });

  test("the users page has no serious axe violations and renders at three sizes", async ({
    page,
  }, info) => {
    await expect(row(page, OWNER_NAME)).toBeVisible();
    await expectNoSeriousAxe(page);
    await page.getByRole("button", { name: `Change role for ${OWNER_NAME}` }).click();
    await expectNoSeriousAxe(page);
    await page.keyboard.press("Escape");
    await captureSizes(page, info, "users", async () => {
      await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });
});

test.describe("a member without user.read", () => {
  test("sees no Users link and gets the no-permission page", async ({ page, request }, info) => {
    const cashier = await createStaff(request, "cashier", "Yaw");
    await page.context().clearCookies();
    await signInAs(page, cashier);
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
    await page.goto("/users");
    await expect(
      page.getByRole("heading", { name: "You don't have permission", level: 1 }),
    ).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "users-no-permission", async () => {
      await expect(
        page.getByRole("heading", { name: "You don't have permission", level: 1 }),
      ).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });
});
