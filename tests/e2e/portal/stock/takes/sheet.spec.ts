import { expect, test, type Page } from "@playwright/test";
import { captureSizes } from "../../../../support/admin";
import { dialog, row } from "../../../../support/admin/people";
import { asOwner, heading, ownProducts, seedStock } from "../../../../support/admin/stock";
import {
  cancelOpenTakes,
  cancelTake,
  countAllBut,
  countInputs,
  startTake,
} from "../../../../support/admin/takes";
import { expectNoSeriousAxe } from "../../../../support/e2e";

// ownProducts() receives 10 kg of each product at Accra Central; each test counts every other product through
// the API and works the sheet with its own, so the specs do not depend on what the shared seed holds.

async function openSheet(page: Page, names: string[]) {
  const { branch } = await seedStock();
  const { products } = await ownProducts(names);
  await cancelOpenTakes(branch.id);
  const take = await asOwner(async (owner) => {
    const opened = await startTake(owner, branch.id);
    await countAllBut(
      owner,
      opened.id,
      products.map(({ id }) => id),
    );
    return opened;
  });
  await page.goto(`/stock/takes/${take.id}?uncounted=true`);
  await expect(heading(page, "Stock take")).toBeVisible();
  await expect(countInputs(page)).toHaveCount(products.length);
  // The first line to count has the cursor, so typing counts it.
  await expect(countInputs(page).first()).toBeFocused();
  return { take, products };
}

const problem = (page: Page) => page.getByRole("main").getByRole("alert");

test.describe("as the owner of E2E Mart", () => {
  test("a count that is not a number is refused on its line and nothing is saved", async ({
    page,
  }) => {
    await openSheet(page, ["Cassava"]);
    await page.keyboard.type("lots");
    await page.keyboard.press("Enter");
    const input = countInputs(page).first();
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveAccessibleDescription(/count/i);
    await expect(input).toBeFocused();
    await expect(countInputs(page)).toHaveCount(1);
  });

  test("posting with products still uncounted says how many, and Show uncounted goes back to them", async ({
    page,
  }, info) => {
    const { products } = await openSheet(page, ["Yam", "Cocoyam"]);
    await page.keyboard.type("10");
    await page.keyboard.press("Enter");
    await expect(countInputs(page)).toHaveCount(products.length - 1);
    await page.keyboard.press("Escape");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(heading(page, "Review the count", 2)).toBeVisible();
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(problem(page)).toContainText("1 product not counted yet");
    await expect(problem(page)).toContainText("Count every product before posting");
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "take-not-counted", async () => {
      await expect(problem(page)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await problem(page).getByRole("button", { name: "Show uncounted" }).click();
    await expect(heading(page, "Review the count", 2)).toHaveCount(0);
    await expect(countInputs(page)).toHaveCount(1);
  });

  test("a take closed elsewhere says so when a count is saved, and the sheet turns read-only on refresh", async ({
    page,
  }) => {
    const { take } = await openSheet(page, ["Beetroot"]);
    await asOwner((owner) => cancelTake(owner, take.id));
    await page.keyboard.type("4");
    await page.keyboard.press("Enter");
    await expect(problem(page)).toContainText("This stock take is closed");
    await expect(problem(page)).toContainText("cancelled");
    await problem(page).getByRole("button", { name: "Refresh the take" }).click();
    await expect(page.getByRole("main")).toContainText("Cancelled");
    await expect(countInputs(page)).toHaveCount(0);
  });

  test("a line a till counted after you is flagged for a recount", async ({ page }, info) => {
    const { products } = await openSheet(page, ["Okra"]);
    const [okra] = products;
    await page.keyboard.type("10");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    await page.keyboard.press("ControlOrMeta+Enter");
    // The server's answer when a newer count of the product exists, as the till's count would make it.
    await page.route("**/api/stock/takes/*/post", (route) =>
      route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          error: `A newer count exists for ${okra!.id}`,
          code: "SUPERSEDED",
        }),
      }),
    );
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(problem(page)).toContainText(`A till counted ${okra!.name} after you`);
    await captureSizes(page, info, "take-superseded", async () => {
      await expect(problem(page)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await problem(page)
      .getByRole("button", { name: /^Recount/ })
      .click();
    await expect(heading(page, "Review the count", 2)).toHaveCount(0);
    await expect(row(page, okra!.name)).toContainText("Recount needed");
    await expect(row(page, okra!.name).getByRole("textbox")).toBeFocused();
  });

  test("Cancel take asks first, Keep counting changes nothing, and cancelling closes the sheet", async ({
    page,
  }, info) => {
    await openSheet(page, ["Pawpaw"]);
    await page.getByRole("button", { name: /^Cancel take/ }).click();
    const ask = page.getByRole("alertdialog", { name: "Cancel this stock take?" });
    await expect(ask).toBeVisible();
    await expectNoSeriousAxe(page);
    await ask.getByRole("button", { name: "Keep counting" }).click();
    await expect(ask).toBeHidden();
    await expect(page.getByRole("button", { name: /^Cancel take/ })).toBeFocused();
    await expect(countInputs(page)).toHaveCount(1);
    await page.getByRole("button", { name: /^Cancel take/ }).click();
    await ask.getByRole("button", { name: "Cancel take" }).click();
    await expect(page.getByText("Stock take cancelled")).toBeVisible();
    await expect(page.getByRole("main")).toContainText("Cancelled");
    await expect(countInputs(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Cancel take/ })).toHaveCount(0);
    await captureSizes(page, info, "take-cancelled", async () => {
      await expect(page.getByRole("main")).toContainText("Cancelled");
      await expectNoSeriousAxe(page);
    });
    await expect(dialog(page)).toHaveCount(0);
  });

  test("offline, the sheet stays but counting, reviewing and cancelling wait for a connection", async ({
    page,
    context,
  }, info) => {
    await openSheet(page, ["Gari"]);
    await context.setOffline(true);
    const note = page
      .getByRole("main")
      .getByRole("status")
      .filter({ hasText: /offline/i });
    await expect(note).toBeVisible();
    await expect(countInputs(page).first()).toBeDisabled();
    await expect(page.getByRole("button", { name: /^Review/ })).toBeDisabled();
    await expect(page.getByRole("button", { name: /^Cancel take/ })).toBeDisabled();
    await captureSizes(page, info, "take-offline", async () => {
      await expect(note).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await context.setOffline(false);
  });

  test("when the take can't be loaded the sheet says so and Try again recovers", async ({
    page,
  }, info) => {
    const { take } = await openSheet(page, ["Plantain"]);
    let failures = 1;
    await page.route(`**/api/stock/takes/${take.id}`, (route) =>
      failures-- > 0 ? route.abort("failed") : route.fallback(),
    );
    await page.reload();
    await expect(page.getByText("Can't reach the server")).toBeVisible();
    await captureSizes(page, info, "take-error", async () => {
      await expect(page.getByText("Can't reach the server")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(heading(page, "Stock take")).toBeVisible();
  });
});
