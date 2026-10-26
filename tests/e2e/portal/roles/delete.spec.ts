import { expect, test } from "@playwright/test";
import { captureSizes, unique } from "../../../support/admin";
import {
  createCustomRole,
  createStaff,
  dialog,
  listRoles,
  row,
} from "../../../support/admin/people";
import { expectNoSeriousAxe } from "../../../support/e2e";

// Runs on the saved E2E Mart owner session.
test.describe("as the owner of E2E Mart", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/roles");
    await expect(page.getByRole("heading", { name: "Roles", level: 1 })).toBeVisible();
  });

  test("an unused role is deleted from its sheet by keyboard, after a confirmation", async ({
    page,
    request,
  }, info) => {
    const role = await createCustomRole(request, `Spare ${unique()}`, ["stock.read"]);
    await page.reload();
    await expect(row(page, role.name)).toContainText("0 members");
    await page.getByRole("button", { name: `Edit permissions for ${role.name}` }).click();
    await page.keyboard.press("ControlOrMeta+Shift+Backspace");
    const confirm = page.getByRole("dialog", { name: `Delete ${role.name}?` });
    await expect(confirm).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "roles-delete-confirm", async () => {
      await expect(confirm).toBeVisible();
    });
    await confirm.getByRole("button", { name: "Delete role" }).click();
    await expect(page.getByText("Role deleted")).toBeVisible();
    await expect(row(page, role.name)).toHaveCount(0);
    expect((await listRoles(request)).some((entry) => entry.id === role.id)).toBe(false);
  });

  test("a role someone holds can't be deleted, and the sheet says who holds it", async ({
    page,
    request,
  }) => {
    const role = await createCustomRole(request, `Held ${unique()}`, ["stock.read"]);
    await createStaff(request, role.name, "Kwesi");
    await page.reload();
    await expect(row(page, role.name)).toContainText("1 member");
    await page.getByRole("button", { name: `Edit permissions for ${role.name}` }).click();
    const remove = dialog(page).getByRole("button", { name: "Delete role" });
    await expect(remove).toBeDisabled();
    await expect(remove).toHaveAccessibleDescription(/1 member holds it/);
  });

  test("the owner role offers no delete", async ({ page }) => {
    await page.getByRole("button", { name: "View permissions for Owner" }).click();
    await expect(dialog(page).getByRole("button", { name: "Delete role" })).toHaveCount(0);
  });

  test("a group switches on at once, and the filter narrows the list", async ({ page }, info) => {
    await page.getByRole("button", { name: "New role" }).click();
    const stock = dialog(page).getByRole("checkbox", {
      name: "Every Products and stock permission",
    });
    await stock.check();
    for (const toggle of await dialog(page)
      .getByRole("group", { name: "Products and stock" })
      .getByRole("switch")
      .all())
      await expect(toggle).toBeChecked();
    await dialog(page).getByRole("switch", { name: "View stock" }).click();
    await expect(stock).toHaveAttribute("aria-checked", "mixed");
    await dialog(page).getByRole("searchbox", { name: "Filter permissions" }).fill("refund");
    await expect(dialog(page).getByRole("group", { name: "Products and stock" })).toHaveCount(0);
    await expect(dialog(page).getByRole("switch").first()).toBeVisible();
    for (const label of await dialog(page).getByRole("switch").all())
      await expect(label).toHaveAccessibleName(/refund/i);
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "roles-filter", async () => {
      await expect(dialog(page)).toBeVisible();
    });
  });
});
