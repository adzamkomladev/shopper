import { expect, test, type Page } from "@playwright/test";
import { createBranch, createStore, captureSizes, unique } from "../../support/admin";
import { createCustomRole, createStaff, signInAs } from "../../support/admin-people";
import { ANNEX, expectNoSeriousAxe, signInWithKeyboard } from "../../support/e2e";

// Runs on the saved owner session. Every test names its stores with a tag that is new each run.
const dialog = (page: Page) => page.getByRole("dialog");
const row = (page: Page, name: string) => page.getByRole("row").filter({ hasText: name });
const waitForBranches = (page: Page) =>
  page.waitForResponse(
    (response) => response.url().includes("/api/branches") && response.request().method() === "GET",
  );

test.describe("as the owner of E2E Mart", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/stores");
    await expect(page.getByRole("heading", { name: "Stores", level: 1 })).toBeVisible();
  });

  test("add a store with the keyboard alone, and focus returns to Add store", async ({ page }) => {
    const name = `Kumasi ${unique()}`;
    await page.keyboard.press("n");
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).getByLabel("Name", { exact: true })).toBeFocused();
    await page.keyboard.type(name);
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Store added")).toBeVisible();
    await expect(dialog(page)).toBeHidden();
    await expect(row(page, name)).toBeVisible();
    await expect(page.getByRole("button", { name: "Add store" })).toBeFocused();
  });

  test("a blank name is refused on the Name field", async ({ page }) => {
    await page.getByRole("button", { name: "Add store" }).click();
    await dialog(page).getByRole("button", { name: "Save store" }).click();
    const field = dialog(page).getByLabel("Name", { exact: true });
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveAccessibleDescription(/\S/);
    await expect(field).toBeFocused();
  });

  test("edit a store's name and cash rounding", async ({ page, request }) => {
    const tag = unique();
    const store = await createStore(request, `Takoradi ${tag}`);
    await page.reload();
    await page.getByRole("button", { name: `Edit ${store.name}` }).click();
    await expect(dialog(page).getByRole("heading", { name: "Edit store" })).toBeVisible();
    await dialog(page).getByLabel("Name", { exact: true }).fill(`Tema ${tag}`);
    await dialog(page).getByLabel("Cash rounding (GH₵)").fill("0.05");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Store saved")).toBeVisible();
    await expect(row(page, `Tema ${tag}`)).toContainText("GH₵ 0.05");
    await expect(page.getByRole("button", { name: `Edit Tema ${tag}` })).toBeFocused();
  });

  test("deleting asks first: Escape keeps the store and returns focus, confirming removes it", async ({
    page,
    request,
  }) => {
    const store = await createStore(request, `Ho ${unique()}`);
    await page.reload();
    const trigger = page.getByRole("button", { name: `Delete ${store.name}` });
    await trigger.click();
    await expect(
      dialog(page).getByRole("heading", { name: `Delete ${store.name}?` }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(row(page, store.name)).toBeVisible();

    await trigger.click();
    await dialog(page).getByRole("button", { name: "Delete store" }).click();
    await expect(page.getByText("Store deleted")).toBeVisible();
    await expect(row(page, store.name)).toHaveCount(0);
  });

  test("a store that still has branches can't be deleted, and the dialog says why", async ({
    page,
    request,
  }) => {
    const tag = unique();
    const store = await createStore(request, `Cape Coast ${tag}`);
    await createBranch(request, `Castle Road ${tag}`, store.id);
    await page.reload();
    await page.getByRole("button", { name: `Delete ${store.name}` }).click();
    await expect(dialog(page)).toContainText("1 branch");
    const confirm = dialog(page).getByRole("button", { name: "Delete store" });
    await expect(confirm).toBeDisabled();
    await expect(confirm).toHaveAccessibleDescription(/branch/i);
  });

  test("when the server can't be reached the list says so and Try again recovers", async ({
    page,
  }, info) => {
    let failures = 1;
    await page.route("**/api/stores", async (route) => {
      if (failures-- > 0) return route.abort("failed");
      return route.fallback();
    });
    await page.reload();
    await expect(page.getByText("Can't reach the server")).toBeVisible();
    await captureSizes(page, info, "stores-error", async () => {
      await expect(page.getByText("Can't reach the server")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("region", { name: "Stores" })).toBeVisible();
  });

  test("offline shows the banner and Save is disabled with the reason", async ({
    page,
    context,
  }, info) => {
    await page.getByRole("button", { name: "Add store" }).click();
    await dialog(page).getByLabel("Name", { exact: true }).fill("Offline store");
    const save = dialog(page).getByRole("button", { name: "Save store" });
    await expect(save).toBeEnabled();
    await context.setOffline(true);
    await expect(page.getByText(/offline/i).first()).toBeVisible();
    await expect(save).toBeDisabled();
    await expect(save).toHaveAccessibleDescription(/offline/i);
    await captureSizes(page, info, "stores-offline", async () => {
      await expect(save).toBeDisabled();
      await expectNoSeriousAxe(page);
    });
    await context.setOffline(false);
    await expect(save).toBeEnabled();
  });

  test("the stores list has no serious axe violations and renders at three sizes", async ({
    page,
    request,
  }, info) => {
    await createStore(request, `Axe ${unique()}`);
    const branchesLoaded = waitForBranches(page);
    await page.reload();
    await branchesLoaded;
    await expect(page.getByRole("row").nth(1)).toBeVisible();
    await expectNoSeriousAxe(page);
    await page.getByRole("button", { name: "Add store" }).click();
    await expectNoSeriousAxe(page);
    await page.keyboard.press("Escape");
    await captureSizes(page, info, "stores", async () => {
      await expect(page.getByRole("heading", { name: "Stores", level: 1 })).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });
});

test.describe("a shop with no stores", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("offers to add the first store", async ({ page }, info) => {
    await signInWithKeyboard(page, ANNEX);
    const branchesLoaded = waitForBranches(page);
    await page.goto("/stores");
    await branchesLoaded;
    await expect(page.getByRole("heading", { name: "No stores yet" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add store" })).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "stores-empty", async () => {
      await expect(page.getByRole("heading", { name: "No stores yet" })).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });
});

test.describe("a store reader without store.write", () => {
  test("can see stores, while add/edit/delete and the N shortcut are unavailable", async ({
    page,
    request,
  }, info) => {
    const tag = unique();
    const store = await createStore(request, `Read only ${tag}`);
    await createBranch(request, `Branch ${tag}`, store.id);
    const role = await createCustomRole(request, `Store reader ${tag}`, ["store.read"]);
    const staff = await createStaff(request, role.name, "StoreReader");

    await signInAs(page, staff);
    const branchesLoaded = waitForBranches(page);
    await page.goto("/stores");
    await branchesLoaded;
    await expect(row(page, store.name)).toBeVisible();
    await expect(page.getByRole("button", { name: "Add store" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Edit ${store.name}` })).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Delete ${store.name}` })).toHaveCount(0);
    await expect(page.getByRole("note")).toContainText(/view stores/i);
    await page.keyboard.press("n");
    await expect(dialog(page)).toHaveCount(0);
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "stores-read-only", async () => {
      await expect(row(page, store.name)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });
});

test.describe("store route states", () => {
  test("shows a loading skeleton before the store list arrives", async ({ page }, info) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
    let releaseLoading!: () => void;
    const loadingGate = new Promise<void>((resolve) => {
      releaseLoading = resolve;
    });
    await page.route("**/api/stores", async (route) => {
      await loadingGate;
      await route.fallback();
    });
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Stores" })
      .click();
    await expect(page.getByRole("status", { name: "Loading stores" })).toBeVisible();
    await captureSizes(page, info, "stores-loading", async () => {
      await expect(page.getByRole("status", { name: "Loading stores" })).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    releaseLoading();
    await expect(page.getByRole("region", { name: "Stores" })).toBeVisible();
  });

  test("shows a permission message for a member without store access", async ({
    page,
    request,
  }, info) => {
    const role = await createCustomRole(request, `No store access ${unique()}`, []);
    const staff = await createStaff(request, role.name, "NoStoreAccess");
    await signInAs(page, staff);
    await page.goto("/stores");
    await expect(page.getByRole("heading", { name: "You don't have permission" })).toBeVisible();
    await captureSizes(page, info, "stores-no-permission", async () => {
      await expect(page.getByRole("heading", { name: "You don't have permission" })).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });
});
