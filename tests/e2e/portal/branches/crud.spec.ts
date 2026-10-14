import { expect, test, type Page } from "@playwright/test";
import {
  captureSizes,
  createBranch,
  createStore,
  enrolDevice,
  unique,
} from "../../../support/admin";
import { createCustomRole, createStaff, signInAs } from "../../../support/admin/people";
import { ANNEX, expectNoSeriousAxe, signInWithKeyboard } from "../../../support/e2e";

const dialog = (page: Page) => page.getByRole("dialog");
const row = (page: Page, name: string) => page.getByRole("row").filter({ hasText: name });

test.describe("as the owner of E2E Mart", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/branches");
    // The first lazy route includes cold dev-server compilation before it can render.
    await expect(page.getByRole("heading", { name: "Branches", level: 1 })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("add a branch with the keyboard, pick its store, and see it listed under that store", async ({
    page,
    request,
  }) => {
    const tag = unique();
    const store = await createStore(request, `Store ${tag}`);
    await page.reload();
    const name = `Osu ${tag}`;
    const add = page.getByRole("button", { name: "Add branch" });
    await expect(add).toBeEnabled();
    await add.focus();
    await expect(add).toBeFocused();
    await page.keyboard.press("n");
    await expect(dialog(page).getByLabel("Name", { exact: true })).toBeFocused();
    await page.keyboard.type(name);
    await page.keyboard.press("Tab");
    await expect(dialog(page).getByRole("combobox", { name: "Store" })).toBeFocused();
    await page.keyboard.press("Enter");
    await page.getByRole("option", { name: store.name }).click();
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Branch added")).toBeVisible();
    await expect(row(page, name)).toContainText(store.name);
    await expect(page.getByRole("button", { name: "Add branch" })).toBeFocused();
  });

  test("edit a branch to move it to another store", async ({ page, request }) => {
    const tag = unique();
    const from = await createStore(request, `From ${tag}`);
    const to = await createStore(request, `To ${tag}`);
    const branch = await createBranch(request, `Madina ${tag}`, from.id);
    await page.reload();
    await page.getByRole("button", { name: `Edit ${branch.name}` }).click();
    await dialog(page).getByRole("combobox", { name: "Store" }).click();
    await page.getByRole("option", { name: to.name }).click();
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Branch saved")).toBeVisible();
    await expect(row(page, branch.name)).toContainText(to.name);
  });

  test("an unused branch is deleted after confirming; Escape keeps it and returns focus", async ({
    page,
    request,
  }) => {
    const store = await createStore(request, `Store ${unique()}`);
    const branch = await createBranch(request, `Spintex ${unique()}`, store.id);
    await page.reload();
    const trigger = page.getByRole("button", { name: `Delete ${branch.name}` });
    await trigger.click();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await trigger.click();
    await dialog(page).getByRole("button", { name: "Delete branch" }).click();
    await expect(page.getByText("Branch deleted")).toBeVisible();
    await expect(row(page, branch.name)).toHaveCount(0);
  });

  test("a branch with tills is refused by the server and the dialog explains", async ({
    page,
    request,
  }) => {
    const tag = unique();
    const store = await createStore(request, `Store ${tag}`);
    const branch = await createBranch(request, `Kaneshie ${tag}`, store.id);
    await enrolDevice(request, branch.id, `Till ${tag}`);
    await page.reload();
    await page.getByRole("button", { name: `Delete ${branch.name}` }).click();
    await dialog(page).getByRole("button", { name: "Delete branch" }).click();
    await expect(dialog(page).getByRole("alert")).toContainText(/still used|in use|referenced/i);
    await page.keyboard.press("Escape");
    await expect(row(page, branch.name)).toBeVisible();
  });

  test("offline disables Save branch and explains why", async ({
    page,
    request,
    context,
  }, info) => {
    await createStore(request, `Offline store ${unique()}`);
    await page.reload();
    await page.getByRole("button", { name: "Add branch" }).click();
    await dialog(page).getByLabel("Name", { exact: true }).fill("Offline branch");
    const save = dialog(page).getByRole("button", { name: "Save branch" });
    await context.setOffline(true);
    await expect(page.getByText(/offline/i).first()).toBeVisible();
    await expect(save).toBeDisabled();
    await expect(save).toHaveAccessibleDescription(/offline/i);
    await captureSizes(page, info, "branches-offline", async () => {
      await expect(save).toBeDisabled();
      await expectNoSeriousAxe(page);
    });
    await context.setOffline(false);
  });

  test("the branches list has no serious axe violations and renders at three sizes", async ({
    page,
    request,
  }, info) => {
    const store = await createStore(request, `Axe store ${unique()}`);
    await createBranch(request, `Axe branch ${unique()}`, store.id);
    await page.reload();
    await expect(page.getByRole("row").nth(1)).toBeVisible();
    await expectNoSeriousAxe(page);
    await page.getByRole("button", { name: "Add branch" }).click();
    await expectNoSeriousAxe(page);
    await page.keyboard.press("Escape");
    await captureSizes(page, info, "branches", async () => {
      await expect(page.getByRole("heading", { name: "Branches", level: 1 })).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });
});

test.describe("a shop with no stores", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("asks for a store before the first branch", async ({ page }, info) => {
    await signInWithKeyboard(page, ANNEX);
    await page.goto("/branches");
    await expect(page.getByRole("heading", { name: "Add a store first" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to stores" })).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "branches-empty", async () => {
      await expect(page.getByRole("heading", { name: "Add a store first" })).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });
});

test.describe("a branch reader without store.read or branch.write", () => {
  test("can list branches without store context, and cannot open write actions", async ({
    page,
    request,
  }, info) => {
    const tag = unique();
    const store = await createStore(request, `Hidden store ${tag}`);
    const branch = await createBranch(request, `Visible branch ${tag}`, store.id);
    const role = await createCustomRole(request, `Branch reader ${tag}`, ["branch.read"]);
    const staff = await createStaff(request, role.name, "BranchReader");

    await signInAs(page, staff);
    await page.goto("/branches");
    await expect(page.getByRole("heading", { name: "Branches", level: 1 })).toBeVisible();
    await expect(row(page, branch.name)).toBeVisible();
    await expect(row(page, branch.name)).toContainText("Unknown store");
    await expect(page.getByRole("button", { name: "Add branch" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Edit ${branch.name}` })).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Delete ${branch.name}` })).toHaveCount(0);
    await expect(page.getByRole("note")).toContainText(/view branches/i);
    await page.keyboard.press("n");
    await expect(dialog(page)).toHaveCount(0);
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "branches-read-only", async () => {
      await expect(row(page, branch.name)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });
});

test.describe("a branch writer without store.read", () => {
  test("can delete an unused branch without loading the store selector", async ({
    page,
    request,
  }) => {
    const tag = unique();
    const store = await createStore(request, `Hidden store ${tag}`);
    const branch = await createBranch(request, `Deletable branch ${tag}`, store.id);
    const role = await createCustomRole(request, `Branch writer ${tag}`, [
      "branch.read",
      "branch.write",
    ]);
    const staff = await createStaff(request, role.name, "BranchWriter");

    await signInAs(page, staff);
    await page.goto("/branches");
    await expect(row(page, branch.name)).toBeVisible();
    const remove = page.getByRole("button", { name: `Delete ${branch.name}` });
    await expect(remove).toBeVisible();
    await remove.click();
    await dialog(page).getByRole("button", { name: "Delete branch" }).click();
    await expect(page.getByText("Branch deleted")).toBeVisible();
    await expect(row(page, branch.name)).toHaveCount(0);
  });
});
