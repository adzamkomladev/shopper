import { expect, test, type APIRequestContext } from "@playwright/test";
import { captureSizes, shopHeaders, unique } from "../../../support/admin";
import { createStaff, dialog, listUsers, row, signInAs } from "../../../support/admin/people";
import { BOX_API, BRANCH_NAME, OWNER_NAME, expectNoSeriousAxe } from "../../../support/e2e";

/** Limits a member to the named branches through the real API, as the owner. */
async function scope(request: APIRequestContext, userId: string, names: string[]) {
  const headers = await shopHeaders(request);
  const branches = (await (await request.get(`${BOX_API}/branches`, { headers })).json()) as {
    id: string;
    name: string;
  }[];
  const response = await request.put(`${BOX_API}/users/${userId}/branches`, {
    headers,
    data: { branchIds: branches.filter((b) => names.includes(b.name)).map((b) => b.id) },
  });
  expect(response.status(), await response.text()).toBe(200);
}

/** A second branch of E2E Mart's store, so access has something to choose between. */
async function addBranch(request: APIRequestContext) {
  const headers = await shopHeaders(request);
  const [store] = (await (await request.get(`${BOX_API}/stores`, { headers })).json()) as {
    id: string;
  }[];
  const name = `Tema ${unique()}`;
  const created = await request.post(`${BOX_API}/branches`, {
    headers,
    data: { name, storeId: store!.id },
  });
  expect(created.status(), await created.text()).toBe(201);
  return name;
}

// Runs on the saved E2E Mart owner session.
test.describe("as the owner of E2E Mart", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
  });

  test("limit a member to one branch from Edit access, by keyboard", async ({ page, request }) => {
    await addBranch(request);
    const member = await createStaff(request, "cashier", "Akosua");
    await page.reload();
    await expect(row(page, member.name)).toContainText("All branches");
    const trigger = page.getByRole("button", { name: `Edit access for ${member.name}` });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(dialog(page).getByRole("heading", { name: "Edit access" })).toBeVisible();
    const everywhere = dialog(page).getByRole("switch", { name: "All branches" });
    await expect(everywhere).toBeChecked();
    await everywhere.focus();
    await page.keyboard.press("Space");
    await dialog(page).getByRole("checkbox", { name: BRANCH_NAME }).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Access updated")).toBeVisible();
    await expect(dialog(page)).toBeHidden();
    await expect(row(page, member.name)).toContainText(BRANCH_NAME);
    await expect(trigger).toBeFocused();
    const saved = (await listUsers(request)).find((user) => user.id === member.userId);
    expect(saved?.branchIds).toHaveLength(1);
  });

  test("limiting to no branch at all is refused before saving", async ({ page, request }) => {
    const member = await createStaff(request, "cashier", "Yaa");
    await page.reload();
    await page.getByRole("button", { name: `Edit access for ${member.name}` }).click();
    await dialog(page).getByRole("switch", { name: "All branches" }).click();
    await dialog(page).getByRole("button", { name: "Save access" }).click();
    await expect(dialog(page).getByText("Choose at least one branch")).toBeVisible();
  });

  test("the owner works at every branch: the switch is locked on", async ({ page }) => {
    await page.getByRole("button", { name: `Edit access for ${OWNER_NAME}` }).click();
    await expect(dialog(page).getByRole("switch", { name: "All branches" })).toBeDisabled();
    await expect(dialog(page)).toContainText("The owner works at every branch");
  });

  test("deactivate signs a member out and moves them to Deactivated; reactivate brings them back", async ({
    page,
    request,
    browser,
  }, info) => {
    const member = await createStaff(request, "accountant", "Kojo");
    const theirs = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const them = await theirs.newPage();
    await signInAs(them, member);
    await expect(them.getByRole("navigation", { name: "Main" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: `Deactivate ${OWNER_NAME}` })).toHaveCount(0);
    await page.getByRole("button", { name: `Deactivate ${member.name}` }).click();
    const confirm = page.getByRole("dialog", { name: `Deactivate ${member.name}?` });
    await expect(confirm).toContainText("signed out everywhere");
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "users-deactivate-confirm", async () => {
      await expect(confirm).toBeVisible();
    });
    await confirm.getByRole("button", { name: "Deactivate" }).click();
    await expect(page.getByText(`${member.name} deactivated`)).toBeVisible();
    await expect(row(page, member.name)).toHaveCount(0);

    await them.reload();
    await expect(them.getByRole("heading", { name: "Log in to Shopper" })).toBeVisible();
    await theirs.close();

    await page.getByRole("tab", { name: /Deactivated/ }).click();
    await expect(page).toHaveURL(/status=deactivated/);
    await expect(row(page, member.name)).toContainText("Deactivated");
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "users-deactivated", async () => {
      await expect(row(page, member.name)).toBeVisible();
    });
    await page.getByRole("button", { name: `Reactivate ${member.name}` }).click();
    await page
      .getByRole("dialog", { name: `Reactivate ${member.name}?` })
      .getByRole("button", { name: "Reactivate" })
      .click();
    await expect(page.getByText(`${member.name} reactivated`)).toBeVisible();
    await page
      .getByRole("tab", { name: /Active/ })
      .first()
      .click();
    await expect(row(page, member.name)).toBeVisible();
  });
});

test("a branch-scoped admin manages only members inside their branches", async ({
  browser,
  request,
}) => {
  const other = await addBranch(request);
  const admin = await createStaff(request, "admin", "Esi");
  const inside = await createStaff(request, "cashier", "Kofi");
  const everywhere = await createStaff(request, "cashier", "Abena");
  await scope(request, admin.userId, [BRANCH_NAME]);
  await scope(request, inside.userId, [BRANCH_NAME]);
  const theirs = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await theirs.newPage();
  await signInAs(page, admin);
  await page.goto("/users");
  await expect(row(page, everywhere.name)).toContainText("All branches");
  await expect(
    page.getByRole("button", { name: `Edit access for ${everywhere.name}` }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: `Deactivate ${everywhere.name}` })).toHaveCount(0);
  await page.getByRole("button", { name: `Edit access for ${inside.name}` }).click();
  await expect(dialog(page).getByRole("switch", { name: "All branches" })).not.toBeChecked();
  await expect(dialog(page).getByRole("checkbox", { name: BRANCH_NAME })).toBeChecked();
  await expect(dialog(page).getByRole("checkbox", { name: other })).toHaveCount(0);
  await theirs.close();
});
