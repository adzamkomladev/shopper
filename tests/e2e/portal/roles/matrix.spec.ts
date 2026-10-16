import { expect, test } from "@playwright/test";
import { captureSizes, unique } from "../../../support/admin";
import {
  createCustomRole,
  createStaff,
  dialog,
  listRoles,
  roleNamed,
  row,
  signInAs,
} from "../../../support/admin/people";
import { BOX_API, expectNoSeriousAxe } from "../../../support/e2e";
import { shopHeaders } from "../../../support/admin";

// Runs on the saved E2E Mart owner session.
test.describe("as the owner of E2E Mart", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/roles");
    await expect(page.getByRole("heading", { name: "Roles", level: 1 })).toBeVisible();
  });

  test("lists the seeded roles with how many permissions each holds", async ({ page }) => {
    await expect(row(page, "Owner")).toContainText("29 of 29");
    await expect(row(page, "cashier")).toContainText("6 of 29");
    await expect(page.getByRole("button", { name: "View permissions for Owner" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit permissions for cashier" })).toBeVisible();
  });

  test("the owner role is read-only: every permission on, nothing editable, no Save", async ({
    page,
  }, info) => {
    await page.getByRole("button", { name: "View permissions for Owner" }).click();
    await expect(dialog(page).getByRole("heading", { name: "Owner role" })).toBeVisible();
    await expect(dialog(page)).toContainText("always has every permission");
    await expect(dialog(page).getByLabel("Name", { exact: true })).toBeDisabled();
    const switches = dialog(page).getByRole("switch");
    await expect(switches).toHaveCount(29);
    for (const toggle of await switches.all()) {
      await expect(toggle).toBeChecked();
      await expect(toggle).toBeDisabled();
    }
    await expect(dialog(page).getByRole("button", { name: "Save role" })).toHaveCount(0);
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "roles-owner-readonly", async () => {
      await expect(dialog(page).getByRole("heading", { name: "Owner role" })).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });

  test("edit a custom role's matrix with the keyboard, and focus returns to its button", async ({
    page,
    request,
  }) => {
    const role = await createCustomRole(request, `Shelf ${unique()}`, ["stock.read"]);
    await page.reload();
    const trigger = page.getByRole("button", { name: `Edit permissions for ${role.name}` });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(dialog(page).getByRole("heading", { name: "Edit role" })).toBeVisible();
    await expect(dialog(page).getByRole("switch", { name: "View stock" })).toBeChecked();
    await dialog(page).getByRole("switch", { name: "Change stock" }).focus();
    await page.keyboard.press("Space");
    await dialog(page).getByRole("switch", { name: "View stock" }).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Role saved")).toBeVisible();
    await expect(dialog(page)).toBeHidden();
    await expect(row(page, role.name)).toContainText("1 of 29");
    await expect(trigger).toBeFocused();
    expect((await roleNamed(request, role.name)).permissionCodes).toEqual(["stock.write"]);
  });

  test("a seeded role's matrix is editable too, and changes persist", async ({ page, request }) => {
    const before = (await roleNamed(request, "accountant")).permissionCodes;
    try {
      await page.getByRole("button", { name: "Edit permissions for accountant" }).click();
      const toggle = dialog(page).getByRole("switch", { name: "View audit log" });
      await expect(toggle).toBeChecked();
      await toggle.click();
      await dialog(page).getByRole("button", { name: "Save role" }).click();
      await expect(page.getByText("Role saved")).toBeVisible();
      const after = (await roleNamed(request, "accountant")).permissionCodes;
      expect(after).toEqual(before.filter((code) => code !== "audit.read"));
    } finally {
      await request.patch(`${BOX_API}/roles/${(await roleNamed(request, "accountant")).id}`, {
        headers: await shopHeaders(request),
        data: { permissionCodes: before },
      });
    }
  });

  test("create a custom role from the keyboard", async ({ page, request }) => {
    const name = `Supervisor ${unique()}`;
    await page.keyboard.press("n");
    await expect(dialog(page).getByRole("heading", { name: "New role" })).toBeVisible();
    await expect(dialog(page).getByLabel("Name", { exact: true })).toBeFocused();
    await page.keyboard.type(name);
    for (const permission of ["View products", "Ring up sales"]) {
      await dialog(page).getByRole("switch", { name: permission }).focus();
      await page.keyboard.press("Space");
    }
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Role created")).toBeVisible();
    await expect(row(page, name)).toContainText("2 of 29");
    expect((await roleNamed(request, name)).permissionCodes.sort()).toEqual([
      "product.read",
      "sale.create",
    ]);
  });

  test("a blank role name is refused on the Name field", async ({ page }) => {
    await page.getByRole("button", { name: "New role" }).click();
    await dialog(page).getByRole("button", { name: "Save role" }).click();
    const field = dialog(page).getByLabel("Name", { exact: true });
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toBeFocused();
  });

  test("the till badge marks which permissions apply on a till", async ({ page }) => {
    await page.getByRole("button", { name: "Edit permissions for cashier" }).click();
    await expect(dialog(page).getByRole("group", { name: "Sales" })).toContainText("Till");
    await expect(dialog(page).getByRole("group", { name: "People" })).not.toContainText("Till");
  });

  test("a slow list shows a skeleton; an unreachable server offers Try again", async ({
    page,
  }, info) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/roles", async (route) => {
      await gate;
      return route.fallback();
    });
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Roles" })
      .click();
    try {
      const loading = page.getByRole("main").getByRole("status", { name: "Loading" });
      await expect(loading).toBeVisible();
      await captureSizes(page, info, "roles-loading", async () => {
        await expect(loading).toBeVisible();
        await expectNoSeriousAxe(page);
      });
    } finally {
      release();
    }
    await expect(page.getByRole("region", { name: "Roles" })).toBeVisible();
    await page.unroute("**/api/roles");
    let unavailable = true;
    await page.route("**/api/roles", (route) =>
      unavailable ? route.abort("failed") : route.fallback(),
    );
    await page.reload();
    await expect(page.getByText("Can't reach the server")).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "roles-unavailable", async () => {
      await expect(page.getByText("Can't reach the server")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    unavailable = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("region", { name: "Roles" })).toBeVisible();
  });

  test("offline disables Save role with the reason", async ({ page, context }, info) => {
    await page.getByRole("button", { name: "Edit permissions for cashier" }).click();
    const save = dialog(page).getByRole("button", { name: "Save role" });
    await context.setOffline(true);
    await expect(save).toBeDisabled();
    await expect(save).toHaveAccessibleDescription(/offline/i);
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "roles-offline", async () => {
      await expect(save).toBeDisabled();
      await expectNoSeriousAxe(page);
    });
    await context.setOffline(false);
  });

  test("the roles page and its matrix have no serious axe violations", async ({ page }, info) => {
    await expect(row(page, "Owner")).toBeVisible();
    await expectNoSeriousAxe(page);
    await page.getByRole("button", { name: "Edit permissions for cashier" }).click();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "roles-matrix", async () => {
      await expect(dialog(page).getByRole("heading", { name: "Edit role" })).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.keyboard.press("Escape");
    await captureSizes(page, info, "roles", async () => {
      await expect(page.getByRole("heading", { name: "Roles", level: 1 })).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });
});

test.describe("an admin, who lacks store, branch and tax-write permissions", () => {
  test("can't grant what they don't hold, and can't edit a role that already does", async ({
    page,
    request,
  }, info) => {
    const admin = await createStaff(request, "admin", "Efua");
    const wide = await createCustomRole(request, `Wide ${unique()}`, ["store.write"]);
    await page.context().clearCookies();
    await signInAs(page, admin);
    await page.goto("/roles");
    await page.getByRole("button", { name: "Edit permissions for cashier" }).click();
    await expect(dialog(page).getByRole("switch", { name: "Change stores" })).toBeDisabled();
    await expect(dialog(page).getByRole("switch", { name: "View products" })).toBeEnabled();
    await expect(dialog(page)).toContainText("permissions you don't have");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: `View permissions for ${wide.name}` }).click();
    await expect(dialog(page)).toContainText("You can't change this role");
    await expect(dialog(page).getByRole("button", { name: "Save role" })).toHaveCount(0);
    await captureSizes(page, info, "roles-admin-ceiling", async () => {
      await expect(dialog(page)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    expect((await listRoles(request)).some((role) => role.id === wide.id)).toBe(true);
  });
});

test.describe("a member without role.read", () => {
  test("sees no Roles link and gets the no-permission page", async ({ page, request }, info) => {
    const cashier = await createStaff(request, "cashier", "Kojo");
    await page.context().clearCookies();
    await signInAs(page, cashier);
    await expect(page.getByRole("link", { name: "Roles" })).toHaveCount(0);
    await page.goto("/roles");
    await expect(
      page.getByRole("heading", { name: "You don't have permission", level: 1 }),
    ).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "roles-no-permission", async () => {
      await expect(
        page.getByRole("heading", { name: "You don't have permission", level: 1 }),
      ).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });
});
