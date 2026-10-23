import { expect, test, type Page } from "@playwright/test";
import { captureSizes, unique } from "../../../support/admin";
import {
  makeCustomer,
  openCustomer,
  openCustomers,
  segment,
  settle,
} from "../../../support/admin/customers";
import { dialog, row } from "../../../support/admin/people";
import { expectNoSeriousAxe } from "../../../support/e2e";

const flag = (page: Page) => page.getByRole("note").filter({ hasText: "Shares a phone" });
const card = (page: Page, label: string) => page.getByRole("group", { name: label });
const option = (page: Page, name: string | RegExp) => dialog(page).getByRole("option", { name });
const mergeButton = (page: Page) => page.getByRole("button", { name: "Merge", exact: true });

test.describe("as the owner of E2E Mart", () => {
  test("two customers on one phone are flagged on both pages", async ({ page, request }, info) => {
    const phone = "0244998877";
    const first = await makeCustomer(request, { name: `Twin ${unique()} One`, phone });
    const second = await makeCustomer(request, { name: `Twin ${unique()} Two`, phone });
    await openCustomer(page, first);
    await expect(flag(page)).toContainText("Shares a phone with");
    await expect(flag(page).getByRole("link", { name: second.name })).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "customer-shared-phone", async () => {
      await expect(flag(page)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await openCustomer(page, second);
    await expect(flag(page)).toContainText("Shares a phone with");
    const alone = await makeCustomer(request);
    await openCustomer(page, alone);
    await expect(flag(page)).toHaveCount(0);
  });

  test("M finds the other customer by name, shows both accounts and the result, and merges", async ({
    page,
    request,
  }, info) => {
    const tag = unique();
    const winner = await makeCustomer(request, { name: `Merge ${tag} Winner` });
    const loser = await makeCustomer(request, { name: `Merge ${tag} Loser` });
    await settle(request, winner, { owed: 100, points: 10 });
    await settle(request, loser, { owed: 20.5, points: 5 });
    await openCustomer(page, winner);
    await page.keyboard.press("m");
    await expect(
      dialog(page).getByRole("heading", { name: `Merge into ${winner.name}` }),
    ).toBeVisible();
    const input = dialog(page).getByRole("combobox", { name: "Find the customer to merge in" });
    await expect(input).toBeFocused();
    await expect(dialog(page).getByRole("button", { name: /Merge customers/ })).toBeDisabled();
    await page.keyboard.type(`Merge ${tag}`);
    await expect(option(page, new RegExp(loser.name))).toBeVisible();
    // The customer being kept is never offered.
    await expect(option(page, new RegExp(winner.name))).toHaveCount(0);
    await page.keyboard.press("Enter");
    const result = dialog(page).getByRole("table", { name: "Accounts after the merge" });
    await expect(result).toContainText("GH₵ 100.00");
    await expect(result).toContainText("GH₵ 20.50");
    await expect(result).toContainText("GH₵ 120.50");
    await expect(result).toContainText("15");
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "customer-merge", async () => {
      await expect(result).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Customers merged")).toBeVisible();
    await expect(dialog(page)).toBeHidden();
    await expect(card(page, "Owed")).toContainText("GH₵ 120.50");
    await expect(card(page, "Points")).toContainText("15");
    await expect(mergeButton(page)).toBeFocused();
    // The loser is archived and points at the winner.
    await openCustomer(page, loser);
    await expect(page.getByRole("main")).toContainText("Merged into");
    await expect(page.getByRole("main").getByRole("link", { name: winner.name })).toBeVisible();
    await expect(page.getByRole("button", { name: "Restore" })).toHaveCount(0);
    await expect(mergeButton(page)).toHaveCount(0);
    await openCustomers(page, `?q=Merge ${tag}`);
    await expect(row(page, loser.name)).toHaveCount(0);
    await segment(page, "Archived").click();
    await expect(row(page, loser.name)).toBeVisible();
  });

  test("the shared-phone flag opens the merge with those customers already found", async ({
    page,
    request,
  }) => {
    const phone = "0244112233";
    const keep = await makeCustomer(request, { name: `Dup ${unique()} Keep`, phone });
    const other = await makeCustomer(request, { name: `Dup ${unique()} Other`, phone });
    await openCustomer(page, keep);
    await flag(page).getByRole("button", { name: "Merge" }).click();
    await expect(option(page, new RegExp(other.name))).toBeVisible();
    await option(page, new RegExp(other.name)).click();
    await dialog(page)
      .getByRole("button", { name: /Merge customers/ })
      .click();
    await expect(page.getByText("Customers merged")).toBeVisible();
    await expect(flag(page)).toHaveCount(0);
  });

  test("a refusal from the server is shown in the dialog and nothing closes", async ({
    page,
    request,
  }) => {
    const keep = await makeCustomer(request, { name: `Refuse ${unique()} Keep` });
    const other = await makeCustomer(request, { name: `Refuse ${unique()} Other` });
    await page.route(`**/api/customers/${keep.id}/merge`, (route) =>
      route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Both customers must be active to merge",
          code: "MERGE_UNAVAILABLE",
        }),
      }),
    );
    await openCustomer(page, keep);
    await page.keyboard.press("m");
    await page.keyboard.type(other.name);
    await option(page, new RegExp(other.name)).click();
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(dialog(page)).toContainText("Both customers must be active to merge");
    await page.keyboard.press("Escape");
    await expect(mergeButton(page)).toBeFocused();
  });

  test("a search with nobody to merge says so", async ({ page, request }) => {
    const keep = await makeCustomer(request);
    await openCustomer(page, keep);
    await page.keyboard.press("m");
    await page.keyboard.type(`Nobody ${unique()}`);
    await expect(dialog(page)).toContainText("No customers match");
  });
});
