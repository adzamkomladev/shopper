import { expect, test, type Page } from "@playwright/test";
import { captureSizes, unique } from "../../../support/admin";
import { createStaff, signInAs } from "../../../support/admin/people";
import { seedShifts } from "../../../support/admin/shifts";
import { ANNEX, BRANCH_NAME, expectNoSeriousAxe, signInWithKeyboard } from "../../../support/e2e";

// The owner of E2E Mart is signed in. The three shifts are closed by one cashier on one till, a second apart:
//   newest first -> Short GH₵ 5.00 (cash short and card over by the same amount), Over GH₵ 1.00 (card), Short GH₵ 6.00 (cash, a manager approved), Balanced
const heading = (page: Page, name: string, level = 1) => page.getByRole("heading", { name, level });
const noPermission = (page: Page) => heading(page, "You don't have permission");

test.describe("as the owner of E2E Mart", () => {
  test("lists closed shifts newest first with who closed them and a variance badge", async ({
    page,
  }, info) => {
    const { till, cashier, manager } = await seedShifts();
    await page.goto("/shifts");
    await expect(heading(page, "Shifts")).toBeVisible();
    const rows = page.getByRole("row").filter({ hasText: till });
    await expect(rows).toHaveCount(4);
    // Cash short and card over by the same amount must not net to Balanced.
    await expect(rows.nth(0)).toContainText("Short GH₵ 5.00");
    await expect(rows.nth(1)).toContainText("Over GH₵ 1.00");
    await expect(rows.nth(2)).toContainText("Short GH₵ 6.00");
    await expect(rows.nth(3)).toContainText("Balanced");
    for (const index of [0, 1, 2, 3]) {
      await expect(rows.nth(index)).toContainText(BRANCH_NAME);
      await expect(rows.nth(index)).toContainText(cashier.name);
      await expect(rows.nth(index)).toContainText("GH₵ 53.60");
    }
    await expect(rows.nth(2)).toContainText(manager.name);
    await expect(rows.nth(2)).toContainText("GH₵ 47.60");
    await expect(rows.nth(0)).not.toContainText(manager.name);
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "shifts", async () => {
      await expect(heading(page, "Shifts")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });

  test("the keyboard opens a shift's Z report and Back to shifts returns to the list", async ({
    page,
  }, info) => {
    const { till, cashier, manager } = await seedShifts();
    await page.goto("/shifts");
    const shortRow = page.getByRole("row").filter({ hasText: "Short GH₵ 6.00" }).filter({
      hasText: till,
    });
    await shortRow.getByRole("link").focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/shifts\/[0-9a-f-]{36}$/);
    await expect(heading(page, till)).toBeFocused();
    await expect(page.getByRole("main")).toContainText(BRANCH_NAME);
    await expect(page.getByRole("main")).toContainText(cashier.name);
    await expect(page.getByRole("main")).toContainText(`Approved by ${manager.name}`);

    const report = page.getByRole("region", { name: "Z report" });
    await expect(report).toBeVisible();
    const tenders = report.getByRole("table", { name: "Tenders" });
    await expect(tenders.getByRole("row", { name: /Cash/ })).toContainText("Short GH₵ 6.00");
    await expect(tenders.getByRole("row", { name: /Card/ })).toContainText("Balanced");
    await expect(tenders.getByRole("columnheader")).toHaveText([
      "Tender",
      "Expected",
      "Declared",
      "Variance",
    ]);
    await expect(report.getByRole("region", { name: "Audit anchor" })).toContainText("#41");
    await expect(report.getByRole("region", { name: "Audit anchor" })).toContainText(
      "c0ffee12c0ffee12 c0ffee12c0ffee12",
    );
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "shift-detail", async () => {
      await expect(report).toBeVisible();
      await expectNoSeriousAxe(page);
    });

    await page.getByRole("link", { name: "Back to shifts" }).focus();
    await page.keyboard.press("Enter");
    await expect(heading(page, "Shifts")).toBeVisible();
  });

  test("a shift whose tenders offset still reads Short, with each tender's own variance", async ({
    page,
  }) => {
    const { till } = await seedShifts();
    await page.goto("/shifts");
    await page.getByRole("row").filter({ hasText: till }).nth(0).getByRole("link").click();
    await expect(heading(page, till)).toBeVisible();
    await expect(page.getByRole("main").getByText("Short GH₵ 5.00").first()).toBeVisible();
    const tenders = page.getByRole("table", { name: "Tenders" });
    await expect(tenders.getByRole("row", { name: /Cash/ })).toContainText("Short GH₵ 5.00");
    await expect(tenders.getByRole("row", { name: /Card/ })).toContainText("Over GH₵ 5.00");
  });

  test("a shift that fails to load offers Try again and the way back to the list", async ({
    page,
  }) => {
    const { till } = await seedShifts();
    await page.goto("/shifts");
    await page.route("**/api/shifts/*", (route) => route.abort("failed"));
    await page.getByRole("row").filter({ hasText: till }).nth(0).getByRole("link").click();
    await expect(heading(page, "Something went wrong")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await page.getByRole("link", { name: "Back to shifts" }).click();
    await expect(heading(page, "Shifts")).toBeVisible();
  });

  test("a shift that does not exist says so and offers the way back", async ({ page }, info) => {
    await page.goto("/shifts/019a0000-0000-7000-8000-0000000000aa");
    await expect(heading(page, "Shift not found")).toBeVisible();
    await page.getByRole("link", { name: "Back to shifts" }).click();
    await expect(heading(page, "Shifts")).toBeVisible();
    await page.goBack();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "shift-not-found", async () => {
      await expect(heading(page, "Shift not found")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });

  test("when the server can't be reached the list says so and Try again recovers", async ({
    page,
  }, info) => {
    await seedShifts();
    let failures = 1;
    await page.route("**/api/shifts", (route) =>
      failures-- > 0 ? route.abort("failed") : route.fallback(),
    );
    await page.goto("/shifts");
    await expect(page.getByText("Can't reach the server")).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "shifts-unavailable", async () => {
      await expect(page.getByText("Can't reach the server")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(heading(page, "Shifts")).toBeVisible();
  });

  test("a slow list shows a skeleton shaped like the page", async ({ page }, info) => {
    await seedShifts();
    await page.goto("/products");
    await expect(heading(page, "Products")).toBeVisible();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/shifts", async (route) => {
      await gate;
      return route.fallback();
    });
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Shifts" })
      .click();
    try {
      const loading = page.getByRole("main").getByRole("status", { name: "Loading shifts" });
      await expect(loading).toBeVisible();
      await captureSizes(page, info, "shifts-loading", async () => {
        await expect(loading).toBeVisible();
        await expectNoSeriousAxe(page);
      });
    } finally {
      release();
    }
    await expect(heading(page, "Shifts")).toBeVisible();
  });

  test("offline, the list stays and says it may be out of date", async ({
    page,
    context,
  }, info) => {
    await seedShifts();
    await page.goto("/shifts");
    await expect(heading(page, "Shifts")).toBeVisible();
    await context.setOffline(true);
    const note = page
      .getByRole("main")
      .getByRole("status")
      .filter({ hasText: /offline/i });
    await expect(note).toBeVisible();
    await expect(page.getByRole("row").nth(1)).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "shifts-offline", async () => {
      await expect(note).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await context.setOffline(false);
  });
});

test.describe("a shop with no closed shifts", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("explains what produces a shift", async ({ page }, info) => {
    await signInWithKeyboard(page, ANNEX);
    await page.goto("/shifts");
    await expect(heading(page, "No closed shifts yet", 2)).toBeVisible();
    await expect(page.getByRole("main")).toContainText("counts the drawer");
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "shifts-empty", async () => {
      await expect(heading(page, "No closed shifts yet", 2)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });
});

test.describe("members of E2E Mart without the owner role", () => {
  test("an accountant has the Shifts link and can read a shift", async ({ page, request }) => {
    const { till } = await seedShifts();
    const accountant = await createStaff(request, "accountant", "Yaw");
    await page.context().clearCookies();
    await signInAs(page, accountant);
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Shifts" })
      .click();
    await expect(page.getByRole("row").filter({ hasText: till })).toHaveCount(4);
  });

  test("without shift.read there is no link and the page is the no-permission state", async ({
    page,
    request,
  }, info) => {
    await seedShifts();
    const clerk = await createStaff(request, "inventory", `Stock${unique()}`);
    await page.context().clearCookies();
    await signInAs(page, clerk);
    await expect(page.getByRole("link", { name: "Shifts" })).toHaveCount(0);
    await page.goto("/shifts");
    await expect(noPermission(page)).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "shifts-no-permission", async () => {
      await expect(noPermission(page)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });
});
