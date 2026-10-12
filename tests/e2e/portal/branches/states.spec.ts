import { expect, test } from "@playwright/test";
import { captureSizes, unique } from "../../../support/admin";
import { createCustomRole, createStaff, signInAs } from "../../../support/admin-people";
import { expectNoSeriousAxe } from "../../../support/e2e";

test.describe("branch route states", () => {
  test("shows a loading skeleton before the branch list arrives", async ({ page }, info) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
    let releaseLoading!: () => void;
    const loadingGate = new Promise<void>((resolve) => {
      releaseLoading = resolve;
    });
    await page.route("**/api/branches", async (route) => {
      await loadingGate;
      await route.fallback();
    });
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Branches" })
      .click();
    await expect(page.getByRole("status", { name: "Loading branches" })).toBeVisible();
    await captureSizes(page, info, "branches-loading", async () => {
      await expect(page.getByRole("status", { name: "Loading branches" })).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    releaseLoading();
    await expect(page.getByRole("region", { name: "Branches" })).toBeVisible();
  });

  test("an unreachable branch list says what happened and can recover", async ({ page }, info) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
    let holdFailure = true;
    await page.route("**/api/branches", async (route) => {
      if (holdFailure) return route.abort("failed");
      return route.fallback();
    });
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Branches" })
      .click();
    await expect(page.getByText("Can't reach the server")).toBeVisible();
    await captureSizes(page, info, "branches-error", async () => {
      await expect(page.getByText("Can't reach the server")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    holdFailure = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("region", { name: "Branches" })).toBeVisible();
  });

  test("shows a permission message for a member without branch access", async ({
    page,
    request,
  }, info) => {
    const role = await createCustomRole(request, `No branch access ${unique()}`, []);
    const staff = await createStaff(request, role.name, "NoBranchAccess");
    await signInAs(page, staff);
    await page.goto("/branches");
    await expect(page.getByRole("heading", { name: "You don't have permission" })).toBeVisible();
    await captureSizes(page, info, "branches-no-permission", async () => {
      await expect(page.getByRole("heading", { name: "You don't have permission" })).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });
});
