import { expect, test } from "@playwright/test";
import { BRANCH_NAME } from "../../../support/e2e";
import { captureSizes } from "../../../support/admin";
import { dialog, signInAs } from "../../../support/admin/people";
import {
  activeTab,
  heading,
  nav,
  ownProducts,
  seedStock,
  stockMember,
} from "../../../support/admin/stock";
import { cancelOpenTakes, countAllBut, countInputs, readTake } from "../../../support/admin/takes";
import { expectNoSeriousAxe } from "../../../support/e2e";

// ownProducts() receives 10 kg of each product at Accra Central. A Full take lists every product of the shop,
// so the specs count the others through the API and leave only their own for the keyboard to count.

test.describe("an inventory manager of E2E Mart", () => {
  test("The inventory manager runs a stock take from the portal", async ({
    page,
    request,
  }, info) => {
    const { branch } = await seedStock();
    const { products } = await ownProducts(["Millet", "Sorghum"]);
    const [millet, sorghum] = products as [(typeof products)[number], (typeof products)[number]];
    await cancelOpenTakes(branch.id);
    await page.context().clearCookies();
    await signInAs(page, await stockMember(request, "inventory"));

    // Inventory, then Stock takes, then the branch to count.
    await nav(page).getByRole("link", { name: "Inventory" }).click();
    await page.getByRole("tab", { name: "Stock takes", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(activeTab(page, "Stock takes")).toBeVisible();
    const branchBox = page.getByRole("combobox", { name: "Branch" });
    if (!(await branchBox.textContent())?.includes(BRANCH_NAME)) {
      await heading(page, "Inventory").focus();
      await page.keyboard.press("b");
      await expect(page.getByRole("listbox")).toBeVisible();
      await page.keyboard.type(BRANCH_NAME, { delay: 30 });
      await page.keyboard.press("Enter");
      await expect(branchBox).toContainText(BRANCH_NAME);
    }

    // N opens the dialog, Full is already chosen, Enter starts the take.
    await heading(page, "Inventory").focus();
    await page.keyboard.press("n");
    await expect(dialog(page).getByRole("heading", { name: "Start a stock take" })).toBeVisible();
    await expect(dialog(page).getByRole("radio", { name: /^Full count/ })).toBeFocused();
    await expect(dialog(page).getByRole("radio", { name: /^Full count/ })).toBeChecked();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/stock\/takes\/[0-9a-f-]{36}/);
    const takeId = page.url().split("/").pop()!.split("?")[0]!;
    // The first product to count has the cursor.
    await expect(countInputs(page).first()).toBeFocused();
    await expect(page.getByRole("main")).toContainText("Open");

    // Everything but the two products is counted at what is expected, as a till or a long evening would have it.
    await countAllBut(request, takeId, [millet.id, sorghum.id]);
    await page.reload();
    await expect(page.getByRole("status").filter({ hasText: /\d+ of \d+ counted/ })).toBeVisible();
    // Back on the sheet, the cursor is on the first product still to count.
    await expect(page.getByRole("textbox", { name: `Counted ${millet.name}` })).toBeFocused();

    // Escape leaves the box, so U works: it shows what is still to count, and the first of it takes the cursor.
    await page.keyboard.press("Escape");
    await expect(heading(page, "Stock take")).toBeFocused();
    await page.keyboard.press("u");
    await expect(page).toHaveURL(/uncounted=true/);
    await expect(countInputs(page)).toHaveCount(2);
    await expect(countInputs(page).first()).toBeFocused();
    await expect(page.getByRole("row").filter({ hasText: millet.name })).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "take-sheet", async () => {
      await expect(countInputs(page).first()).toBeVisible();
      await expectNoSeriousAxe(page);
    });

    // One short in the Millet, the Sorghum as expected; Enter saves a line and moves to the next.
    await page.keyboard.type("9");
    await page.keyboard.press("Enter");
    await expect(countInputs(page)).toHaveCount(1);
    await expect(countInputs(page).first()).toBeFocused();
    await page.keyboard.type("10");
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("status").filter({ hasText: /^(\d+) of \1 counted/ }),
    ).toBeVisible();
    await expect(page.getByText("Every product is counted")).toBeVisible();

    // Mod+Enter reviews the variance, and Mod+Enter again posts it.
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(heading(page, "Review the count", 2)).toBeVisible();
    const review = page.getByRole("row").filter({ hasText: millet.name });
    await expect(review).toContainText("−1 kg");
    await expect(review).toContainText("GH₵ -5.00");
    await expect(page.getByRole("row").filter({ hasText: sorghum.name })).not.toContainText("−");
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "take-review", async () => {
      await expect(review).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Stock take posted")).toBeVisible();
    await expect(page.getByRole("main")).toContainText("Posted");
    await expect(countInputs(page)).toHaveCount(0);
    await expect(page.getByRole("row").filter({ hasText: millet.name })).toContainText("−1 kg");

    // The take stores what it posted, and stock on hand follows the count.
    const posted = await readTake(request, takeId);
    expect(posted.status).toBe("posted");
    expect(posted.lines.find((line) => line.productId === millet.id)).toMatchObject({
      expectedThousandths: 10_000,
      countedThousandths: 9_000,
      varianceThousandths: -1_000,
    });
    await page.goto(`/stock/products/${millet.id}?branch=${branch.id}`);
    await expect(page.getByRole("main")).toContainText("9 kg");
  });
});
