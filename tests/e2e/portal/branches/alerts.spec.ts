import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { captureSizes, createBranch, shopHeaders, unique } from "../../../support/admin";
import { dialog } from "../../../support/admin/people";
import { BOX_API, expectNoSeriousAxe } from "../../../support/e2e";

// The store every e2e shop starts with, so these tests add branches and no stores to the lists other specs read.
async function accraStore(request: APIRequestContext) {
  const response = await request.get(`${BOX_API}/stores`, { headers: await shopHeaders(request) });
  const stores = (await response.json()) as { id: string; name: string }[];
  return stores.find((store) => store.name === "Accra Store")!;
}

const phone = (page: Page, position: number) =>
  dialog(page).getByLabel(`Alert phone ${position}`, { exact: true });

test.describe("branch alert phones, as the owner of E2E Mart", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/branches");
    await expect(page.getByRole("heading", { name: "Branches", level: 1 })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("a branch saves up to three alert phones and shows them again, in 0XXXXXXXXX form", async ({
    page,
    request,
  }, info) => {
    const tag = unique();
    const store = await accraStore(request);
    const branch = await createBranch(request, `Kaneshie ${tag}`, store.id);
    await page.reload();
    await page.getByRole("button", { name: `Edit ${branch.name}` }).click();
    await expect(phone(page, 1)).toHaveValue("");
    await phone(page, 1).fill("0241234567");
    // +233 and 233 numbers are accepted and stored as 0XXXXXXXXX.
    await phone(page, 2).fill("+233207654321");
    await phone(page, 3).fill("233551112223");
    await captureSizes(page, info, "branches-alert-phones", async () => {
      await expect(dialog(page)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Branch saved")).toBeVisible();
    await page.getByRole("button", { name: `Edit ${branch.name}` }).click();
    await expect(phone(page, 1)).toHaveValue("0241234567");
    await expect(phone(page, 2)).toHaveValue("0207654321");
    await expect(phone(page, 3)).toHaveValue("0551112223");
  });

  test("clearing a phone removes it, and a branch with none texts nobody", async ({
    page,
    request,
  }) => {
    const tag = unique();
    const store = await accraStore(request);
    const branch = await createBranch(request, `Adabraka ${tag}`, store.id);
    await page.reload();
    const edit = page.getByRole("button", { name: `Edit ${branch.name}` });
    await edit.click();
    await phone(page, 1).fill("0241234567");
    await phone(page, 2).fill("0207654321");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Branch saved")).toBeVisible();
    await edit.click();
    await phone(page, 1).fill("");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Branch saved")).toBeVisible();
    await edit.click();
    // Phones keep their order: the second number is the only one left, so it is the first now.
    await expect(phone(page, 1)).toHaveValue("0207654321");
    await expect(phone(page, 2)).toHaveValue("");
  });

  test("a number that is not a Ghana mobile number is refused on its own field", async ({
    page,
    request,
  }) => {
    const tag = unique();
    const store = await accraStore(request);
    const branch = await createBranch(request, `Osu ${tag}`, store.id);
    await page.reload();
    await page.getByRole("button", { name: `Edit ${branch.name}` }).click();
    await phone(page, 2).fill("12345");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(phone(page, 2)).toHaveAttribute("aria-invalid", "true");
    await expect(phone(page, 2)).toHaveAccessibleDescription(/Ghana/);
    await expect(phone(page, 2)).toBeFocused();
    await expect(phone(page, 1)).not.toHaveAttribute("aria-invalid", "true");
  });

  test("the same number twice is refused on the second field", async ({ page, request }) => {
    const tag = unique();
    const store = await accraStore(request);
    const branch = await createBranch(request, `Tema ${tag}`, store.id);
    await page.reload();
    await page.getByRole("button", { name: `Edit ${branch.name}` }).click();
    await phone(page, 1).fill("0241234567");
    await phone(page, 2).fill("+233241234567");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(phone(page, 2)).toHaveAttribute("aria-invalid", "true");
    await expect(phone(page, 2)).toHaveAccessibleDescription(/already/i);
  });

  test("a new branch can be given alert phones as it is created", async ({ page, request }) => {
    const tag = unique();
    const store = await accraStore(request);
    await page.reload();
    await page.getByRole("button", { name: "Add branch" }).click();
    await dialog(page).getByLabel("Name", { exact: true }).fill(`Spintex ${tag}`);
    await dialog(page).getByRole("combobox", { name: "Store" }).click();
    await page.getByRole("option", { name: store.name }).click();
    await phone(page, 1).fill("0241234567");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Branch added")).toBeVisible();
    await page.getByRole("button", { name: `Edit Spintex ${tag}` }).click();
    await expect(phone(page, 1)).toHaveValue("0241234567");
  });
});
