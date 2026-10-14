import { expect, test, type Page } from "@playwright/test";
import { unique } from "../../../../support/admin";
import { createCustomRole, createStaff, signInAs } from "../../../../support/admin/people";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import {
  clearMappings,
  seedMapping,
  shoot,
  weightLayout,
} from "../../../../support/catalogue/mappings";

const heading = (page: Page) => page.getByRole("heading", { name: "Barcode layouts", level: 1 });
const nav = (page: Page) =>
  page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Barcodes" });

test.describe("barcode layout states as the owner", () => {
  test.beforeEach(async ({ request }) => {
    await clearMappings(request);
  });

  test("with no layouts it says what they are for and offers the first one", async ({
    page,
  }, info) => {
    await page.goto("/barcodes");
    await expect(page.getByRole("heading", { name: "No barcode layouts yet" })).toBeVisible({
      timeout: 20_000,
    });
    const add = page.getByRole("button", { name: "Add layout" });
    await expect(add).toBeVisible();
    // The one primary action: the header button waits until there is a list.
    await expect(add).toHaveCount(1);
    await shoot(page, info, "empty", async () => {
      await expect(add).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.keyboard.press("n");
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("shows a skeleton while the layouts load", async ({ page }, info) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/catalogue/barcodes/mappings", async (route) => {
      await gate;
      await route.fallback();
    });
    await nav(page).click();
    await expect(page.getByRole("status", { name: "Loading barcode layouts" })).toBeVisible();
    await shoot(page, info, "loading", async () => {
      await expect(page.getByRole("status", { name: "Loading barcode layouts" })).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    release();
    await expect(heading(page)).toBeVisible();
  });

  test("an unreachable server says what happened and can try again", async ({ page }, info) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
    let failing = true;
    await page.route("**/api/catalogue/barcodes/mappings", (route) =>
      failing ? route.abort("failed") : route.fallback(),
    );
    await nav(page).click();
    await expect(page.getByText("Can't reach the server")).toBeVisible();
    await shoot(page, info, "error", async () => {
      await expect(page.getByText("Can't reach the server")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    failing = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(heading(page)).toBeVisible();
  });

  test("offline disables Save layout and says why", async ({ page, context }, info) => {
    await page.goto("/barcodes");
    await expect(heading(page)).toBeVisible({ timeout: 20_000 });
    await page.keyboard.press("n");
    const save = page.getByRole("dialog").getByRole("button", { name: "Save layout" });
    await page.getByLabel("Prefix", { exact: true }).fill("21");
    await context.setOffline(true);
    await expect(save).toBeDisabled();
    await expect(save).toHaveAccessibleDescription(/offline/i);
    await shoot(page, info, "offline", async () => {
      await expect(save).toBeDisabled();
      await expectNoSeriousAxe(page);
    });
    await context.setOffline(false);
  });
});

test.describe("a member who can view products but not change them", () => {
  test("sees the layouts read-only with the reason, and no way to change them", async ({
    page,
    request,
  }, info) => {
    await clearMappings(request);
    await seedMapping(request, weightLayout(21));
    const role = await createCustomRole(request, `Layout reader ${unique()}`, ["product.read"]);
    const staff = await createStaff(request, role.name, "LayoutReader");
    await signInAs(page, staff);
    await page.goto("/barcodes");
    await expect(heading(page)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("cell", { name: "21", exact: true })).toBeVisible();
    await expect(page.getByRole("note")).toContainText(/view barcode layouts/i);
    await expect(page.getByRole("button", { name: "Add layout" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Edit / })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Delete / })).toHaveCount(0);
    await page.keyboard.press("n");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await shoot(page, info, "read-only", async () => {
      await expect(heading(page)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });

  test("a read-only member with no layouts is told who can add them", async ({ page, request }) => {
    await clearMappings(request);
    const role = await createCustomRole(request, `Layout reader ${unique()}`, ["product.read"]);
    const staff = await createStaff(request, role.name, "LayoutReader");
    await signInAs(page, staff);
    await page.goto("/barcodes");
    await expect(page.getByRole("heading", { name: "No barcode layouts yet" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: "Add layout" })).toHaveCount(0);
    await expect(page.getByRole("note")).toContainText(/ask an owner/i);
  });
});

test.describe("a member without product access", () => {
  test("gets a permission message and no Barcodes link", async ({ page, request }, info) => {
    const role = await createCustomRole(request, `No products ${unique()}`, []);
    const staff = await createStaff(request, role.name, "NoLayouts");
    await signInAs(page, staff);
    await expect(nav(page)).toHaveCount(0);
    await page.goto("/barcodes");
    await expect(page.getByRole("heading", { name: "You don't have permission" })).toBeVisible();
    await shoot(page, info, "no-permission", async () => {
      await expect(page.getByRole("heading", { name: "You don't have permission" })).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });
});
