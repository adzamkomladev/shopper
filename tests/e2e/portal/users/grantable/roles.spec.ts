import { expect, test } from "@playwright/test";
import { captureSizes, unique } from "../../../../support/admin";
import {
  allPermissionCodes,
  createCustomRole,
  createStaff,
  dialog,
  signInAs,
} from "../../../../support/admin/people";
import { expectNoSeriousAxe } from "../../../../support/e2e";

test.describe("role choices respect the signed-in member's grant policy", () => {
  test("invite and role-change forms hide roles above the permission ceiling", async ({
    page,
    request,
  }) => {
    const wide = await createCustomRole(request, `Wide${unique()}`, ["store.write"]);
    const manager = await createStaff(request, "admin", "Manager");
    const member = await createStaff(request, "cashier", "Cashier");
    await page.context().clearCookies();
    await signInAs(page, manager);
    await page.goto("/users");
    const invite = page.getByRole("button", { name: "Invite user" });
    await expect(invite).toBeVisible();

    await invite.click();
    await dialog(page).getByRole("combobox", { name: "Role" }).click();
    await expect(page.getByRole("option", { name: "Owner", exact: true })).toHaveCount(0);
    await expect(page.getByRole("option", { name: wide.name, exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("button", { name: `Edit access for ${member.name}` }).click();
    await dialog(page).getByRole("combobox", { name: "Role" }).click();
    await expect(page.getByRole("option", { name: "Owner", exact: true })).toHaveCount(0);
    await expect(page.getByRole("option", { name: wide.name, exact: true })).toHaveCount(0);
  });

  test("a non-owner with every permission still can't grant the protected owner role", async ({
    page,
    request,
  }) => {
    const fullRole = await createCustomRole(
      request,
      `Full${unique()}`,
      await allPermissionCodes(request),
    );
    const manager = await createStaff(request, fullRole.name, "Grantor");
    const member = await createStaff(request, "cashier", "Target");
    await page.context().clearCookies();
    await signInAs(page, manager);
    await page.goto("/users");
    const invite = page.getByRole("button", { name: "Invite user" });
    await expect(invite).toBeVisible();

    await invite.click();
    await dialog(page).getByRole("combobox", { name: "Role" }).click();
    await expect(page.getByRole("option", { name: "Owner", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();

    const members = page.getByRole("region", { name: "Members" });
    await members.focus();
    await page.keyboard.press("End");
    await page.getByRole("button", { name: `Edit access for ${member.name}` }).click();
    await dialog(page).getByRole("combobox", { name: "Role" }).click();
    await expect(page.getByRole("option", { name: "Owner", exact: true })).toHaveCount(0);
  });
});

test.describe("role choices are optional context on the users page", () => {
  test("a role writer sees loading feedback while the role list is still pending", async ({
    page,
  }, info) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/roles", async (route) => {
      await gate;
      return route.fallback();
    });
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
    try {
      const loading = page.getByText("Loading role choices…");
      await expect(loading).toBeVisible();
      await expect(page.getByText(/you can see who has access/i)).toHaveCount(0);
      await expectNoSeriousAxe(page);
      await captureSizes(page, info, "users-role-choices-loading", async () => {
        await expect(loading).toBeVisible();
        await expectNoSeriousAxe(page);
      });
    } finally {
      release();
    }
    await expect(page.getByRole("button", { name: "Invite user" })).toBeVisible();
  });
});

test.describe("a role writer who cannot read the role list", () => {
  test("explains why role actions are unavailable without denying role-write access", async ({
    page,
    request,
  }, info) => {
    const role = await createCustomRole(request, `RoleWriter${unique()}`, [
      "user.read",
      "user.write",
      "role.write",
    ]);
    const manager = await createStaff(request, role.name, "Rolewriter");
    await page.context().clearCookies();
    await signInAs(page, manager);
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Invite user" })).toHaveCount(0);
    await expect(page.getByText(/role choices.*role list/i)).toBeVisible();
    await expect(page.getByText(/changing roles.*needs the role permission/i)).toHaveCount(0);
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "users-role-list-forbidden", async () => {
      await expect(page.getByText(/role choices.*role list/i)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });
});
