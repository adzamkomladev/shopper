import { expect, test, type Page } from "@playwright/test";
import { captureSizes, post, unique } from "../../../../support/admin";
import { chooseByTyping, dialog, row, signInAs } from "../../../../support/admin/people";
import { activeTab, asOwner, heading, stockMember } from "../../../../support/admin/stock";
import { cancelTake, countAllBut, freshBranch, startTake } from "../../../../support/admin/takes";
import { expectNoSeriousAxe } from "../../../../support/e2e";

const start = (page: Page) => page.getByRole("button", { name: /^Start a stock take/ }).first();
const takesTable = (page: Page) => page.getByRole("region", { name: "Stock takes" });

async function openTakes(page: Page, branchId: string) {
  await page.goto(`/stock/takes?branch=${branchId}`);
  await expect(activeTab(page, "Stock takes")).toBeVisible();
}

test.describe("as the owner of E2E Mart", () => {
  test("a branch with no takes says so and offers N to start one", async ({ page }, info) => {
    const branch = await freshBranch();
    await openTakes(page, branch.id);
    await expect(heading(page, "No stock takes yet", 2)).toBeVisible();
    await expect(start(page)).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "takes-empty", async () => {
      await expect(start(page)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });

  test("the list shows each take's status and how many lines are counted", async ({
    page,
  }, info) => {
    const branch = await freshBranch();
    const posted = await asOwner((owner) => startTake(owner, branch.id));
    await asOwner(async (owner) => {
      await countAllBut(owner, posted.id, []);
      await post(owner, `/stock/takes/${posted.id}/post`, {});
      const cancelled = await startTake(owner, branch.id);
      await cancelTake(owner, cancelled.id);
      await startTake(owner, branch.id);
    });
    await openTakes(page, branch.id);
    await expect(takesTable(page)).toBeVisible();
    const total = posted.lines.length;
    await expect(row(page, "Posted")).toContainText(`${total} of ${total}`);
    await expect(row(page, "Cancelled")).toContainText(`0 of ${total}`);
    await expect(row(page, "Open")).toContainText(`0 of ${total}`);
    await expect(row(page, "Open")).toContainText("Whole branch");
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "takes-list", async () => {
      await expect(takesTable(page)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await row(page, "Open").getByRole("link").click();
    await expect(page).toHaveURL(/\/stock\/takes\/[0-9a-f-]{36}/);
  });

  test("a category take lists only that category's products", async ({ page }) => {
    const branch = await freshBranch();
    const tag = unique();
    const { inCategory, name } = await asOwner(async (owner) => {
      const category = await post<{ id: string; name: string }>(owner, "/categories", {
        name: `Grains ${tag}`,
      });
      const item = await post<{ id: string; name: string }>(owner, "/products", {
        sku: `GRN-${tag}`,
        name: `Maize ${tag}`,
        baseUnit: "kg",
        taxClass: "standard",
        categoryId: category.id,
      });
      return { inCategory: item, name: category.name };
    });
    await openTakes(page, branch.id);
    await page.keyboard.press("n");
    const choose = dialog(page);
    await expect(choose.getByRole("radio", { name: /^Full count/ })).toBeFocused();
    // Radix checks a radio when focus arrives while the arrow is down, so the key is held for a moment as a hand would.
    await page.keyboard.press("ArrowDown", { delay: 50 });
    await expect(choose.getByRole("radio", { name: /^One category/ })).toBeChecked();
    await chooseByTyping(page, choose.getByRole("combobox", { name: "Category" }), name);
    await expectNoSeriousAxe(page);
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page).toHaveURL(/\/stock\/takes\/[0-9a-f-]{36}/);
    await expect(page.getByRole("main")).toContainText(name);
    await expect(page.getByRole("textbox", { name: /^Counted/ })).toHaveCount(1);
    await expect(row(page, inCategory.name)).toBeVisible();
  });

  test("a branch with an open take refuses a second and links to the open one", async ({
    page,
  }, info) => {
    const branch = await freshBranch();
    const open = await asOwner((owner) => startTake(owner, branch.id));
    await openTakes(page, branch.id);
    await page.keyboard.press("n");
    await page.keyboard.press("Enter");
    const refused = dialog(page).getByRole("alert");
    await expect(refused).toContainText("This branch already has an open stock take");
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "takes-open-refused", async () => {
      await expect(refused).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await refused.getByRole("link", { name: "Open the take" }).click();
    await expect(page).toHaveURL(new RegExp(`/stock/takes/${open.id}`));
  });

  test("when the server can't be reached the list says so and Try again recovers", async ({
    page,
  }, info) => {
    const branch = await freshBranch();
    let failures = 1;
    await page.route("**/api/stock/takes?*", (route) =>
      failures-- > 0 ? route.abort("failed") : route.fallback(),
    );
    await page.goto(`/stock/takes?branch=${branch.id}`);
    await expect(page.getByText("Can't reach the server")).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "takes-error", async () => {
      await expect(page.getByText("Can't reach the server")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(heading(page, "No stock takes yet", 2)).toBeVisible();
  });

  test("a slow list shows a skeleton shaped like the page", async ({ page }, info) => {
    const branch = await freshBranch();
    await page.goto("/products");
    await expect(heading(page, "Products")).toBeVisible();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/stock/takes?*", async (route) => {
      await gate;
      return route.fallback();
    });
    await page.goto(`/stock/takes?branch=${branch.id}`);
    try {
      const loading = page.getByRole("main").getByRole("status", { name: "Loading stock takes" });
      await expect(loading).toBeVisible();
      await captureSizes(page, info, "takes-loading", async () => {
        await expect(loading).toBeVisible();
        await expectNoSeriousAxe(page);
      });
    } finally {
      release();
    }
    await expect(heading(page, "No stock takes yet", 2)).toBeVisible();
  });

  test("offline, the list stays and starting a take waits for a connection", async ({
    page,
    context,
  }, info) => {
    const branch = await freshBranch();
    await openTakes(page, branch.id);
    await context.setOffline(true);
    const note = page
      .getByRole("main")
      .getByRole("status")
      .filter({ hasText: /offline/i });
    await expect(note).toBeVisible();
    await expect(start(page)).toBeDisabled();
    await captureSizes(page, info, "takes-offline", async () => {
      await expect(note).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await context.setOffline(false);
  });
});

test.describe("members of E2E Mart without the owner role", () => {
  test("an accountant reads the takes but cannot start one, and N does nothing", async ({
    page,
    request,
  }) => {
    const branch = await freshBranch();
    const open = await asOwner((owner) => startTake(owner, branch.id));
    await page.context().clearCookies();
    await signInAs(page, await stockMember(request, "accountant"));
    await openTakes(page, branch.id);
    await expect(row(page, "Open")).toBeVisible();
    await expect(start(page)).toHaveCount(0);
    await heading(page, "Inventory").click();
    await page.keyboard.press("n");
    await expect(dialog(page)).toHaveCount(0);
    await page.goto(`/stock/takes/${open.id}`);
    await expect(heading(page, "Stock take")).toBeVisible();
    await expect(page.getByRole("textbox", { name: /^Counted/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Cancel take/ })).toHaveCount(0);
  });

  test("without stock.read the takes page is the no-permission state", async ({
    page,
    request,
  }) => {
    await page.context().clearCookies();
    await signInAs(page, await stockMember(request, "nobody"));
    await page.goto("/stock/takes");
    await expect(page.getByText("You don't have permission to view stock takes")).toBeVisible();
    await expectNoSeriousAxe(page);
  });
});
