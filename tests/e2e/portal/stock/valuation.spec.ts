import { expect, test, type Page } from "@playwright/test";
import { v7 } from "uuid";
import { captureSizes, post, unique } from "../../../support/admin";
import { row, signInAs } from "../../../support/admin/people";
import { activeTab, asOwner, heading, seedStock, stockMember } from "../../../support/admin/stock";
import { freshBranch } from "../../../support/admin/takes";
import { expectNoSeriousAxe } from "../../../support/e2e";

// A branch of its own holds exactly these, so the total is known:
//   Rice      15 kg  at GH₵ 10.00   -> GH₵ 150.00
//   Tomatoes  2.5 kg at GH₵ 28.00   -> GH₵ 70.00
//   Pepper    0.333 kg at GH₵ 1.0001 -> GH₵ 0.33 (333 x 10 001 thousandths, rounded)
//   Ginger    1 kg found, no cost    -> GH₵ 0.00, "No cost"
//   Garlic    1 kg damaged, none held -> GH₵ 0.00, "Negative stock"
//   Total GH₵ 220.33

async function valuedBranch() {
  const tag = unique();
  return asOwner(async (owner) => {
    const { supplier } = await seedStock();
    const branch = await freshBranch();
    const make = (name: string) =>
      post<{ id: string; name: string }>(owner, "/products", {
        sku: `VAL-${tag}-${name}`,
        name: `${name} ${tag}`,
        baseUnit: "kg",
        taxClass: "standard",
      });
    const [rice, tomatoes, pepper, ginger, garlic] = await Promise.all(
      ["Rice", "Tomatoes", "Pepper", "Ginger", "Garlic"].map(make),
    );
    await post(owner, "/stock/receipts", {
      id: v7(),
      branchId: branch.id,
      supplierId: supplier.id,
      lines: [
        { productId: rice!.id, quantityThousandths: 15_000, unitCost: 100_000 },
        { productId: tomatoes!.id, quantityThousandths: 2_500, unitCost: 280_000 },
        { productId: pepper!.id, quantityThousandths: 333, unitCost: 10_001 },
      ],
    });
    for (const [cause, product] of [
      ["found", ginger!],
      ["damaged", garlic!],
    ] as const)
      await post(owner, "/stock/adjustments", {
        id: v7(),
        branchId: branch.id,
        cause,
        lines: [{ productId: product.id, quantityThousandths: 1_000 }],
      });
    return { branch, tag };
  });
}

const table = (page: Page) => page.getByRole("region", { name: "Stock valuation" });
const total = (page: Page) => page.locator('[data-slot="card"]').filter({ hasText: "Total value" });

test.describe("as the owner of E2E Mart", () => {
  test("values stock at the last unit cost, flags products with no cost or negative stock, and totals it", async ({
    page,
  }, info) => {
    const { branch, tag } = await valuedBranch();
    await page.goto(`/stock/valuation?branch=${branch.id}`);
    await expect(activeTab(page, "Valuation")).toBeVisible();
    await expect(table(page)).toBeVisible();
    await expect(row(page, `Rice ${tag}`)).toContainText("15 kg");
    await expect(row(page, `Rice ${tag}`)).toContainText("GH₵ 10.00");
    await expect(row(page, `Rice ${tag}`)).toContainText("GH₵ 150.00");
    await expect(row(page, `Tomatoes ${tag}`)).toContainText("GH₵ 70.00");
    await expect(row(page, `Pepper ${tag}`)).toContainText("GH₵ 0.33");
    await expect(row(page, `Ginger ${tag}`)).toContainText("No cost");
    await expect(row(page, `Ginger ${tag}`)).toContainText("GH₵ 0.00");
    await expect(row(page, `Garlic ${tag}`)).toContainText("Negative stock");
    await expect(row(page, `Garlic ${tag}`)).toContainText("−1 kg");
    await expect(row(page, `Rice ${tag}`)).not.toContainText("No cost");
    await expect(total(page)).toContainText("GH₵ 220.33");
    await expect(page.getByRole("combobox", { name: "Branch" })).toContainText("Takes branch");
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "valuation", async () => {
      await expect(table(page)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });

  test("B picks another branch, and a branch with nothing on hand says so", async ({ page }) => {
    const { branch } = await valuedBranch();
    const empty = await freshBranch();
    await page.goto(`/stock/valuation?branch=${branch.id}`);
    await expect(total(page)).toContainText("GH₵ 220.33");
    await heading(page, "Inventory").focus();
    // B opens the picker with the cursor in it: typing a name finds the branch, and Enter picks it.
    await page.keyboard.press("b");
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.type(empty.name, { delay: 30 });
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(empty.id));
    await expect(heading(page, "Nothing on hand to value", 2)).toBeVisible();
    await expect(total(page)).toContainText("GH₵ 0.00");
  });

  test("when the server can't be reached the report says so and Try again recovers", async ({
    page,
  }, info) => {
    const { branch } = await valuedBranch();
    let failures = 1;
    await page.route("**/api/stock/valuation?*", (route) =>
      failures-- > 0 ? route.abort("failed") : route.fallback(),
    );
    await page.goto(`/stock/valuation?branch=${branch.id}`);
    await expect(page.getByText("Can't reach the server")).toBeVisible();
    await captureSizes(page, info, "valuation-error", async () => {
      await expect(page.getByText("Can't reach the server")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(table(page)).toBeVisible();
  });

  test("a slow report shows a skeleton shaped like the page", async ({ page }, info) => {
    const { branch } = await valuedBranch();
    await page.goto("/products");
    await expect(heading(page, "Products")).toBeVisible();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/stock/valuation?*", async (route) => {
      await gate;
      return route.fallback();
    });
    await page.goto(`/stock/valuation?branch=${branch.id}`);
    try {
      const loading = page
        .getByRole("main")
        .getByRole("status", { name: "Loading stock valuation" });
      await expect(loading).toBeVisible();
      await captureSizes(page, info, "valuation-loading", async () => {
        await expect(loading).toBeVisible();
        await expectNoSeriousAxe(page);
      });
    } finally {
      release();
    }
    await expect(table(page)).toBeVisible();
  });

  test("offline, the report stays and says it is the one loaded earlier", async ({
    page,
    context,
  }, info) => {
    const { branch } = await valuedBranch();
    await page.goto(`/stock/valuation?branch=${branch.id}`);
    await expect(table(page)).toBeVisible();
    await context.setOffline(true);
    const note = page
      .getByRole("main")
      .getByRole("status")
      .filter({ hasText: /offline/i });
    await expect(note).toBeVisible();
    await captureSizes(page, info, "valuation-offline", async () => {
      await expect(note).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await context.setOffline(false);
  });
});

test.describe("members of E2E Mart without the owner role", () => {
  test("an accountant reads the valuation", async ({ page, request }) => {
    const { branch } = await valuedBranch();
    await page.context().clearCookies();
    await signInAs(page, await stockMember(request, "accountant"));
    await page.goto(`/stock/valuation?branch=${branch.id}`);
    await expect(total(page)).toContainText("GH₵ 220.33");
  });

  test("without stock.read the valuation is the no-permission state", async ({ page, request }) => {
    await page.context().clearCookies();
    await signInAs(page, await stockMember(request, "nobody"));
    await page.goto("/stock/valuation");
    await expect(
      page.getByText("You don't have permission to view the stock valuation"),
    ).toBeVisible();
    await expectNoSeriousAxe(page);
  });
});
